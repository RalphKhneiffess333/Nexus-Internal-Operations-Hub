import { useState } from 'react'
import { TicketPriority } from '../../features/tickets/ticket-types'
import { FilePicker } from './FilePicker'

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
  includeAttachments = false,
  existingAttachments = [],
}) {
  const [files, setFiles] = useState([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([])
  const defaultDepartmentId =
    initialValues?.departmentId ?? departments[0]?.departmentId ?? ''
  return (
    <form
      className="ticket-form clay-card content-reveal"
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        onSubmit({
          title: String(form.get('title') ?? '').trim(),
          description: String(form.get('description') ?? '').trim(),
          priority: String(form.get('priority') ?? ''),
          departmentId: String(form.get('departmentId') ?? ''),
          submittedBy: includeSubmittedBy
            ? String(form.get('submittedBy') ?? '')
            : undefined,
          files: includeAttachments ? files : [],
          removedAttachmentIds: includeAttachments ? removedAttachmentIds : [],
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
          <input name="submittedBy" readOnly />
        </label>
      ) : null}

      {includeAttachments ? (
        <div className="field">
          <span>Attachments <small>(optional, up to 5 files)</small></span>
          {existingAttachments.length > 0 ? (
            <div className="existing-file-list">
              <span className="file-picker-section-label">Current files</span>
              <ul className="file-list">
                {existingAttachments
                  .filter(
                    (attachment) =>
                      !removedAttachmentIds.includes(attachment.attachmentId),
                  )
                  .map((attachment) => (
                    <li key={attachment.attachmentId}>
                      <span className="file-name">
                        <span aria-hidden="true">📎</span>
                        {attachment.originalName}
                      </span>
                      <button
                        type="button"
                        className="file-remove"
                        onClick={() =>
                          setRemovedAttachmentIds((currentIds) => [
                            ...currentIds,
                            attachment.attachmentId,
                          ])
                        }
                        disabled={submitting}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          <FilePicker onChange={setFiles} disabled={submitting} />
        </div>
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

