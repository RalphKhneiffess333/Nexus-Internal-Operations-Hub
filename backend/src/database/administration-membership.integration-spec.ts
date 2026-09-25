import { PrismaClient, UserRole } from '@prisma/client';
import {
  ADMIN_ID,
  ADMINISTRATION_DEPARTMENT_ID,
  AGENT_ID,
  seedTestDatabase,
} from './seed';

describe('Administration department database constraints', () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await seedTestDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects an Administration membership for a non-admin', async () => {
    await expect(
      prisma.departmentMember.create({
        data: {
          departmentMemberId: 'constraint-test-agent-administration',
          userId: AGENT_ID,
          departmentId: ADMINISTRATION_DEPARTMENT_ID,
        },
      }),
    ).rejects.toThrow(
      'Only administrators can belong to the Administration department',
    );
  });

  it('rejects removing an administrator from the Administration department', async () => {
    await expect(
      prisma.departmentMember.delete({
        where: {
          userId_departmentId: {
            userId: ADMIN_ID,
            departmentId: ADMINISTRATION_DEPARTMENT_ID,
          },
        },
      }),
    ).rejects.toThrow(
      'Administrators must belong to the Administration department',
    );
  });

  it('allows an agent to be promoted and mapped to Administration atomically', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { userId: AGENT_ID },
          data: { role: UserRole.Admin },
        });
        await tx.departmentMember.create({
          data: {
            departmentMemberId: 'constraint-test-promoted-agent-administration',
            userId: AGENT_ID,
            departmentId: ADMINISTRATION_DEPARTMENT_ID,
          },
        });
      }),
    ).resolves.toBeUndefined();
  });

  it('forbids deleting or deactivating the Administration department', async () => {
    await expect(
      prisma.department.update({
        where: { departmentId: ADMINISTRATION_DEPARTMENT_ID },
        data: { active: false },
      }),
    ).rejects.toThrow(
      'The Administration department cannot be deleted or deactivated',
    );

    await expect(
      prisma.department.delete({
        where: { departmentId: ADMINISTRATION_DEPARTMENT_ID },
      }),
    ).rejects.toThrow(
      'The Administration department cannot be deleted or deactivated',
    );
  });
});
