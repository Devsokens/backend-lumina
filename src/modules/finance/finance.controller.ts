import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateTransactionDto, TransactionQueryDto } from './dto/transaction.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtPayload, UserRole } from '../../shared/types';

@ApiTags('Finance')
@ApiBearerAuth('JWT-Auth')
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('transactions')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Créer une transaction financière' })
  createTransaction(@Body() dto: CreateTransactionDto, @CurrentUser() user: JwtPayload) {
    return this.financeService.createTransaction(dto, user);
  }

  @Get('transactions')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Lister les transactions avec filtres' })
  findAll(@Query() query: TransactionQueryDto, @CurrentUser() user: JwtPayload) {
    return this.financeService.findAll(user.organizationId, query);
  }

  @Get('summary/daily')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Résumé financier journalier' })
  getDailySummary(@Query('date') date: string, @CurrentUser() user: JwtPayload) {
    return this.financeService.getDailySummary(user.organizationId, date);
  }

  @Get('audit-logs')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Consulter le journal d\'audit (anti-vol)' })
  getAuditLogs(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.financeService.getAuditLogs(
      user.organizationId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
