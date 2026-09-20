import { useEffect, useRef } from 'react'

export function DebouncedSearchInput({
  value = '',
  onDebouncedChange,
  delay = 350,
  ...props
}) {
  const inputRef = useRef(null)
  const timeoutRef = useRef(null)
  const onDebouncedChangeRef = useRef(onDebouncedChange)

  useEffect(() => {
    onDebouncedChangeRef.current = onDebouncedChange
  }, [onDebouncedChange])

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }
  }, [value])

  useEffect(() => () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleChange(event) {
    const nextValue = event.target.value
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      onDebouncedChangeRef.current(nextValue)
      timeoutRef.current = null
    }, delay)
  }

  return <input ref={inputRef} defaultValue={value} onChange={handleChange} {...props} />
}
