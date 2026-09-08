import { randomUUID } from 'crypto';
import { Department } from '../departments/entities/department.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { User } from '../users/entities/user.entity';

export class InMemoryDatabase {
  users: User[] = [];
  departments: Department[] = [];
  tickets: Ticket[] = [];
  ticketSequence = 0;

  constructor() {
    this.seed();
  }

  private seed(): void {
    const now = new Date();
    const identityProviderId = randomUUID();

    this.departments = [
      this.department('dept-it', 'IT', 'Information Technology', now),
      this.department('dept-hr', 'HR', 'Human Resources', now),
    ];

    this.users = [
      this.user('user-employee-1', 'alex@company.com', 'Alex Employee', identityProviderId, now),
      this.user('user-employee-2', 'sam@company.com', 'Sam Employee', identityProviderId, now),
      this.user('user-agent-1', 'jordan@company.com', 'Jordan Agent', identityProviderId, now),
      this.user('user-agent-2', 'taylor@company.com', 'Taylor Agent', identityProviderId, now),
    ];
  }

  private department(
    departmentId: string,
    code: string,
    name: string,
    now: Date,
  ): Department {
    return {
      departmentId,
      code,
      name,
      desc: `${name} department`,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  private user(
    userId: string,
    email: string,
    fullName: string,
    identityProviderId: string,
    now: Date,
  ): User {
    return {
      userId,
      email,
      fullName,
      phoneNumber: null,
      role: 'Employee',
      isActive: true,
      hasLogged: false,
      identityProviderId,
      createdAt: now,
      updatedAt: now,
    };
  }
}
