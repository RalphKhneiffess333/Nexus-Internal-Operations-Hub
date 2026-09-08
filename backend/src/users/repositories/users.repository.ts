import { Injectable } from '@nestjs/common';
import { InMemoryDatabase } from '../../database/in-memory-database';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(private readonly database: InMemoryDatabase) {}

  findById(userId: string): User | undefined {
    return this.database.users.find((user) => user.userId === userId);
  }
}
