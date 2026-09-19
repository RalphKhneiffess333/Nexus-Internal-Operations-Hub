import { checkbox, input, select } from '@inquirer/prompts';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  ADMINISTRATION_DEPARTMENT_CODE,
  ADMINISTRATION_DEPARTMENT_ID,
} from '../departments/department.constants';

type IdentityProvider = {
  identityProviderId: string;
  name: string;
  code: string;
};

type Department = {
  departmentId: string;
  code: string;
  name: string;
};

type UserWithDepartments = Prisma.UserGetPayload<{
  include: {
    identityProvider: true;
    departmentMembers: {
      include: {
        department: true;
      };
    };
  };
}>;

class CliMessage extends Error {}

class CliExit extends Error {}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main(): Promise<void> {
  loadEnvironment();

  const prisma = new PrismaClient();

  try {
    await connectToDatabase(prisma);
    await confirmDatabaseMutation();
    await runMainMenu(prisma);
  } catch (error) {
    if (isPromptCancellation(error) || error instanceof CliExit) {
      console.log('\nExiting without further changes.');
      return;
    }

    reportError(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

function loadEnvironment(): void {
  const envPath = resolve(__dirname, '../../.env');
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  } else {
    config({ override: false });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new CliMessage(
      'DATABASE_URL is not configured. Set it in the environment or backend/.env before running this command.',
    );
  }
}

async function connectToDatabase(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      throw new CliMessage(
        'Could not connect to the database. Check DATABASE_URL and make sure the database is reachable.',
      );
    }

    throw error;
  }
}

async function confirmDatabaseMutation(): Promise<void> {
  const action = await select({
    message:
      'Before continuing, make sure your environment is connected to the correct database. This command will create or modify user records.\n\nAre you sure you want to continue?',
    choices: [
      { name: 'Continue', value: 'continue' },
      { name: 'Exit', value: 'exit' },
    ],
  });

  if (action === 'exit') {
    throw new CliExit();
  }
}

async function runMainMenu(prisma: PrismaClient): Promise<void> {
  while (true) {
    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: 'Add a new user', value: 'add' },
        { name: 'Modify an existing user', value: 'modify' },
        { name: 'Exit', value: 'exit' },
      ],
    });

    if (action === 'exit') {
      return;
    }

    try {
      if (action === 'add') {
        await addUser(prisma);
      } else {
        await modifyUser(prisma);
      }
    } catch (error) {
      if (isPromptCancellation(error)) {
        throw error;
      }

      reportError(error);
    }

    console.log('');
  }
}

async function addUser(prisma: PrismaClient): Promise<void> {
  const identityProvider = await selectIdentityProvider(prisma);
  const email = await promptEmail();

  const existingUser = await findUserByProviderAndEmail(
    prisma,
    identityProvider.identityProviderId,
    email,
  );
  if (existingUser) {
    console.log(
      `\nA user already exists for ${identityProvider.name} and ${email}. No user was created.`,
    );
    return;
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email },
    include: { identityProvider: true },
  });
  if (existingEmail) {
    console.log(
      `\nA user with ${email} already exists under ${existingEmail.identityProvider.name}. No user was created.`,
    );
    return;
  }

  const firstName = await promptRequiredText("Enter the user's first name:");
  const lastName = await promptRequiredText("Enter the user's last name:");
  const fullName = `${firstName} ${lastName}`;
  const role = await promptRole();
  const departments = roleUsesDepartments(role)
    ? await promptDepartments(prisma, [])
    : [];

  console.log('\nPlease review the new user:');
  printUserSummary({
    fullName,
    email,
    identityProviderName: identityProvider.name,
    role,
    departments,
  });

  const action = await select({
    message: 'Create this user?',
    choices: [
      { name: 'Create user', value: 'create' },
      { name: 'Cancel', value: 'cancel' },
    ],
  });

  if (action === 'cancel') {
    console.log('\nUser creation cancelled. No changes were made.');
    return;
  }

  const created = await prisma.$transaction(async (tx) => {
    const userId = randomUUID();
    const user = await tx.user.create({
      data: {
        userId,
        email,
        fullName,
        phoneNumber: null,
        role,
        isActive: true,
        hasLogged: false,
        identityProviderId: identityProvider.identityProviderId,
        identityProviderUserId: null,
      },
    });

    await createDepartmentMemberships(
      tx,
      user.userId,
      departments.map((department) => department.departmentId),
    );
    if (role === UserRole.Admin) {
      await ensureAdministrationMembership(tx, user.userId);
    }

    return user;
  });

  console.log('\nUser created successfully.');
  printUserSummary({
    fullName: created.fullName,
    email: created.email,
    identityProviderName: identityProvider.name,
    role: created.role,
    departments,
  });
}

async function modifyUser(prisma: PrismaClient): Promise<void> {
  const identityProvider = await selectIdentityProvider(prisma);
  const email = await promptEmail();
  const user = await findUserByProviderAndEmail(
    prisma,
    identityProvider.identityProviderId,
    email,
  );

  if (!user) {
    console.log(
      '\nNo user was found for this identity provider and email address.\nPlease verify the identity provider and email, then try again.',
    );
    return;
  }

  console.log('\nUser found:');
  printExistingUserSummary(user);

  const actionChoices =
    user.role === UserRole.Employee
      ? [
          { name: 'Change role', value: 'role' },
          { name: 'Cancel', value: 'cancel' },
        ]
      : [
          { name: 'Change role', value: 'role' },
          { name: 'Change departments', value: 'departments' },
          { name: 'Cancel', value: 'cancel' },
        ];

  const action = await select({
    message: 'What would you like to modify?',
    choices: actionChoices,
  });

  if (action === 'cancel') {
    console.log('\nNo changes were made.');
    return;
  }

  if (action === 'role') {
    await changeUserRole(prisma, user);
    return;
  }

  await changeUserDepartments(prisma, user);
}

async function changeUserRole(
  prisma: PrismaClient,
  user: UserWithDepartments,
): Promise<void> {
  const currentDepartments = getDepartments(user);
  const newRole = await promptRole(user.role);
  const newDepartments = roleUsesDepartments(newRole)
    ? await promptDepartments(
        prisma,
        currentDepartments.map((department) => department.departmentId),
      )
    : [];

  console.log('\nReview the changes below before continuing:');
  printBeforeAfter({
    beforeRole: user.role,
    beforeDepartments: currentDepartments,
    afterRole: newRole,
    afterDepartments: newDepartments,
  });

  if (!(await confirmApplyChanges())) {
    console.log('\nRole change cancelled. No changes were made.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { userId: user.userId },
      data: { role: newRole },
    });
    await syncDepartmentMemberships(
      tx,
      user.userId,
      newDepartments.map((department) => department.departmentId),
    );
  });

  console.log('\nUser updated successfully.');
}

async function changeUserDepartments(
  prisma: PrismaClient,
  user: UserWithDepartments,
): Promise<void> {
  const currentDepartments = getDepartments(user);
  const newDepartments = await promptDepartments(
    prisma,
    currentDepartments.map((department) => department.departmentId),
  );

  console.log('\nReview the changes below before continuing:');
  printBeforeAfter({
    beforeRole: user.role,
    beforeDepartments: currentDepartments,
    afterRole: user.role,
    afterDepartments: newDepartments,
  });

  if (!(await confirmApplyChanges())) {
    console.log('\nDepartment change cancelled. No changes were made.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await syncDepartmentMemberships(
      tx,
      user.userId,
      newDepartments.map((department) => department.departmentId),
    );
  });

  console.log('\nUser updated successfully.');
}

async function selectIdentityProvider(
  prisma: PrismaClient,
): Promise<IdentityProvider> {
  const identityProviders = await prisma.identityProvider.findMany({
    where: { active: true },
    orderBy: [{ name: 'asc' }, { code: 'asc' }],
    select: {
      identityProviderId: true,
      name: true,
      code: true,
    },
  });

  if (identityProviders.length === 0) {
    throw new CliMessage(
      'No active identity providers are configured. Seed or create an identity provider before managing users.',
    );
  }

  return select({
    message: 'Which identity provider should this user authenticate through?',
    choices: identityProviders.map((identityProvider) => ({
      name: `${identityProvider.name} (${identityProvider.code})`,
      value: identityProvider,
    })),
  });
}

async function promptEmail(): Promise<string> {
  const answer = await input({
    message: "Enter the user's work email address:",
    validate: (value) => {
      const email = normalizeEmail(value);
      if (!email) {
        return 'Email is required.';
      }

      if (!emailPattern.test(email)) {
        return 'Enter a valid email address.';
      }

      return true;
    },
  });

  return normalizeEmail(answer);
}

async function promptRequiredText(message: string): Promise<string> {
  const answer = await input({
    message,
    validate: (value) => {
      if (!value.trim()) {
        return 'This field is required.';
      }

      return true;
    },
  });

  return answer.trim();
}

async function promptRole(currentRole?: UserRole): Promise<UserRole> {
  const roles = Object.values(UserRole);

  return select<UserRole>({
    message: 'What role should this user have?',
    default: currentRole,
    choices: roles.map((role) => ({
      name: formatRole(role),
      value: role,
    })),
  });
}

async function promptDepartments(
  prisma: PrismaClient,
  selectedDepartmentIds: string[],
): Promise<Department[]> {
  const departments = await prisma.department.findMany({
    where: { active: true },
    orderBy: [{ name: 'asc' }, { code: 'asc' }],
    select: {
      departmentId: true,
      code: true,
      name: true,
    },
  });

  if (departments.length === 0) {
    console.log(
      '\nNo active departments are configured. The user will have no department memberships.',
    );
    return [];
  }

  const selectableDepartments = departments.filter(
    (department) => department.code !== ADMINISTRATION_DEPARTMENT_CODE,
  );
  const selected = await checkbox<string>({
    message: 'Which departments should this user belong to?',
    required: false,
    choices: selectableDepartments.map((department) => ({
      name: formatDepartment(department),
      value: department.departmentId,
      checked: selectedDepartmentIds.includes(department.departmentId),
    })),
  });

  const selectedIds = new Set(selected);
  return selectableDepartments.filter((department) =>
    selectedIds.has(department.departmentId),
  );
}

async function confirmApplyChanges(): Promise<boolean> {
  const action = await select({
    message: 'Apply these changes?',
    choices: [
      { name: 'Apply changes', value: 'apply' },
      { name: 'Cancel', value: 'cancel' },
    ],
  });

  return action === 'apply';
}

async function findUserByProviderAndEmail(
  prisma: PrismaClient,
  identityProviderId: string,
  email: string,
): Promise<UserWithDepartments | null> {
  return prisma.user.findFirst({
    where: {
      identityProviderId,
      email,
    },
    include: {
      identityProvider: true,
      departmentMembers: {
        include: {
          department: true,
        },
        orderBy: {
          department: {
            name: 'asc',
          },
        },
      },
    },
  });
}

async function createDepartmentMemberships(
  tx: Prisma.TransactionClient,
  userId: string,
  departmentIds: string[],
): Promise<void> {
  for (const departmentId of departmentIds) {
    await tx.departmentMember.create({
      data: {
        departmentMemberId: randomUUID(),
        userId,
        departmentId,
      },
    });
  }
}

async function syncDepartmentMemberships(
  tx: Prisma.TransactionClient,
  userId: string,
  desiredDepartmentIds: string[],
): Promise<void> {
  const currentMemberships = await tx.departmentMember.findMany({
    where: { userId },
    select: { departmentId: true },
  });

  const currentIds = new Set(
    currentMemberships.map((membership) => membership.departmentId),
  );
  const desiredIds = new Set(desiredDepartmentIds);
  const user = await tx.user.findUnique({
    where: { userId },
    select: { role: true },
  });
  if (user?.role === UserRole.Admin) {
    desiredIds.add(ADMINISTRATION_DEPARTMENT_ID);
  }

  const departmentIdsToRemove = [...currentIds].filter(
    (departmentId) => !desiredIds.has(departmentId),
  );
  const departmentIdsToAdd = [...desiredIds].filter(
    (departmentId) => !currentIds.has(departmentId),
  );

  if (departmentIdsToRemove.length > 0) {
    await tx.departmentMember.deleteMany({
      where: {
        userId,
        departmentId: { in: departmentIdsToRemove },
      },
    });
  }

  await createDepartmentMemberships(tx, userId, departmentIdsToAdd);
}

async function ensureAdministrationMembership(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const department = await tx.department.findUnique({
    where: { departmentId: ADMINISTRATION_DEPARTMENT_ID },
  });
  if (
    !department ||
    department.code !== ADMINISTRATION_DEPARTMENT_CODE ||
    !department.active
  ) {
    throw new CliMessage(
      'The Administration department is not configured or active.',
    );
  }
  await tx.departmentMember.upsert({
    where: {
      userId_departmentId: {
        userId,
        departmentId: ADMINISTRATION_DEPARTMENT_ID,
      },
    },
    create: {
      departmentMemberId: randomUUID(),
      userId,
      departmentId: ADMINISTRATION_DEPARTMENT_ID,
    },
    update: {},
  });
}

function getDepartments(user: UserWithDepartments): Department[] {
  return user.departmentMembers.map((membership) => ({
    departmentId: membership.department.departmentId,
    code: membership.department.code,
    name: membership.department.name,
  }));
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function roleUsesDepartments(role: UserRole): boolean {
  return role === UserRole.Agent || role === UserRole.Admin;
}

function formatRole(role: UserRole): string {
  return role;
}

function formatDepartment(department: Department): string {
  return `${department.name} (${department.code})`;
}

function formatDepartments(departments: Department[]): string {
  if (departments.length === 0) {
    return 'None';
  }

  return departments.map(formatDepartment).join(', ');
}

function printExistingUserSummary(user: UserWithDepartments): void {
  printUserSummary({
    fullName: user.fullName,
    email: user.email,
    identityProviderName: user.identityProvider.name,
    role: user.role,
    departments: getDepartments(user),
  });
}

function printUserSummary(summary: {
  fullName: string;
  email: string;
  identityProviderName: string;
  role: UserRole;
  departments: Department[];
}): void {
  console.log(`Name: ${summary.fullName}`);
  console.log(`Email: ${summary.email}`);
  console.log(`Identity Provider: ${summary.identityProviderName}`);
  console.log(`Role: ${formatRole(summary.role)}`);
  console.log(`Departments: ${formatDepartments(summary.departments)}`);
}

function printBeforeAfter(change: {
  beforeRole: UserRole;
  beforeDepartments: Department[];
  afterRole: UserRole;
  afterDepartments: Department[];
}): void {
  console.log(`Before role: ${formatRole(change.beforeRole)}`);
  console.log(`After role: ${formatRole(change.afterRole)}`);
  console.log(
    `Before departments: ${formatDepartments(change.beforeDepartments)}`,
  );
  console.log(
    `After departments: ${formatDepartments(change.afterDepartments)}`,
  );
}

function isPromptCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ExitPromptError' ||
      error.message.includes('User force closed the prompt'))
  );
}

function isDatabaseConnectionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P1001', 'P1002', 'P1017'].includes(error.code))
  );
}

function reportError(error: unknown): void {
  if (error instanceof CliMessage) {
    console.error(`\n${error.message}`);
    return;
  }

  if (isDatabaseConnectionError(error)) {
    console.error(
      '\nThe database is unavailable. Check DATABASE_URL and make sure the database is reachable.',
    );
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      console.error(
        '\nA user or department membership with those unique values already exists. No partial changes were kept.',
      );
      return;
    }

    if (error.code === 'P2025') {
      console.error(
        '\nThe record could not be found while applying the change. Refresh the data and try again.',
      );
      return;
    }
  }

  console.error('\nThe database operation could not be completed.');
  if (process.env.DEBUG && error instanceof Error) {
    console.error(error.stack ?? error.message);
  }
}

void main();
