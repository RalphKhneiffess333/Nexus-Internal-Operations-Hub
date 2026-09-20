import { apiRequest } from '../../lib/api/client'

export function getAdminUsers(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return apiRequest(`/admin/users${query.toString() ? `?${query}` : ''}`)
}

export function createAdminUser(data) {
  return apiRequest('/admin/users', { method: 'POST', body: data })
}

export function updateAdminUserRole(userId, role) {
  return apiRequest(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: { role },
  })
}

export function updateAdminUserStatus(userId, active) {
  return apiRequest(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: { active },
  })
}

export function addUserDepartment(userId, departmentId) {
  return apiRequest(`/admin/users/${userId}/departments/${departmentId}`, {
    method: 'POST',
  })
}

export function removeUserDepartment(userId, departmentId) {
  return apiRequest(`/admin/users/${userId}/departments/${departmentId}`, {
    method: 'DELETE',
  })
}

export function getAdminDepartments(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return apiRequest(`/admin/departments${query.toString() ? `?${query}` : ''}`)
}

export function createAdminDepartment(data) {
  return apiRequest('/admin/departments', { method: 'POST', body: data })
}

export function updateAdminDepartment(departmentId, data) {
  return apiRequest(`/admin/departments/${departmentId}`, {
    method: 'PATCH',
    body: data,
  })
}

export function deactivateAdminDepartment(departmentId) {
  return apiRequest(`/admin/departments/${departmentId}`, { method: 'DELETE' })
}

export function reactivateAdminDepartment(departmentId) {
  return apiRequest(`/admin/departments/${departmentId}/reactivate`, {
    method: 'POST',
  })
}

export function getAdminConfigurations() {
  return apiRequest('/admin/configurations')
}

export function updateAdminConfiguration(key, value) {
  return apiRequest(`/admin/configurations/${key}`, {
    method: 'PATCH',
    body: { value },
  })
}

export function getAdminActivity(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return apiRequest(`/admin/audit-logs/activity${query.toString() ? `?${query}` : ''}`)
}

export function getAdminPriorities() {
  return apiRequest('/admin/priorities')
}

export function createAdminPriority(data) {
  return apiRequest('/admin/priorities', { method: 'POST', body: data })
}

export function updateAdminPriority(priorityId, data) {
  return apiRequest(`/admin/priorities/${priorityId}`, {
    method: 'PATCH',
    body: data,
  })
}

export function deactivateAdminPriority(priorityId) {
  return apiRequest(`/admin/priorities/${priorityId}`, { method: 'DELETE' })
}

export function reactivateAdminPriority(priorityId) {
  return apiRequest(`/admin/priorities/${priorityId}/reactivate`, {
    method: 'POST',
  })
}

export function getAdminDepartmentMembers(departmentId, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return apiRequest(`/admin/departments/${departmentId}/members${query.toString() ? `?${query}` : ''}`)
}

export function getAuditLog(auditLogId) {
  return apiRequest(`/admin/audit-logs/${auditLogId}`)
}

export function getAdminTicketEvent(ticketId, ticketEventId) {
  return apiRequest(`/tickets/${ticketId}/events/${ticketEventId}`)
}
