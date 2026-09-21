import { useState } from 'react'
import { sanitizePlainText } from '../../../lib/content/sanitize'
import { AppSelect } from '../../ui/AppSelect'
import { FilePicker } from '../FilePicker/FilePicker'
import { MAX_FILES_PER_EVENT, attachmentCountError } from '../file-validation'
import {
  MAX_TICKET_TEXT_LENGTH,
  MAX_TICKET_TITLE_LENGTH,
} from '../ticket-validation'
import formStyles from '../FormStyles.module.css'

export function TicketForm({
  initialValues,
  departments = [],
  priorities = [],
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
  const [attachmentError, setAttachmentError] = useState('')
  const defaultDepartmentId =
    initialValues?.departmentId ?? departments[0]?.departmentId ?? ''
  const currentInactivePriority = initialValues?.priority &&
    !priorities.some((priority) => priority.code === initialValues.priority)
    ? { code: initialValues.priority, name: `${initialValues.priority} (inactive)` }
    : null
  const remainingAttachmentCount = existingAttachments.filter(
    (attachment) => !removedAttachmentIds.includes(attachment.attachmentId),
  ).length
  const maxNewFiles = Math.max(0, MAX_FILES_PER_EVENT - remainingAttachmentCount)

  function handleFilesChange(nextFiles) {
    setFiles(nextFiles)
    setAttachmentError(
      attachmentCountError(remainingAttachmentCount + nextFiles.length),
    )
  }

  return (
    <form
      className={`ticket-form clay-card content-reveal ${formStyles.moduleAnchor}`}
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const totalAttachmentCount = remainingAttachmentCount + files.length
        const nextAttachmentError = attachmentCountError(totalAttachmentCount)
        if (nextAttachmentError) {
          setAttachmentError(nextAttachmentError)
          return
        }
        setAttachmentError('')
        onSubmit({
          title: sanitizePlainText(form.get('title')),
          description: sanitizePlainText(form.get('description')),
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
          maxLength={MAX_TICKET_TITLE_LENGTH}
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
          maxLength={MAX_TICKET_TEXT_LENGTH}
        />
        {fieldErrors?.description ? (
          <em className="field-error">{fieldErrors.description}</em>
        ) : null}
      </label>

      <label className="field">
        <span>Priority</span>
        <AppSelect
          name="priority"
          defaultValue={initialValues?.priority ?? priorities[0]?.code ?? ''}
          required
          options={[
            ...(priorities.length === 0 ? [{ value: '', label: 'No priorities available' }] : []),
            ...(currentInactivePriority ? [{ value: currentInactivePriority.code, label: currentInactivePriority.name }] : []),
            ...priorities.map((priority) => ({ value: priority.code, label: priority.name })),
          ]}
        />
        {fieldErrors?.priority ? (
          <em className="field-error">{fieldErrors.priority}</em>
        ) : null}
      </label>

      <label className="field">
        <span>Department</span>
        <AppSelect
          name="departmentId"
          defaultValue={defaultDepartmentId}
          required
          disabled={departments.length === 0}
          options={[
            ...(departments.length === 0 ? [{ value: '', label: 'No departments available' }] : []),
            ...departments.map((department) => ({ value: department.departmentId, label: department.name })),
          ]}
        />
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
          <span>Attachments <small>(optional, up to 5 files total)</small></span>
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
          <FilePicker
            onChange={handleFilesChange}
            maxFiles={maxNewFiles}
            disabled={submitting}
          />
          {attachmentError ? <em className="field-error">{attachmentError}</em> : null}
        </div>
      ) : null}

      {error ? <p className="banner error">{error}</p> : null}

      <div className="form-actions">
        {onCancel ? (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn primary" disabled={submitting || departments.length === 0 || priorities.length === 0}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}


