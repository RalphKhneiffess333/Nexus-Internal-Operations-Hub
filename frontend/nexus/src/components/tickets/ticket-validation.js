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
