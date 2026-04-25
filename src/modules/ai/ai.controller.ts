import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { GenerateReportDto } from './dto/ai.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/types';
import type { JwtPayload } from '../../shared/types';
import { OrganizationsService } from '../organizations/organizations.service';

@ApiTags('AI (Lumina Assistant)')
@ApiBearerAuth('JWT-Auth')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Post('report/generate')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Générer manuellement un rapport IA pour une journée' })
  async generateReport(@Body() dto: GenerateReportDto, @CurrentUser() user: JwtPayload) {
    const org = await this.organizationsService.findMyOrganization(user.organizationId);
    return this.aiService.generateAndSendReport(org.id, org.name, org.sector, dto.date);
  }
}
