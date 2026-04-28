import { useEffect, useState } from 'react'
import { Dock } from './ui/Dock'
import { useEditor } from '../context/CanvasContext'
import { wsClient } from '../lib/wsClient'
import {
  MousePointer2, Square, Type, Minus, ArrowRight, Eraser, Undo2, Redo2, Home
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  roomId: string
}

export function ToolDock({ roomId: _roomId }: Props) {
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
    { icon: <Home size={18} />, label: 'Home', onClick: () => navigate('/') },
    { icon: <MousePointer2 size={18} />, label: 'Select', onClick: () => editor?.setCurrentTool('select') },
    { icon: <Square size={18} />, label: 'Rectangle', onClick: () => editor?.setCurrentTool('geo') },
    { icon: <Type size={18} />, label: 'Text', onClick: () => editor?.setCurrentTool('text') },
    { icon: <Minus size={18} />, label: 'Line', onClick: () => editor?.setCurrentTool('line') },
    { icon: <ArrowRight size={18} />, label: 'Arrow', onClick: () => editor?.setCurrentTool('arrow') },
    { icon: <Eraser size={18} />, label: 'Eraser', onClick: () => editor?.setCurrentTool('eraser') },
    { icon: <Undo2 size={18} />, label: 'Undo', onClick: () => editor?.undo() },
    { icon: <Redo2 size={18} />, label: 'Redo', onClick: () => editor?.redo() },
  ]

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
    }}>
      <Dock
        items={items}
        magnification={56}
        distance={100}
        baseItemSize={38}
        spring={{ mass: 0.1, stiffness: 160, damping: 14 }}
        aiActive={aiActive}
      />
    </div>
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
      bottom: '84px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      padding: '5px 14px',
      borderRadius: '999px',
      background: 'rgba(26, 28, 30, 0.88)',
      border: '1px solid rgba(160, 125, 84, 0.4)',
      backdropFilter: 'contrast(112%) blur(16px)',
      WebkitBackdropFilter: 'contrast(112%) blur(16px)',
      fontFamily: 'Syne, sans-serif',
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '1px',
      color: '#D4A017',
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      animation: 'fade-in-up 0.3s ease-out',
      boxShadow: '0 4px 16px rgba(93, 86, 70, 0.3)',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: '#A07D54',
        boxShadow: '0 0 8px rgba(160, 125, 84, 0.8)',
        display: 'inline-block',
        animation: 'spin-slow 2s linear infinite',
      }} />
      AI CLASSIFYING
    </div>
  )
}
