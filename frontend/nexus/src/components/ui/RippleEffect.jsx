import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const RIPPLE_DURATION_MS = 900
const RIPPLE_TARGETS = [
  '.btn',
  '.nav-item',
  '.pool-switcher button',
  '.sidebar-logout',
  '.menu-button',
  '.ticket-row',
].join(', ')

export function RippleEffect() {
  const [ripples, setRipples] = useState([])
  const nextId = useRef(0)
  const timers = useRef(new Set())

  useEffect(() => {
    const activeTimers = timers.current

    function handlePointerDown(event) {
      if (event.button !== 0 || !(event.target instanceof Element)) {
        return
      }

      const target = event.target.closest(RIPPLE_TARGETS)
      if (
        !target ||
        !target.isConnected ||
        target.matches(':disabled') ||
        target.getAttribute('aria-disabled') === 'true'
      ) {
        return
      }

      const bounds = target.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const radius = Math.hypot(
        Math.max(x, bounds.width - x),
        Math.max(y, bounds.height - y),
      )
      const id = nextId.current++

      setRipples((current) => [
        ...current,
        { id, target, x, y, size: radius * 2 },
      ])

      const timer = window.setTimeout(() => {
        setRipples((current) => current.filter((ripple) => ripple.id !== id))
        activeTimers.delete(timer)
      }, RIPPLE_DURATION_MS)
      activeTimers.add(timer)
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      activeTimers.forEach((timer) => window.clearTimeout(timer))
      activeTimers.clear()
    }
  }, [])

  return ripples.map(({ id, target, x, y, size }) =>
    createPortal(
      <span
        className="click-ripple"
        aria-hidden="true"
        style={{ left: x, top: y, width: size, height: size }}
      />,
      target,
      String(id),
    ),
  )
}
