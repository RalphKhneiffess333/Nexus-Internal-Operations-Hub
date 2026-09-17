import { PrismaClient, UserRole } from '@prisma/client';

export const SEED_IDENTITY_PROVIDER_ID = 'idp-entra';
export const EMPLOYEE_ID = 'user-employee-1';
export const EMPLOYEE_2_ID = 'user-employee-2';
export const AGENT_ID = 'user-agent-1';
export const AGENT_2_ID = 'user-agent-2';
export const ADMIN_ID = 'user-admin-1';
export const IT_DEPARTMENT_ID = 'dept-it';
export const HR_DEPARTMENT_ID = 'dept-hr';

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
      fullName: 'Alex Employee',
      role: UserRole.Employee,
    },
    {
      userId: EMPLOYEE_2_ID,
      email: 'sam@company.com',
      fullName: 'Sam Employee',
      role: UserRole.Employee,
    },
    {
      userId: AGENT_ID,
      email: 'jordan@company.com',
      fullName: 'Jordan Agent',
      role: UserRole.Agent,
    },
    {
      userId: AGENT_2_ID,
      email: 'taylor@company.com',
      fullName: 'Taylor Agent',
      role: UserRole.Agent,
    },
    {
      userId: ADMIN_ID,
      email: 'morgan@company.com',
      fullName: 'Morgan Admin',
      role: UserRole.Admin,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { userId: user.userId },
      update: {},
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
  await prisma.departmentMember.upsert({
    where: {
      userId_departmentId: {
        userId: AGENT_ID,
        departmentId: IT_DEPARTMENT_ID,
      },
    },
    update: {},
    create: {
      departmentMemberId: 'dept-member-agent-it',
      userId: AGENT_ID,
      departmentId: IT_DEPARTMENT_ID,
    },
  });

  await prisma.departmentMember.upsert({
    where: {
      userId_departmentId: {
        userId: AGENT_2_ID,
        departmentId: HR_DEPARTMENT_ID,
      },
    },
    update: {},
    create: {
      departmentMemberId: 'dept-member-agent-hr',
      userId: AGENT_2_ID,
      departmentId: HR_DEPARTMENT_ID,
    },
  });

  await prisma.departmentMember.upsert({
    where: {
      userId_departmentId: {
        userId: ADMIN_ID,
        departmentId: IT_DEPARTMENT_ID,
      },
    },
    update: {},
    create: {
      departmentMemberId: 'dept-member-admin-it',
      userId: ADMIN_ID,
      departmentId: IT_DEPARTMENT_ID,
    },
  });
}

export async function resetTicketData(prisma: PrismaClient): Promise<void> {
  await prisma.ticket.deleteMany();
  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE ticket_code_seq RESTART WITH 1`,
  );
}
