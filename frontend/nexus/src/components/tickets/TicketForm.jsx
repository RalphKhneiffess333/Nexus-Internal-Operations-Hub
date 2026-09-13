import { CURRENT_USER_ID, TicketPriority } from '../../features/tickets/ticket-types'

const PRIORITY_OPTIONS = [
  { value: TicketPriority.LOW, label: 'Low' },
  { value: TicketPriority.MODERATE, label: 'Moderate' },
  { value: TicketPriority.HIGH, label: 'High' },
]

export function TicketForm({
  initialValues,
  departments = [],
  submitLabel,
  submittingLabel,
  submitting,
  error,
  fieldErrors,
  onSubmit,
  onCancel,
  includeSubmittedBy = false,
}) {
  const defaultDepartmentId =
    initialValues?.departmentId ?? departments[0]?.departmentId ?? ''
  return (
    <form
      className="ticket-form clay-card"
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        onSubmit({
          title: String(form.get('title') ?? '').trim(),
          description: String(form.get('description') ?? '').trim(),
          priority: String(form.get('priority') ?? ''),
          departmentId: String(form.get('departmentId') ?? ''),
          submittedBy: includeSubmittedBy
            ? String(form.get('submittedBy') ?? CURRENT_USER_ID)
            : undefined,
        })
      }}
    >
      <label className="field">
        <span>Title</span>
        <input
          name="title"
          defaultValue={initialValues?.title ?? ''}
          required
          maxLength={200}
        />
        {fieldErrors?.title ? (
          <em className="field-error">{fieldErrors.title}</em>
        ) : null}
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          name="description"
          defaultValue={initialValues?.description ?? ''}
          required
          rows={5}
        />
        {fieldErrors?.description ? (
          <em className="field-error">{fieldErrors.description}</em>
        ) : null}
      </label>

      <label className="field">
        <span>Priority</span>
        <select
          name="priority"
          defaultValue={initialValues?.priority ?? TicketPriority.MODERATE}
          required
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {fieldErrors?.priority ? (
          <em className="field-error">{fieldErrors.priority}</em>
        ) : null}
      </label>

      <label className="field">
        <span>Department</span>
        <select
          name="departmentId"
          defaultValue={defaultDepartmentId}
          required
          disabled={departments.length === 0}
        >
          {departments.length === 0 ? (
            <option value="">No departments available</option>
          ) : null}
          {departments.map((department) => (
            <option key={department.departmentId} value={department.departmentId}>
              {department.name}
            </option>
          ))}
        </select>
        {fieldErrors?.departmentId ? (
          <em className="field-error">{fieldErrors.departmentId}</em>
        ) : null}
      </label>

      {includeSubmittedBy ? (
        <label className="field">
          <span>Submitted by</span>
          <input name="submittedBy" defaultValue={CURRENT_USER_ID} readOnly />
        </label>
      ) : null}

      {error ? <p className="banner error">{error}</p> : null}

      <div className="form-actions">
        {onCancel ? (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn primary" disabled={submitting || departments.length === 0}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}

export function validateTicketFields(values, { requireSubmittedBy = false } = {}) {
  const fieldErrors = {}

  if (!values.title) {
    fieldErrors.title = 'Title is required.'
  }
  if (!values.description) {
    fieldErrors.description = 'Description is required.'
  }
  if (!values.priority) {
    fieldErrors.priority = 'Priority is required.'
  }
  if (!values.departmentId) {
    fieldErrors.departmentId = 'Department is required.'
  }
  if (requireSubmittedBy && !values.submittedBy) {
    fieldErrors.submittedBy = 'Submitted by is required.'
  }

  return fieldErrors
}
