import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, map } from 'rxjs';
import { RestaurantService } from './restaurant.service';
import {
  CreateTableDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
} from './dto/restaurant.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/types';
import type { JwtPayload } from '../../shared/types';

@ApiTags('Restaurant')
@ApiBearerAuth('JWT-Auth')
@Controller('restaurant')
export class RestaurantController {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── TABLES ───────────────────────────────────────────────

  @Post('tables')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Créer une table et générer son QR Code' })
  createTable(@Body() dto: CreateTableDto, @CurrentUser() user: JwtPayload) {
    return this.restaurantService.createTable(dto, user.organizationId, user);
  }

  @Get('tables')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER)
  @ApiOperation({ summary: 'Lister les tables' })
  findAllTables(@CurrentUser() user: JwtPayload) {
    return this.restaurantService.findAllTables(user.organizationId);
  }

  // ─── COMMANDES ────────────────────────────────────────────

  @Post('orders')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Prendre une commande' })
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return this.restaurantService.createOrder(dto, user.organizationId, user);
  }

  @Get('orders/active')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.CASHIER)
  @ApiOperation({ summary: 'Commandes en cours (cuisine / salle)' })
  getActiveOrders(@CurrentUser() user: JwtPayload) {
    return this.restaurantService.getActiveOrders(user.organizationId);
  }

  @Patch('orders/:id/status')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN_STAFF, UserRole.CASHIER)
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une commande (ex: ready)' })
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurantService.updateOrderStatus(id, dto.status, user.organizationId, user);
  }

  @Post('orders/:id/cancel')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Annuler une commande (Trace anti-vol)' })
  cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurantService.cancelOrder(id, dto, user.organizationId, user);
  }

  // ─── TEMPS RÉEL (SSE) ─────────────────────────────────────

  @Sse('kitchen/events')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.KITCHEN_STAFF)
  @ApiOperation({ summary: 'SSE: Flux temps réel pour la cuisine' })
  kitchenEvents(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
    return fromEvent(this.eventEmitter, `order.created.${user.organizationId}`).pipe(
      map((payload) => ({
        data: payload,
      } as MessageEvent)),
    );
  }
}
