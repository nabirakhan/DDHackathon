import { useEffect, useState } from 'react'
import { useValue } from 'tldraw'
import { useEditor } from '../context/CanvasContext'

interface Props {
  tags: Map<string, string[]>
}

interface Pos { x: number; y: number }

export function TagsOverlay({ tags }: Props) {
  const editor = useEditor()
  const [pos, setPos] = useState<Pos | null>(null)
  const [nodeTags, setNodeTags] = useState<string[]>([])

  const hoveredId = useValue('hoveredId', () => editor?.getHoveredShapeId() ?? null, [editor])

  useEffect(() => {
    if (!editor || !hoveredId) {
      setPos(null)
      setNodeTags([])
      return
    }
    const shapeTags = tags.get(hoveredId) ?? []
    if (shapeTags.length === 0) {
      setPos(null)
      setNodeTags([])
      return
    }
    const bounds = editor.getShapePageBounds(hoveredId)
    if (!bounds) { setPos(null); return }
    const screenPos = editor.pageToScreen({ x: bounds.midX, y: bounds.minY })
    setPos(screenPos)
    setNodeTags(shapeTags)
  }, [editor, hoveredId, tags])

  if (!pos || nodeTags.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y - 8,
        transform: 'translate(-50%, -100%)',
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '200px',
        pointerEvents: 'none',
        zIndex: 500,
        animation: 'tagsIn 0.15s ease',
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
            background: 'rgba(132,169,140,0.18)',
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
      <style>{`@keyframes tagsIn { from { opacity:0; transform:translate(-50%,-90%) } to { opacity:1; transform:translate(-50%,-100%) } }`}</style>
    </div>
  )
}
