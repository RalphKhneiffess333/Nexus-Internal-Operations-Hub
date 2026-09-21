import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(',')

function getFocusableElements(container) {
  return container ? [...container.querySelectorAll(FOCUSABLE_SELECTOR)] : []
}

export function Dialog({
  children,
  onClose,
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  wide = false,
  className = '',
  backdropClassName = 'dialog-backdrop',
  closeOnEscape = true,
  closeOnBackdrop = true,
}) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const closeOnEscapeRef = useRef(closeOnEscape)
  const closeOnBackdropRef = useRef(closeOnBackdrop)

  useEffect(() => {
    onCloseRef.current = onClose
    closeOnEscapeRef.current = closeOnEscape
    closeOnBackdropRef.current = closeOnBackdrop
  }, [closeOnBackdrop, closeOnEscape, onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement
    const focusableElements = getFocusableElements(dialog)
    const firstFocusable = focusableElements[0]
    ;(firstFocusable || dialog)?.focus({ preventScroll: true })

    function handleKeyDown(event) {
      if (event.key === 'Escape' && closeOnEscapeRef.current) {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab') return

      const currentFocusableElements = getFocusableElements(dialog)
      if (currentFocusableElements.length === 0) {
        event.preventDefault()
        dialog?.focus({ preventScroll: true })
        return
      }

      const first = currentFocusableElements[0]
      const last = currentFocusableElements[currentFocusableElements.length - 1]
      if (event.shiftKey) {
        if (document.activeElement === first || !dialog?.contains(document.activeElement)) {
          event.preventDefault()
          last.focus({ preventScroll: true })
        }
      } else if (document.activeElement === last || !dialog?.contains(document.activeElement)) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    function handleBackdropMouseDown(event) {
      if (event.target === event.currentTarget && closeOnBackdropRef.current) {
        onCloseRef.current?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    dialog?.parentElement?.addEventListener('mousedown', handleBackdropMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      dialog?.parentElement?.removeEventListener('mousedown', handleBackdropMouseDown)
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [])

  return (
    <div className={backdropClassName} role="presentation">
      <div
        ref={dialogRef}
        className={`dialog clay-card ${wide ? 'dialog-wide' : ''}${className ? ` ${className}` : ''}`}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex="-1"
      >
        {children}
      </div>
    </div>
  )
}
