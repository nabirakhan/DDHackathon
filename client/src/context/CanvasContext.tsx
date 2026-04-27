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
      <Tldraw store={store} onMount={setEditor} />
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
