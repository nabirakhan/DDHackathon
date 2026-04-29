import { useEffect, useState } from 'react'
import { useValue } from 'tldraw'
import { useEditor } from '../context/CanvasContext'

interface Props {
  tags: Map<string, string[]>
}

export function TagsOverlay({ tags }: Props) {
  const editor = useEditor()
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const hoveredId = useValue('hoveredId', () => editor?.getHoveredShapeId() ?? null, [editor])
  const nodeTags = hoveredId ? (tags.get(hoveredId) ?? []) : []

  if (!hoveredId || nodeTags.length === 0 || !cursor) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: cursor.x + 14,
        top: cursor.y - 10,
        transform: 'translateY(-100%)',
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        maxWidth: '200px',
        pointerEvents: 'none',
        zIndex: 9999,
        animation: 'tagsIn 0.12s ease',
      }}
    >
      {nodeTags.map(tag => (
        <span
          key={tag}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '9px',
            fontWeight: 700,
            color: '#84A98C',
            background: 'rgba(47,62,70,0.92)',
            border: '1px solid rgba(132,169,140,0.35)',
            backdropFilter: 'blur(8px)',
            padding: '2px 7px',
            borderRadius: '999px',
            letterSpacing: '0.4px',
            whiteSpace: 'nowrap',
          }}
        >
          #{tag}
        </span>
      ))}
      <style>{`@keyframes tagsIn{from{opacity:0;transform:translateY(-80%)}to{opacity:1;transform:translateY(-100%)}}`}</style>
    </div>
  )
}
