import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto, UpdateSubscriptionDto } from './dto/organization.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtPayload, UserRole } from '../../shared/types';

@ApiTags('Organizations')
@ApiBearerAuth('JWT-Auth')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /** GET /api/v1/organizations — Liste toutes les orgs (super_admin uniquement) */
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Super Admin] Liste toutes les organisations' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.findAll(user);
  }

  /** GET /api/v1/organizations/me — Infos de son organisation */
  @Get('me')
  @ApiOperation({ summary: 'Récupérer les informations de son organisation' })
  findMine(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.findMyOrganization(user.organizationId);
  }

  /** PATCH /api/v1/organizations/me — Mettre à jour son organisation */
  @Patch('me')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour les paramètres de son organisation' })
  update(@Body() dto: UpdateOrganizationDto, @CurrentUser() user: JwtPayload) {
    return this.organizationsService.updateOrganization(user.organizationId, dto, user);
  }

  /** PUT /api/v1/organizations/:id/subscription — Changer l'abonnement (super_admin) */
  @Put(':id/subscription')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Super Admin] Modifier le plan d\'abonnement d\'une organisation' })
  updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.organizationsService.updateSubscription(id, dto, user);
  }
}
