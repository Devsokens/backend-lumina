import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtPayload, UserRole } from '../../shared/types';

@ApiTags('Users')
@ApiBearerAuth('JWT-Auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /api/v1/users — Liste tous les utilisateurs de l'organisation */
  @Get()
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Lister les utilisateurs de l\'organisation' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.usersService.findAll(user.organizationId);
  }

  /** GET /api/v1/users/:id — Détail d'un utilisateur */
  @Get(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Récupérer un utilisateur par ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.findOne(id, user.organizationId);
  }

  /** POST /api/v1/users — Inviter un nouvel utilisateur */
  @Post()
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Inviter un nouvel utilisateur dans l\'organisation' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.create(dto, user.organizationId, user);
  }

  /** PATCH /api/v1/users/:id — Modifier un utilisateur */
  @Patch(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Modifier un utilisateur' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.update(id, dto, user.organizationId, user);
  }

  /** PATCH /api/v1/users/:id/toggle-active — Activer/Désactiver */
  @Patch(':id/toggle-active')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Activer ou désactiver un compte utilisateur' })
  toggleActive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.toggleActive(id, user.organizationId, user);
  }

  /** PUT /api/v1/users/change-password — Changer son mot de passe */
  @Put('change-password')
  @ApiOperation({ summary: 'Changer son propre mot de passe' })
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.changePassword(dto, user);
  }
}
