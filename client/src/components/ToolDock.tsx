// client/src/components/ToolDock.tsx
import { useEffect, useState } from 'react'
import { Dock } from './ui/Dock'
import { useEditor } from '../context/CanvasContext'
import { wsClient } from '../lib/wsClient'
import { MousePointer2, Square, Type, Minus, ArrowRight, Eraser, Undo2, Redo2, Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function ToolDock({ roomId: _roomId }: { roomId: string }) {
  const editor = useEditor()
  const navigate = useNavigate()
  const [aiActive, setAiActive] = useState(false)

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'mutation:broadcast') {
        setAiActive(true)
        setTimeout(() => setAiActive(false), 2200)
      }
    })
  }, [])

  const items = [
    { icon: <Home size={17} />, label: 'Home', onClick: () => navigate('/') },
    { icon: <MousePointer2 size={17} />, label: 'Select', onClick: () => editor?.setCurrentTool('select') },
    { icon: <Square size={17} />, label: 'Rectangle', onClick: () => editor?.setCurrentTool('geo') },
    { icon: <Type size={17} />, label: 'Text', onClick: () => editor?.setCurrentTool('text') },
    { icon: <Minus size={17} />, label: 'Line', onClick: () => editor?.setCurrentTool('line') },
    { icon: <ArrowRight size={17} />, label: 'Arrow', onClick: () => editor?.setCurrentTool('arrow') },
    { icon: <Eraser size={17} />, label: 'Eraser', onClick: () => editor?.setCurrentTool('eraser') },
    { icon: <Undo2 size={17} />, label: 'Undo', onClick: () => editor?.undo() },
    { icon: <Redo2 size={17} />, label: 'Redo', onClick: () => editor?.redo() },
  ]

  return (
    <Dock
      items={items}
      magnification={54}
      distance={100}
      baseItemSize={36}
      spring={{ mass: 0.1, stiffness: 160, damping: 14 }}
      aiActive={aiActive}
    />
  )
}

export function AIStatusPill() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    return wsClient.on((msg) => {
      if (msg.type === 'mutation:broadcast') {
        setActive(true)
        setTimeout(() => setActive(false), 2200)
      }
    })
  }, [])

  if (!active) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '90px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      padding: '5px 14px',
      borderRadius: '999px',
      background: 'rgba(47, 62, 70, 0.92)',
      border: '1px solid rgba(132,169,140,0.4)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      fontFamily: 'Syne, sans-serif',
      fontSize: '10px', fontWeight: 800,
      letterSpacing: '1.5px', textTransform: 'uppercase',
      color: '#84A98C',
      display: 'flex', alignItems: 'center', gap: '7px',
      animation: 'fade-in-up 0.3s ease-out',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#84A98C', boxShadow: '0 0 8px rgba(132,169,140,0.8)', display: 'inline-block' }} />
      AI Classifying
    </div>
  )
}
