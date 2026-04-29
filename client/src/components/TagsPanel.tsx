import { useEffect, useRef, useState } from 'react'
import { useValue } from 'tldraw'
import { useEditor } from '../context/CanvasContext'

interface Props {
  open: boolean
  onClose: () => void
  tags: Map<string, string[]>
  addTag: (nodeId: string, tag: string) => Promise<void>
  removeTag: (nodeId: string, tag: string) => Promise<void>
}

export function TagsPanel({ open, onClose, tags, addTag, removeTag }: Props) {
  const editor = useEditor()
  const [input, setInput] = useState('')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedIds = useValue('selectedIds', () => editor?.getSelectedShapeIds() ?? [], [editor])
  const nodeId = selectedIds.length === 1 ? selectedIds[0] : null

  // Close when deselected
  useEffect(() => {
    if (!nodeId) onClose()
  }, [nodeId])

  useEffect(() => {
    if (!editor || !nodeId || !open) { setPos(null); return }
    const bounds = editor.getShapePageBounds(nodeId)
    if (!bounds) { setPos(null); return }
    const screen = editor.pageToScreen({ x: bounds.midX, y: bounds.maxY })
    setPos(screen)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [editor, nodeId, open])

  if (!open || !nodeId || !pos) return null

  const nodeTags = tags.get(nodeId) ?? []

  const handleAdd = () => {
    const clean = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!clean || clean.length > 20 || nodeTags.includes(clean)) { setInput(''); return }
    addTag(nodeId, clean)
    setInput('')
    inputRef.current?.focus()
  }

  // Position relative to <main> (position:relative parent)
  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y + 12,
        transform: 'translateX(-50%)',
        zIndex: 600,
        background: 'rgba(47, 62, 70, 0.92)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(202, 210, 197, 0.1)',
        borderRadius: '1.25rem',
        padding: '10px 12px',
        minWidth: '180px',
        maxWidth: '240px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '9px', fontWeight: 800, color: '#84A98C', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Tags
      </div>

      {nodeTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
          {nodeTags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 700,
                color: '#84A98C', background: 'rgba(132,169,140,0.15)',
                border: '1px solid rgba(132,169,140,0.3)',
                padding: '2px 6px 2px 7px', borderRadius: '999px',
              }}
            >
              #{tag}
              <button
                onClick={() => removeTag(nodeId, tag)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(132,169,140,0.5)', fontSize: '10px', lineHeight: 1,
                  padding: '0 1px', display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(132,169,140,0.5)')}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose() }}
          placeholder="add tag…"
          maxLength={20}
          style={{
            flex: 1, background: 'rgba(202,210,197,0.06)', border: '1px solid rgba(202,210,197,0.12)',
            borderRadius: '999px', padding: '4px 10px',
            fontFamily: 'Inter, sans-serif', fontSize: '10px', color: '#CAD2C5',
            outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            background: 'rgba(132,169,140,0.2)', border: '1px solid rgba(132,169,140,0.3)',
            borderRadius: '999px', padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 700, color: '#84A98C',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(132,169,140,0.35)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(132,169,140,0.2)')}
        >
          +
        </button>
      </div>
    </div>
  )
}
