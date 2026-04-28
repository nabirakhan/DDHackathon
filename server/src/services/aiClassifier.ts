import { GoogleGenerativeAI } from '@google/generative-ai'
import { createHash } from 'crypto'
import type { IntentType } from '@shared/types'
import { checkRateLimit } from '../middleware/rateLimiter.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

const cache = new Map<string, IntentType>()

const PROMPT_PREFIX = `Classify the following short text from a brainstorming whiteboard into exactly one category. Respond with ONLY the category name, nothing else.

Categories:
- action_item: a task to be done, an assignment, something requiring follow-up
- decision: a finalized choice, an agreed-upon outcome
- open_question: an unresolved query, something needing answer
- reference: factual notes, context, background info that doesn't fit above

Text: `

const VALID: IntentType[] = ['action_item', 'decision', 'open_question', 'reference']

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function normalizeIntent(raw: string): IntentType {
  const lower = raw.trim().toLowerCase()
  return VALID.find(v => lower.includes(v)) ?? 'reference'
}

function classifyHeuristic(text: string): IntentType {
  const lower = text.toLowerCase().trim()
  if (['?', 'how might', 'what if', 'should we', 'do we', 'is it', 'can we', 'why is', 'how do', 'are we']
    .some(k => lower.includes(k))) return 'open_question'
  if (['decided', 'will use', 'agreed', 'going with', 'we chose', 'confirmed', 'locked in', 'final:', 'we will', 'chosen']
    .some(k => lower.includes(k))) return 'decision'
  if (['we need', 'should', 'must', 'todo', 'assigned to', 'will do', 'needs to', 'action:', 'task:',
    'by monday', 'by friday', 'by tomorrow', 'deadline']
    .some(k => lower.includes(k))) return 'action_item'
  return 'reference'
}

async function classifyWithGemini(text: string): Promise<IntentType> {
  const result = await geminiModel.generateContent(PROMPT_PREFIX + text)
  const raw = result.response.text()
  return normalizeIntent(raw)
}

export async function classify(userId: string, text: string): Promise<IntentType> {
  const key = hash(text)
  const cached = cache.get(key)
  if (cached) {
    console.log(`[task:classify] cache hit key=${key} result=${cached}`)
    return cached
  }

  if (!checkRateLimit(userId)) {
    console.log(`[task:classify] rate-limited userId=${userId} — using heuristic`)
    const result = classifyHeuristic(text)
    cache.set(key, result)
    return result
  }

  if (!process.env.GEMINI_API_KEY) {
    console.log('[task:classify] GEMINI_API_KEY not set — using heuristic')
    const result = classifyHeuristic(text)
    cache.set(key, result)
    return result
  }

  try {
    console.log(`[task:classify] calling Gemini for text="${text.slice(0, 60)}"`)
    const result = await classifyWithGemini(text)
    console.log(`[task:classify] Gemini result="${result}"`)
    cache.set(key, result)
    return result
  } catch (err) {
    console.warn('[task:classify] Gemini failed — falling back to heuristic:', (err as Error).message)
    const result = classifyHeuristic(text)
    cache.set(key, result)
    return result
  }
}
