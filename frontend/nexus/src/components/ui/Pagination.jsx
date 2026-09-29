export function Pagination({
  page,
  hasMore = false,
  total = undefined,
  pageSize = 25,
  onPageChange,
  ariaLabel = 'Pages',
}) {
  const totalPages = total === undefined ? null : Math.ceil(total / pageSize)
  const hasNextPage = totalPages === null ? hasMore : page < totalPages

  if (page <= 1 && !hasNextPage) {
    return null
  }

  return (
    <div className="admin-pagination" aria-label={ariaLabel}>
      <button
        type="button"
        className="btn ghost"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span>{totalPages === null ? `Page ${page}` : `Page ${page} of ${totalPages}`}</span>
      <button
        type="button"
        className="btn ghost"
        disabled={!hasNextPage}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  )
}
