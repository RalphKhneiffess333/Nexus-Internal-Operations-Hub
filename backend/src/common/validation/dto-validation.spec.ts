import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from '@jest/globals';
import { AuditQueryDto } from '../../audit/dto/audit-query.dto';
import { CreateAdminUserDto } from '../../administration/dto/admin.dto';
import { ModifyTicketDto } from '../../tickets/dto/modify-ticket.dto';
import { CloseTicketDto } from '../../tickets/dto/close-ticket.dto';
import { TicketQueryDto } from '../../tickets/dto/ticket-query.dto';

describe('DTO validation', () => {
  it('rejects unknown boolean query values instead of coercing them to false', async () => {
    const dto = plainToInstance(TicketQueryDto, {
      includeInactive: 'not-a-boolean',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('includeInactive');
  });

  it('preserves valid boolean query values after strict transformation', async () => {
    const dto = plainToInstance(TicketQueryDto, { includeInactive: 'false' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.includeInactive).toBe(false);
  });

  it('rejects whitespace-only account names after trimming', async () => {
    const dto = plainToInstance(CreateAdminUserDto, {
      email: 'user@example.com',
      fullName: '   ',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('fullName');
  });

  it('accepts seeded non-UUID actor identifiers', async () => {
    const dto = plainToInstance(AuditQueryDto, { actorId: 'user-admin-1' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects blank modification and completion values', async () => {
    const modifyDto = plainToInstance(ModifyTicketDto, { title: '   ' });
    const closeDto = plainToInstance(CloseTicketDto, {
      completionNotes: '   ',
    });

    const [modifyErrors, closeErrors] = await Promise.all([
      validate(modifyDto),
      validate(closeDto),
    ]);

    expect(modifyErrors.map((error) => error.property)).toContain('title');
    expect(closeErrors.map((error) => error.property)).toContain(
      'completionNotes',
    );
  });

  it('validates removed attachment IDs as a bounded JSON identifier list', async () => {
    const invalidDto = plainToInstance(ModifyTicketDto, {
      removedAttachmentIds: JSON.stringify(['bad id']),
    });
    const tooManyDto = plainToInstance(ModifyTicketDto, {
      removedAttachmentIds: JSON.stringify(
        Array.from({ length: 21 }, (_, index) => `attachment-${index}`),
      ),
    });
    const validDto = plainToInstance(ModifyTicketDto, {
      removedAttachmentIds: JSON.stringify(['attachment-1', 'attachment-2']),
    });

    const [invalidErrors, tooManyErrors, validErrors] = await Promise.all([
      validate(invalidDto),
      validate(tooManyDto),
      validate(validDto),
    ]);

    expect(invalidErrors.map((error) => error.property)).toContain(
      'removedAttachmentIds',
    );
    expect(tooManyErrors.map((error) => error.property)).toContain(
      'removedAttachmentIds',
    );
    expect(validErrors).toHaveLength(0);
  });
});
