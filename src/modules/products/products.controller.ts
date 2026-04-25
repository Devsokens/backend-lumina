import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtPayload, UserRole } from '../../shared/types';

@ApiTags('Products')
@ApiBearerAuth('JWT-Auth')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── CATÉGORIES ──────────────────────────────────────────

  @Post('categories')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Créer une catégorie de produits' })
  createCategory(@Body() dto: CreateCategoryDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.createCategory(dto, user.organizationId);
  }

  @Get('categories')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER, UserRole.STOCK_MANAGER)
  @ApiOperation({ summary: 'Lister les catégories' })
  findAllCategories(@CurrentUser() user: JwtPayload) {
    return this.productsService.findAllCategories(user.organizationId);
  }

  // ─── PRODUITS ────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.STOCK_MANAGER)
  @ApiOperation({ summary: 'Créer un produit' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.create(dto, user.organizationId, user);
  }

  @Get()
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER, UserRole.STOCK_MANAGER)
  @ApiOperation({ summary: 'Catalogue produits (recherche et filtres)' })
  findAll(@Query() query: ProductQueryDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.findAll(user.organizationId, query);
  }

  @Get(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER, UserRole.STOCK_MANAGER)
  @ApiOperation({ summary: 'Détails d\'un produit' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.productsService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.STOCK_MANAGER)
  @ApiOperation({ summary: 'Modifier un produit' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.update(id, dto, user.organizationId, user);
  }

  @Delete(':id')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Désactiver un produit (Soft Delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.productsService.remove(id, user.organizationId, user);
  }

  @Post('sync-offline')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Synchronisation de masse (Offline-first)' })
  syncOffline(
    @Body() records: Array<{ productId: string; quantity: number; timestamp: string }>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.syncOffline(records, user.organizationId);
  }
}
