import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import './Dock.css'

interface DockItemData {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}

interface DockProps {
  items: DockItemData[]
  magnification?: number
  distance?: number
  panelHeight?: number
  dockHeight?: number
  baseItemSize?: number
  spring?: { mass: number; stiffness: number; damping: number }
}

function DockItem({
  item,
  mouseX,
  magnification,
  distance,
  baseItemSize,
  spring,
}: {
  item: DockItemData
  mouseX: ReturnType<typeof useMotionValue<number>>
  magnification: number
  distance: number
  baseItemSize: number
  spring: { mass: number; stiffness: number; damping: number }
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)

  const distFromCenter = useTransform(mouseX, (val: number) => {
    const el = ref.current
    if (!el) return Infinity
    const rect = el.getBoundingClientRect()
    return val - (rect.left + rect.width / 2)
  })

  const rawSize = useTransform(distFromCenter, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize])
  const size = useSpring(rawSize, spring)

  return (
    <motion.div
      ref={ref}
      className="dock-item"
      style={{ width: size, height: size }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={item.onClick}
    >
      {hovered && (
        <div className="dock-label-wrapper">
          <span className="dock-label">{item.label}</span>
        </div>
      )}
      <motion.div
        className="dock-icon"
        style={{ width: size, height: size }}
      >
        {item.icon}
      </motion.div>
    </motion.div>
  )
}

export function Dock({
  items,
  magnification = 60,
  distance = 100,
  baseItemSize = 40,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
}: DockProps) {
  const mouseX = useMotionValue(Infinity)

  return (
    <div className="dock-outer">
      <div
        className="dock-panel"
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
      >
        {items.map((item, i) => (
          <DockItem
            key={i}
            item={item}
            mouseX={mouseX}
            magnification={magnification}
            distance={distance}
            baseItemSize={baseItemSize}
            spring={spring}
          />
        ))}
      </div>
    </div>
  )
}
