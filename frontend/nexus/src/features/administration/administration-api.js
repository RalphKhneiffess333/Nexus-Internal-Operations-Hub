import { apiRequest } from '../../lib/api/client'

export function getAdminUsers(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return apiRequest(`/admin/users${query.toString() ? `?${query}` : ''}`)
}

export function getAdminUser(userId) {
  return apiRequest(`/admin/users/${userId}`)
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

export function getAuditLogs(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return apiRequest(`/admin/audit-logs${query.toString() ? `?${query}` : ''}`)
}

export function getAdminTicketEvents(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, value)
  })
  return apiRequest(`/admin/audit-logs/ticket-events${query.toString() ? `?${query}` : ''}`)
}
