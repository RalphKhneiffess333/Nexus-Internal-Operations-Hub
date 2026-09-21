export function NavIcon({ src, crop }) {
  const mask = `url("${src}")`

  return (
    <span
      className={`nav-item-icon${crop ? ` nav-item-icon--${crop}` : ''}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      aria-hidden="true"
    />
  )
}
