import { PrismaClient, UserRole } from '@prisma/client';

export const SEED_IDENTITY_PROVIDER_ID = 'idp-entra';
export const EMPLOYEE_ID = 'user-employee-1';
export const EMPLOYEE_2_ID = 'user-employee-2';
export const AGENT_ID = 'user-agent-1';
export const AGENT_2_ID = 'user-agent-2';
export const IT_AGENT_2_ID = 'user-it-agent-2';
export const HR_AGENT_2_ID = 'user-hr-agent-2';
export const ADMIN_ID = 'user-admin-1';
export const IT_DEPARTMENT_ID = 'dept-it';
export const HR_DEPARTMENT_ID = 'dept-hr';
export const TEST_USER_IDS = [
  EMPLOYEE_ID,
  EMPLOYEE_2_ID,
  AGENT_ID,
  IT_AGENT_2_ID,
  AGENT_2_ID,
  HR_AGENT_2_ID,
  ADMIN_ID,
] as const;

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.identityProvider.upsert({
    where: { identityProviderId: SEED_IDENTITY_PROVIDER_ID },
    update: {
      code: 'MICROSOFT_ENTRA_ID',
      name: 'Microsoft Entra ID',
      active: true,
    },
    create: {
      identityProviderId: SEED_IDENTITY_PROVIDER_ID,
      code: 'MICROSOFT_ENTRA_ID',
      name: 'Microsoft Entra ID',
      active: true,
    },
  });

  await prisma.department.upsert({
    where: { departmentId: IT_DEPARTMENT_ID },
    update: {},
    create: {
      departmentId: IT_DEPARTMENT_ID,
      code: 'IT',
      name: 'Information Technology',
      desc: 'Information Technology department',
      active: true,
    },
  });

  await prisma.department.upsert({
    where: { departmentId: HR_DEPARTMENT_ID },
    update: {},
    create: {
      departmentId: HR_DEPARTMENT_ID,
      code: 'HR',
      name: 'Human Resources',
      desc: 'Human Resources department',
      active: true,
    },
  });

  const configurations = [
    [
      'REMINDER_INTERVAL_LOW_MINUTES',
      '240',
      'Reminder interval for LOW tickets in minutes',
    ],
    [
      'REMINDER_INTERVAL_MODERATE_MINUTES',
      '240',
      'Reminder interval for MODERATE tickets in minutes',
    ],
    [
      'REMINDER_INTERVAL_HIGH_MINUTES',
      '240',
      'Reminder interval for HIGH tickets in minutes',
    ],
  ] as const;
  for (const [key, value, description] of configurations) {
    await prisma.systemConfiguration.upsert({
      where: { key },
      update: { description },
      create: {
        configurationId: `config-${key.toLowerCase()}`,
        key,
        value,
        description,
      },
    });
  }
}

export async function seedTestDatabase(prisma: PrismaClient): Promise<void> {
  await seedDatabase(prisma);

  await seedTestUsers(prisma);
  await seedTestDepartmentMembers(prisma);
}

async function seedTestUsers(prisma: PrismaClient): Promise<void> {
  const users: Array<{
    userId: string;
    email: string;
    fullName: string;
    role: UserRole;
  }> = [
    {
      userId: EMPLOYEE_ID,
      email: 'alex@company.com',
      fullName: 'Employee 1',
      role: UserRole.Employee,
    },
    {
      userId: EMPLOYEE_2_ID,
      email: 'sam@company.com',
      fullName: 'Employee 2',
      role: UserRole.Employee,
    },
    {
      userId: AGENT_ID,
      email: 'jordan@company.com',
      fullName: 'IT Agent 1',
      role: UserRole.Agent,
    },
    {
      userId: IT_AGENT_2_ID,
      email: 'it-agent-2@company.com',
      fullName: 'IT Agent 2',
      role: UserRole.Agent,
    },
    {
      userId: AGENT_2_ID,
      email: 'taylor@company.com',
      fullName: 'HR Agent 1',
      role: UserRole.Agent,
    },
    {
      userId: HR_AGENT_2_ID,
      email: 'hr-agent-2@company.com',
      fullName: 'HR Agent 2',
      role: UserRole.Agent,
    },
    {
      userId: ADMIN_ID,
      email: 'morgan@company.com',
      fullName: 'Admin',
      role: UserRole.Admin,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { userId: user.userId },
      update: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: true,
      },
      create: {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: null,
        role: user.role,
        isActive: true,
        hasLogged: false,
        identityProviderId: SEED_IDENTITY_PROVIDER_ID,
        identityProviderUserId: null,
      },
    });
  }
}

async function seedTestDepartmentMembers(prisma: PrismaClient): Promise<void> {
  const memberships = [
    {
      departmentMemberId: 'dept-member-it-agent-1',
      userId: AGENT_ID,
      departmentId: IT_DEPARTMENT_ID,
    },
    {
      departmentMemberId: 'dept-member-it-agent-2',
      userId: IT_AGENT_2_ID,
      departmentId: IT_DEPARTMENT_ID,
    },
    {
      departmentMemberId: 'dept-member-hr-agent-1',
      userId: AGENT_2_ID,
      departmentId: HR_DEPARTMENT_ID,
    },
    {
      departmentMemberId: 'dept-member-hr-agent-2',
      userId: HR_AGENT_2_ID,
      departmentId: HR_DEPARTMENT_ID,
    },
    {
      departmentMemberId: 'dept-member-admin-it',
      userId: ADMIN_ID,
      departmentId: IT_DEPARTMENT_ID,
    },
  ];

  await prisma.departmentMember.deleteMany({
    where: { userId: { in: [...TEST_USER_IDS] } },
  });
  await prisma.departmentMember.createMany({ data: memberships });
}

export async function resetTicketData(prisma: PrismaClient): Promise<void> {
  await prisma.handoffRequest.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.file.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.ticketEvent.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE ticket_code_seq RESTART WITH 1`,
  );
}
