import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createHash } from 'crypto'
import type { IntentType } from '@shared/types'
import { checkRateLimit } from '../middleware/rateLimiter.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const cache = new Map<string, IntentType>()

const SYSTEM_PROMPT = `Classify the following short text from a brainstorming whiteboard into exactly one category. Respond with ONLY the category name, no explanation.

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

async function classifyWithClaude(text: string): Promise<IntentType> {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 20,
    messages: [{ role: 'user', content: SYSTEM_PROMPT + text }],
  })
  const block = res.content[0]
  if (block.type !== 'text') return 'reference'
  return normalizeIntent(block.text)
}

async function classifyWithOpenAI(text: string): Promise<IntentType> {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 20,
    messages: [{ role: 'user', content: SYSTEM_PROMPT + text }],
  })
  return normalizeIntent(res.choices[0].message.content ?? 'reference')
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

export async function classify(userId: string, text: string): Promise<IntentType> {
  const key = hash(text)
  const cached = cache.get(key)
  if (cached) return cached

  if (!checkRateLimit(userId)) {
    const result = classifyHeuristic(text)
    cache.set(key, result)
    return result
  }

  try {
    const result = await classifyWithClaude(text)
    cache.set(key, result)
    return result
  } catch (anthropicErr) {
    console.warn('Anthropic API failed, falling back to OpenAI', anthropicErr)
    try {
      const result = await classifyWithOpenAI(text)
      cache.set(key, result)
      return result
    } catch (openaiErr) {
      console.warn('OpenAI API failed, falling back to heuristic', openaiErr)
      const result = classifyHeuristic(text)
      cache.set(key, result)
      return result
    }
  }
}
