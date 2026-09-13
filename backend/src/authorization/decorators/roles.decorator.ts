import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../authorization.constants';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
