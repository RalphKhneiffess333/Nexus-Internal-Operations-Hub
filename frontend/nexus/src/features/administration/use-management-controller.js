import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addUserDepartment,
  createAdminDepartment,
  createAdminPriority,
  createAdminUser,
  deactivateAdminDepartment,
  deactivateAdminPriority,
  getAdminDepartments,
  getAdminPriorities,
  getAdminUsers,
  reactivateAdminDepartment,
  reactivateAdminPriority,
  removeUserDepartment,
  updateAdminDepartment,
  updateAdminPriority,
  updateAdminUserRole,
  updateAdminUserStatus,
} from './administration-api'
import { useLatestRequest } from '../../lib/api/use-latest-request'
import { useManagementQueryState } from './use-management-query-state'

function messageFor(error, fallback) {
  return error?.message || fallback
}

export function useManagementController() {
  const query = useManagementQueryState()
  const {
    section,
    userPage,
    userSearch,
    userStatus,
    userDepartmentId,
    userHasLogged,
    departmentPage,
    departmentSearch,
  } = query
  const [users, setUsers] = useState([])
  const [userTotal, setUserTotal] = useState(0)
  const [departments, setDepartments] = useState([])
  const [departmentTotal, setDepartmentTotal] = useState(0)
  const [departmentOptions, setDepartmentOptions] = useState([])
  const [priorities, setPriorities] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const departmentOptionsLoaded = useRef(false)
  const { beginRequest } = useLatestRequest()

  const loadData = useCallback(async () => {
    const request = beginRequest()
    setLoading(true)
    setError('')
    try {
      if (section === 'users') {
        const [userResult, departmentResult] = await Promise.all([
          getAdminUsers({
            page: userPage,
            pageSize: 25,
            search: userSearch,
            status: userStatus,
            departmentId: userDepartmentId,
            hasLogged: userHasLogged,
          }, { signal: request.controller.signal }),
          departmentOptionsLoaded.current
            ? Promise.resolve(null)
            : getAdminDepartments(
              { page: 1, pageSize: 100 },
              { signal: request.controller.signal },
            ),
        ])
        if (!request.isCurrent()) return
        setUsers(userResult?.items ?? [])
        setUserTotal(userResult?.total ?? 0)
        if (departmentResult) {
          setDepartmentOptions(departmentResult.items ?? [])
          departmentOptionsLoaded.current = true
        }
      } else if (section === 'departments') {
        const departmentResult = await getAdminDepartments(
          { page: departmentPage, pageSize: 25, search: departmentSearch },
          { signal: request.controller.signal },
        )
        if (!request.isCurrent()) return
        setDepartments(departmentResult?.items ?? [])
        setDepartmentTotal(departmentResult?.total ?? 0)
      } else {
        const priorityResult = await getAdminPriorities({ signal: request.controller.signal })
        if (!request.isCurrent()) return
        setPriorities(priorityResult ?? [])
      }
    } catch (loadError) {
      if (!request.isCurrent()) return
      setError(messageFor(loadError, 'Unable to load management data.'))
    } finally {
      if (request.isCurrent()) setLoading(false)
    }
  }, [beginRequest, departmentPage, departmentSearch, section, userDepartmentId, userHasLogged, userPage, userSearch, userStatus])

  useEffect(() => {
    // The controller owns synchronization for the selected section and filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const runMutation = useCallback(async (mutation, successMessage) => {
    setError('')
    setNotice('')
    try {
      const result = await mutation()
      setNotice(successMessage)
      departmentOptionsLoaded.current = false
      await loadData()
      return result ?? true
    } catch (mutationError) {
      setError(messageFor(mutationError, 'The change could not be saved.'))
      return null
    }
  }, [loadData])

  const createUser = useCallback(
    (data) => runMutation(() => createAdminUser(data), 'User pre-provisioned.'),
    [runMutation],
  )
  const updateUserRole = useCallback(
    (userId, role) => runMutation(() => updateAdminUserRole(userId, role), 'User role updated.'),
    [runMutation],
  )
  const updateUserStatus = useCallback(
    (userId, active) => runMutation(
      () => updateAdminUserStatus(userId, active),
      `User ${active ? 'reactivated' : 'deactivated'}.`,
    ),
    [runMutation],
  )
  const updateUserDepartment = useCallback((userId, departmentId, member, departmentName) => runMutation(
    () => member
      ? removeUserDepartment(userId, departmentId)
      : addUserDepartment(userId, departmentId),
    `${departmentName} membership updated.`,
  ), [runMutation])
  const saveDepartment = useCallback((department, data) => runMutation(
    () => department
      ? updateAdminDepartment(department.departmentId, data)
      : createAdminDepartment(data),
    department ? 'Department updated.' : 'Department created.',
  ), [runMutation])
  const updateDepartmentStatus = useCallback((departmentId, active) => runMutation(
    () => active
      ? reactivateAdminDepartment(departmentId)
      : deactivateAdminDepartment(departmentId),
    `Department ${active ? 'reactivated' : 'deactivated'}.`,
  ), [runMutation])
  const savePriority = useCallback((priority, data) => runMutation(
    () => priority
      ? updateAdminPriority(priority.priorityId, data)
      : createAdminPriority(data),
    priority ? 'Priority updated.' : 'Priority created.',
  ), [runMutation])
  const updatePriorityStatus = useCallback((priorityId, active) => runMutation(
    () => active
      ? reactivateAdminPriority(priorityId)
      : deactivateAdminPriority(priorityId),
    `Priority ${active ? 'reactivated' : 'deactivated'}.`,
  ), [runMutation])

  return {
    section,
    users: {
      items: users,
      total: userTotal,
      page: userPage,
      filters: {
        search: userSearch,
        status: userStatus,
        departmentId: userDepartmentId,
        hasLogged: userHasLogged,
      },
      departments: departmentOptions,
      selectedUserId,
      showCreate: showCreateUser,
    },
    departments: {
      items: departments,
      total: departmentTotal,
      page: departmentPage,
      search: departmentSearch,
    },
    priorities: { items: priorities },
    loading,
    error,
    notice,
    actions: {
      reload: loadData,
      updateSection: query.updateSection,
      updateUserFilter: query.updateUserFilter,
      updateDepartmentFilter: query.updateDepartmentFilter,
      updateUserPage: query.updateUserPage,
      updateDepartmentPage: query.updateDepartmentPage,
      selectUser: setSelectedUserId,
      setShowCreateUser,
      createUser,
      updateUserRole,
      updateUserStatus,
      updateUserDepartment,
      saveDepartment,
      updateDepartmentStatus,
      savePriority,
      updatePriorityStatus,
    },
  }
}
