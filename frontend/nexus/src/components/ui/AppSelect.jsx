import { createPortal } from 'react-dom'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

function getFirstEnabledIndex(options, start = 0, direction = 1) {
  if (options.length === 0) return -1

  let index = start
  for (let attempt = 0; attempt < options.length; attempt += 1) {
    const option = options[index]
    if (!option?.disabled) return index
    index = (index + direction + options.length) % options.length
  }

  return -1
}

export function AppSelect({
  value,
  defaultValue = '',
  options = [],
  onChange,
  name,
  id,
  ariaLabel,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  className = '',
  onClick,
}) {
  const generatedId = useId()
  const triggerId = id ?? `app-select-${generatedId}`
  const listboxId = `${triggerId}-listbox`
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? ''))
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuLayout, setMenuLayout] = useState(null)
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)

  const selectedValue = value === undefined ? internalValue : String(value ?? '')
  const selectedIndex = options.findIndex((option) => String(option.value) === selectedValue)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null

  useEffect(() => {
    if (!open) return undefined

    function closeOnOutsidePointer(event) {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return undefined

    function updateMenuLayout() {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const viewportPadding = 12
      const gap = 7
      const spaceAbove = rect.top - viewportPadding
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
      const opensUpward = spaceBelow < 180 && spaceAbove > spaceBelow
      const availableSpace = opensUpward ? spaceAbove : spaceBelow
      const maxHeight = Math.max(80, Math.min(280, availableSpace - gap))
      const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2)
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - viewportPadding - width,
      )

      setMenuLayout({
        left,
        width,
        maxHeight,
        placement: opensUpward ? 'upward' : 'downward',
        ...(opensUpward
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      })
    }

    updateMenuLayout()
    window.addEventListener('resize', updateMenuLayout)
    window.addEventListener('scroll', updateMenuLayout, true)
    return () => {
      window.removeEventListener('resize', updateMenuLayout)
      window.removeEventListener('scroll', updateMenuLayout, true)
    }
  }, [open, options.length])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    menuRef.current
      ?.querySelector(`[data-app-select-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function openMenu(nextIndex = selectedIndex) {
    const fallbackIndex = getFirstEnabledIndex(options, nextIndex >= 0 ? nextIndex : 0)
    setActiveIndex(fallbackIndex)
    setMenuLayout(null)
    setOpen(true)
  }

  function selectOption(option) {
    if (!option || option.disabled) return
    const nextValue = String(option.value)
    if (value === undefined) setInternalValue(nextValue)
    onChange?.(nextValue)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function handleTriggerKeyDown(event) {
    if (disabled) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const startingIndex = open && activeIndex >= 0
        ? activeIndex + direction
        : selectedIndex >= 0
          ? selectedIndex + direction
          : direction === 1 ? 0 : options.length - 1
      const nextIndex = getFirstEnabledIndex(
        options,
        (startingIndex + options.length) % options.length,
        direction,
      )
      setActiveIndex(nextIndex)
      if (!open) setMenuLayout(null)
      setOpen(true)
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const startingIndex = event.key === 'Home' ? 0 : options.length - 1
      const direction = event.key === 'Home' ? 1 : -1
      setActiveIndex(getFirstEnabledIndex(options, startingIndex, direction))
      if (!open) setMenuLayout(null)
      setOpen(true)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open && activeIndex >= 0) selectOption(options[activeIndex])
      else openMenu()
    }
  }

  const classes = ['app-select', open ? 'is-open' : '', className].filter(Boolean).join(' ')

  return (
    <div ref={rootRef} className={classes}>
      {name ? <input type="hidden" name={name} value={selectedValue} disabled={disabled} /> : null}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="app-select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) (open ? setOpen(false) : openMenu())
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={`app-select-value${selectedOption ? '' : ' is-placeholder'}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="app-select-chevron" aria-hidden="true" />
      </button>
      {open && menuLayout ? createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          className={`app-select-menu is-${menuLayout.placement}`}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            left: `${menuLayout.left}px`,
            width: `${menuLayout.width}px`,
            maxHeight: `${menuLayout.maxHeight}px`,
            ...(menuLayout.top !== undefined ? { top: `${menuLayout.top}px` } : {}),
            ...(menuLayout.bottom !== undefined ? { bottom: `${menuLayout.bottom}px` } : {}),
          }}
        >
          {options.length > 0 ? options.map((option, index) => (
            <button
              key={String(option.value)}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              tabIndex={-1}
              className={`app-select-option${index === activeIndex ? ' is-active' : ''}${String(option.value) === selectedValue ? ' is-selected' : ''}`}
              aria-selected={String(option.value) === selectedValue}
              disabled={option.disabled}
              data-app-select-option-index={index}
              onMouseEnter={() => setActiveIndex(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation()
                selectOption(option)
              }}
            >
              {option.label}
            </button>
          )) : (
            <span className="app-select-empty">No options available</span>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
