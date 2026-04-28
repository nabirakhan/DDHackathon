// client/src/context/CanvasContext.tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Tldraw, createTLStore, defaultShapeUtils, type Editor, type TLStore, type TLShape } from 'tldraw'
import * as Y from 'yjs'
import 'tldraw/tldraw.css'

interface CanvasCtx {
  editor: Editor | null
  _setEditor: (e: Editor) => void
  store: TLStore
  ydoc: Y.Doc
  yShapes: Y.Map<TLShape>
  roomReady: boolean
  setRoomReady: (ready: boolean) => void
}

const CanvasContext = createContext<CanvasCtx | null>(null)

export function CanvasProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createTLStore({ shapeUtils: defaultShapeUtils }), [])
  const ydoc = useMemo(() => new Y.Doc(), [])
  const yShapes = useMemo(() => ydoc.getMap<TLShape>('shapes'), [ydoc])
  const [editor, _setEditor] = useState<Editor | null>(null)
  const [roomReady, setRoomReady] = useState(false)

  return (
    <CanvasContext.Provider value={{ editor, _setEditor, store, ydoc, yShapes, roomReady, setRoomReady }}>
      {children}
    </CanvasContext.Provider>
  )
}

// Renders the tldraw canvas. Gated on roomReady so tldraw mounts only after
// room:joined populates the ydoc — prevents the blank-canvas F5 race where
// tldraw would otherwise create a fresh random page ID before the server diff
// arrives, leaving shapes (which reference the original page ID) invisible.
export function CanvasMount() {
  const { store, _setEditor, roomReady } = useCanvas()
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {roomReady
        ? <Tldraw store={store} onMount={_setEditor} />
        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(200,188,168,0.4)', fontFamily: 'DM Mono, monospace', fontSize: '13px' }}>Joining room…</div>
      }
    </div>
  )
}

export function useCanvas(): CanvasCtx {
  const ctx = useContext(CanvasContext)
  if (!ctx) throw new Error('useCanvas must be used within <CanvasProvider>')
  return ctx
}

export const useEditor = () => useCanvas().editor
