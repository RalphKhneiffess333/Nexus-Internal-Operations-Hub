export function IllustratedEmptyState({
  image,
  title,
  message,
  action = null,
  className = '',
}) {
  return (
    <div className={`empty-state illustrated-empty-state clay-card${className ? ` ${className}` : ''}`}>
      <img src={image} alt="" aria-hidden="true" />
      <div className="illustrated-empty-state-copy">
        <h2>{title}</h2>
        <p>{message}</p>
        {action}
      </div>
    </div>
  )
}
