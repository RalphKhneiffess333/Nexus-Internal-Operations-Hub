import { Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { UserResponseMapper, SafeUserResponse } from './user-response.mapper';
import { UsersRepository } from './repositories/users.repository';

export interface CreateUserInput {
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  identityProviderId: string;
  identityProviderUserId: string;
}

@Injectable()
export class UserAccountService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly userResponseMapper: UserResponseMapper,
  ) {}

  findById(userId: string): Promise<User | null> {
    return this.usersRepository.findById(userId);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findByIdentity(
    identityProviderId: string,
    identityProviderUserId: string,
  ): Promise<User | null> {
    return this.usersRepository.findByIdentity(
      identityProviderId,
      identityProviderUserId,
    );
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.usersRepository.create({
      userId: randomUUID(),
      email: input.email,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber ?? null,
      role: UserRole.Employee,
      isActive: true,
      hasLogged: true,
      identityProvider: {
        connect: { identityProviderId: input.identityProviderId },
      },
      identityProviderUserId: input.identityProviderUserId,
    });
  }

  async linkIdentity(
    user: User,
    identityProviderId: string,
    identityProviderUserId: string,
  ): Promise<User> {
    if (
      user.identityProviderId === identityProviderId &&
      user.identityProviderUserId === identityProviderUserId &&
      user.hasLogged
    ) {
      return user;
    }

    return this.usersRepository.update(user.userId, {
      hasLogged: true,
      identityProvider: { connect: { identityProviderId } },
      identityProviderUserId,
    });
  }

  async markAsLoggedIn(user: User): Promise<User> {
    if (user.hasLogged) return user;
    if (!user.identityProviderUserId) {
      throw new NotFoundException(
        'User account is not linked to an authenticated identity',
      );
    }
    return this.usersRepository.update(user.userId, { hasLogged: true });
  }

  async findIdentityProviderByCode(code: string) {
    const identityProvider =
      await this.usersRepository.findIdentityProviderByCode(code);
    if (!identityProvider || !identityProvider.active) {
      throw new NotFoundException(
        `Identity provider ${code} is not configured or active`,
      );
    }
    return identityProvider;
  }

  async findForProfile(userId: string): Promise<SafeUserResponse> {
    const user = await this.usersRepository.findAdminById(userId);
    if (!user) throw new NotFoundException('User was not found');
    return this.userResponseMapper.toSafeResponse(user);
  }
}
