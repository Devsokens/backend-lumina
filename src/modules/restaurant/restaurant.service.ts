import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as qrcode from 'qrcode';
import { SupabaseService } from '../../shared/services/supabase.service';
import { AuditService } from '../../shared/services/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CreateTableDto,
  CreateOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
} from './dto/restaurant.dto';
import { AuditAction, JwtPayload, OrderStatus } from '../../shared/types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RestaurantService {
  private readonly logger = new Logger(RestaurantService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  // ─── GESTION DES TABLES ───────────────────────────────────

  async createTable(dto: CreateTableDto, organizationId: string, currentUser: JwtPayload) {
    const tableId = uuidv4();
    const qrBaseUrl = this.configService.get<string>('QR_CODE_BASE_URL') ?? 'https://lumina.app/menu';
    const qrUrl = `${qrBaseUrl}?org=${organizationId}&table=${tableId}`;

    const qrCodeDataUrl = await qrcode.toDataURL(qrUrl);

    const { data, error } = await this.supabaseService.adminClient
      .from('tables')
      .insert({
        id: tableId,
        organization_id: organizationId,
        table_number: dto.tableNumber,
        capacity: dto.capacity,
        qr_code_url: qrCodeDataUrl, // Dans une vraie app, on uploadrait l'image sur S3/Supabase Storage
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error('Erreur lors de la création de la table.');
    return data;
  }

  async findAllTables(organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('tables')
      .select('*')
      .eq('organization_id', organizationId)
      .order('table_number');

    if (error) throw new Error('Erreur lors de la récupération des tables.');
    return data;
  }

  // ─── GESTION DES COMMANDES ────────────────────────────────

  async createOrder(dto: CreateOrderDto, organizationId: string, currentUser: JwtPayload) {
    const db = this.supabaseService.adminClient;
    
    // 1. Calcul du total et validation des produits
    let totalAmount = 0;
    const orderItemsToInsert = [];

    for (const item of dto.items) {
      const { data: product } = await db
        .from('products')
        .select('price')
        .eq('id', item.productId)
        .eq('organization_id', organizationId)
        .single();

      if (!product) throw new NotFoundException(`Produit ${item.productId} introuvable.`);
      
      totalAmount += (product.price as number) * item.quantity;
      
      orderItemsToInsert.push({
        id: uuidv4(),
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: product.price,
        notes: item.notes ?? null,
        status: 'pending',
      });
    }

    // 2. Création de la commande
    const orderId = uuidv4();
    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        id: orderId,
        organization_id: organizationId,
        table_id: dto.tableId,
        staff_id: currentUser.sub, // Le serveur qui prend la commande
        status: OrderStatus.PENDING,
        total_amount: totalAmount,
        notes: dto.notes ?? null,
      })
      .select()
      .single();

    if (orderError) throw new Error('Erreur lors de la création de la commande.');

    // 3. Insertion des items
    const itemsWithOrderId = orderItemsToInsert.map(i => ({ ...i, order_id: orderId }));
    const { error: itemsError } = await db.from('order_items').insert(itemsWithOrderId);
    
    if (itemsError) throw new Error('Erreur lors de l\'ajout des articles.');

    // 4. Notification Temps Réel pour la cuisine (SSE)
    this.eventEmitter.emit(`order.created.${organizationId}`, { order, items: itemsWithOrderId });

    return { ...order, items: itemsWithOrderId };
  }

  async getActiveOrders(organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('orders')
      .select(`
        *,
        tables(table_number),
        order_items(*, products(name))
      `)
      .eq('organization_id', organizationId)
      .neq('status', OrderStatus.PAID)
      .neq('status', OrderStatus.CANCELLED)
      .order('created_at', { ascending: false });

    if (error) throw new Error('Erreur lors de la récupération des commandes.');
    return data;
  }

  async updateOrderStatus(id: string, status: OrderStatus, organizationId: string, currentUser: JwtPayload) {
    const { data: existing, error: fetchError } = await this.supabaseService.adminClient
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !existing) throw new NotFoundException('Commande introuvable.');

    if (existing.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Impossible de modifier une commande annulée.');
    }

    const { data, error } = await this.supabaseService.adminClient
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error('Erreur lors de la mise à jour du statut.');

    // Audit
    await this.auditService.log({
      organizationId,
      userId: currentUser.sub,
      action: AuditAction.UPDATE,
      tableName: 'orders',
      recordId: id,
      oldValues: { status: existing.status },
      newValues: { status },
    });

    // Notification Cuisine / Salle
    this.eventEmitter.emit(`order.updated.${organizationId}`, data);

    return data;
  }

  // ─── TRAÇABILITÉ ANTI-VOL : ANNULATIONS ───────────────────

  async cancelOrder(id: string, dto: CancelOrderDto, organizationId: string, currentUser: JwtPayload) {
    const db = this.supabaseService.adminClient;

    // 1. Récupérer la commande et ses items
    const { data: order } = await db
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!order) throw new NotFoundException('Commande introuvable.');
    if (order.status === OrderStatus.PAID) throw new BadRequestException('Impossible d\'annuler une commande déjà payée.');

    // 2. Marquer comme annulé
    await this.updateOrderStatus(id, OrderStatus.CANCELLED, organizationId, currentUser);

    // 3. Enregistrer l'annulation dans la table anti-vol
    const { error: cancelError } = await db.from('order_cancellations').insert({
      id: uuidv4(),
      order_id: id,
      cancelled_by: currentUser.sub,
      reason: dto.reason,
      cancelled_items: order.order_items,
    });

    if (cancelError) this.logger.error(`Erreur d'enregistrement d'annulation: ${cancelError.message}`);

    return { message: 'Commande annulée avec succès et enregistrée pour audit.' };
  }
}
