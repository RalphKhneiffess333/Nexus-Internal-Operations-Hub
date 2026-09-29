import { UserRole } from '@prisma/client';
import { describe, beforeEach, expect, it, jest } from '@jest/globals';
import type { AuthenticatedRequestUser } from '../authentication/request-user';
import { DepartmentsService } from '../departments/departments.service';
import { PrioritiesService } from '../priorities/priorities.service';
import { SubmissionContextService } from './submission-context.service';

describe('SubmissionContextService', () => {
  let departments: jest.Mocked<Pick<DepartmentsService, 'findAll'>>;
  let priorities: jest.Mocked<Pick<PrioritiesService, 'list'>>;
  let service: SubmissionContextService;

  const actor: AuthenticatedRequestUser = {
    userId: 'user-1',
    email: 'employee@example.com',
    fullName: 'Employee One',
    phoneNumber: null,
    role: UserRole.Employee,
    isActive: true,
    hasLogged: true,
    identityProviderId: 'idp-1',
    identityProviderUserId: 'external-user-1',
  };

  beforeEach(() => {
    departments = {
      findAll: jest.fn<DepartmentsService['findAll']>(),
    };
    priorities = {
      list: jest.fn<PrioritiesService['list']>(),
    };
    service = new SubmissionContextService(
      departments as unknown as DepartmentsService,
      priorities as unknown as PrioritiesService,
    );
  });

  it('loads only the fields needed by the assistant and preserves authorization scope', async () => {
    departments.findAll.mockResolvedValue([
      {
        departmentId: 'department-it',
        code: 'IT',
        name: 'Information Technology',
        active: true,
      },
    ]);
    priorities.list.mockResolvedValue([
      {
        priorityId: 'priority-high',
        code: 'HIGH',
        name: 'High',
        reminderIntervalMinutes: 60,
        active: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    await expect(service.load(actor)).resolves.toEqual({
      departments: [
        {
          id: 'department-it',
          code: 'IT',
          name: 'Information Technology',
        },
      ],
      priorities: [{ id: 'priority-high', code: 'HIGH', name: 'High' }],
    });

    expect(departments.findAll).toHaveBeenCalledWith(actor, 'all');
    expect(priorities.list).toHaveBeenCalledWith(true);
  });
});
