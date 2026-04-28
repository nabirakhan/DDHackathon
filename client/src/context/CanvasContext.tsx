// client/src/context/CanvasContext.tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Tldraw, createTLStore, defaultShapeUtils, type Editor, type TLStore, type TLShape } from 'tldraw'
import * as Y from 'yjs'
import 'tldraw/tldraw.css'

interface CanvasCtx {
  editor: Editor | null
  store: TLStore
  ydoc: Y.Doc
  yShapes: Y.Map<TLShape>
}

const CanvasContext = createContext<CanvasCtx | null>(null)

export function CanvasProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createTLStore({ shapeUtils: defaultShapeUtils }), [])
  const ydoc = useMemo(() => new Y.Doc(), [])
  const yShapes = useMemo(() => ydoc.getMap<TLShape>('shapes'), [ydoc])
  const [editor, setEditor] = useState<Editor | null>(null)

  return (
    <CanvasContext.Provider value={{ editor, store, ydoc, yShapes }}>
      <div style={{
        position: 'fixed',
        top: '80px',
        left: '284px',
        right: '284px',
        bottom: '96px',
        borderRadius: '2.5rem',
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.45), 0 40px 100px rgba(0,0,0,0.55)',
        zIndex: 1,
      }}>
        <Tldraw store={store} onMount={setEditor} />
      </div>
      {children}
    </CanvasContext.Provider>
  )
}

export function useCanvas(): CanvasCtx {
  const ctx = useContext(CanvasContext)
  if (!ctx) throw new Error('useCanvas must be used within <CanvasProvider>')
  return ctx
}

export const useEditor = () => useCanvas().editor
