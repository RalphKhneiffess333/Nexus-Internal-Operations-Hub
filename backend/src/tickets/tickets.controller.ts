import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ClaimTicketDto } from './dto/claim-ticket.dto';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { ModifyTicketDto } from './dto/modify-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  submit(@Body() dto: SubmitTicketDto) {
    return this.ticketsService.submit(dto);
  }

  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Patch(':id')
  modify(@Param('id') id: string, @Body() dto: ModifyTicketDto) {
    return this.ticketsService.modify(id, dto);
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @Body() dto: ClaimTicketDto) {
    return this.ticketsService.claim(id, dto);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @Body() dto: CloseTicketDto) {
    return this.ticketsService.close(id, dto);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string, @Body() dto: ReopenTicketDto) {
    return this.ticketsService.reopen(id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.ticketsService.cancel(id);
  }
}
