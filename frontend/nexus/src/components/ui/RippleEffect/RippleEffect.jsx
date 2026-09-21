import { useEffect } from 'react'

const RIPPLE_DURATION_MS = 900
const RIPPLE_TARGETS = [
  '.btn',
  '.nav-item',
  '.pool-switcher button',
  '.sidebar-logout',
  '.menu-button',
  '.ticket-row',
  '.file-picker-button',
].join(', ')

export function RippleEffect() {
  useEffect(() => {
    const activeRipples = new Map()

    function removeRipple(ripple) {
      const timer = activeRipples.get(ripple)
      if (timer !== undefined) {
        window.clearTimeout(timer)
      }

      activeRipples.delete(ripple)
      ripple.remove()
    }

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

      const ripple = document.createElement('span')
      ripple.className = 'click-ripple'
      ripple.setAttribute('aria-hidden', 'true')
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`
      ripple.style.width = `${radius * 2}px`
      ripple.style.height = `${radius * 2}px`
      target.appendChild(ripple)

      const timer = window.setTimeout(() => {
        removeRipple(ripple)
      }, RIPPLE_DURATION_MS)
      activeRipples.set(ripple, timer)
      ripple.addEventListener('animationend', () => removeRipple(ripple), {
        once: true,
      })
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      for (const ripple of activeRipples.keys()) {
        removeRipple(ripple)
      }
    }
  }, [])

  return null
}
