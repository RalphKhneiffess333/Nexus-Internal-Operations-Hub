import { Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { UsersRepository } from './repositories/users.repository';

export interface CreateUserInput {
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  identityProviderId: string;
  identityProviderUserId: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

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
      user.identityProviderUserId === identityProviderUserId
    ) {
      return user;
    }

    return this.usersRepository.update(user.userId, {
      identityProvider: {
        connect: { identityProviderId },
      },
      identityProviderUserId,
    });
  }

  async markAsLoggedIn(user: User): Promise<User> {
    if (user.hasLogged) {
      return user;
    }

    return this.usersRepository.update(user.userId, {
      hasLogged: true,
    });
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
}
