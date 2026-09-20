export const MAX_TICKET_TITLE_LENGTH = 200
export const MAX_TICKET_TEXT_LENGTH = 10000
export const MAX_CHAT_MESSAGE_LENGTH = 4000

export function validateTicketFields(values, { requireSubmittedBy = false } = {}) {
  const fieldErrors = {}

  if (!values.title) {
    fieldErrors.title = 'Title is required.'
  }
  if (!values.description) {
    fieldErrors.description = 'Description is required.'
  } else if (values.description.length > MAX_TICKET_TEXT_LENGTH) {
    fieldErrors.description = `Description must be ${MAX_TICKET_TEXT_LENGTH} characters or fewer.`
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
