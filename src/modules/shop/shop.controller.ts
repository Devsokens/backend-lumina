import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShopService } from './shop.service';
import {
  CreateSupplierDto,
  InventoryMovementDto,
  CreateCustomerDto,
} from './dto/shop.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/types';
import type { JwtPayload } from '../../shared/types';

@ApiTags('Shop - POS')
@ApiBearerAuth('JWT-Auth')
@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  // ─── FOURNISSEURS ─────────────────────────────────────────

  @Post('suppliers')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Créer un fournisseur' })
  createSupplier(@Body() dto: CreateSupplierDto, @CurrentUser() user: JwtPayload) {
    return this.shopService.createSupplier(dto, user.organizationId);
  }

  @Get('suppliers')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.STOCK_MANAGER)
  @ApiOperation({ summary: 'Lister les fournisseurs' })
  findAllSuppliers(@CurrentUser() user: JwtPayload) {
    return this.shopService.findAllSuppliers(user.organizationId);
  }

  // ─── INVENTAIRE ───────────────────────────────────────────

  @Post('inventory/movements')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.STOCK_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Enregistrer un mouvement de stock (Grand livre)' })
  registerMovement(@Body() dto: InventoryMovementDto, @CurrentUser() user: JwtPayload) {
    return this.shopService.registerMovement(dto, user.organizationId, user);
  }

  @Get('inventory/movements')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.STOCK_MANAGER)
  @ApiOperation({ summary: 'Voir l\'historique des mouvements de stock' })
  getInventoryMovements(
    @Query('productId') productId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.shopService.getInventoryMovements(user.organizationId, productId);
  }

  // ─── CLIENTS (CRM) ────────────────────────────────────────

  @Post('customers')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Créer un client (CRM)' })
  createCustomer(@Body() dto: CreateCustomerDto, @CurrentUser() user: JwtPayload) {
    return this.shopService.createCustomer(dto, user.organizationId);
  }

  @Get('customers')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Lister les clients' })
  findAllCustomers(@CurrentUser() user: JwtPayload) {
    return this.shopService.findAllCustomers(user.organizationId);
  }
}
