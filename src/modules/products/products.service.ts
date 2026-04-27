import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../shared/services/supabase.service';
import { RedisService } from '../../shared/services/redis.service';
import { AuditService } from '../../shared/services/audit.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
  UpdateStockDto,
} from './dto/product.dto';
import { AuditAction, JwtPayload } from '../../shared/types';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  // ─── CATÉGORIES ──────────────────────────────────────────

  async createCategory(dto: CreateCategoryDto, organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('product_categories')
      .insert({ id: uuidv4(), organization_id: organizationId, name: dto.name, color: dto.color ?? '#6B7280' })
      .select()
      .single();

    if (error) throw new Error('Erreur lors de la création de la catégorie.');
    await this.redisService.del(this.redisService.buildKey(organizationId, 'categories'));
    return data;
  }

  async findAllCategories(organizationId: string) {
    const cacheKey = this.redisService.buildKey(organizationId, 'categories');
    return this.redisService.getOrSet(cacheKey, async () => {
      const { data, error } = await this.supabaseService.adminClient
        .from('product_categories')
        .select('id, name, color')
        .eq('organization_id', organizationId)
        .order('name');
      if (error) throw new Error('Erreur lors de la récupération des catégories.');
      return data;
    }, 3600);
  }

  // ─── PRODUITS ────────────────────────────────────────────

  /**
   * Catalogue produits avec cache Redis.
   * Règle .antigravityrules : Cache obligatoire pour les données à lecture fréquente.
   */
  async findAll(organizationId: string, query: ProductQueryDto) {
    const cacheKey = this.redisService.buildKey(
      organizationId, 'products', JSON.stringify(query),
    );

    return this.redisService.getOrSet(cacheKey, async () => {
      let queryBuilder = this.supabaseService.adminClient
        .from('products')
        .select(`
          id, name, sku, barcode, price, cost_price, stock_quantity,
          alert_threshold, expiry_date, is_active, metadata,
          product_categories(id, name, color)
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (query.search) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query.search}%,sku.ilike.%${query.search}%,barcode.eq.${query.search}`);
      }
      if (query.categoryId) {
        queryBuilder = queryBuilder.eq('category_id', query.categoryId);
      }
      if (query.lowStock) {
        queryBuilder = queryBuilder.filter('stock_quantity', 'lte', 'alert_threshold');
      }

      const { data, error } = await queryBuilder.order('name');
      if (error) throw new Error('Erreur lors de la récupération des produits.');
      return data;
    }, 300); // Cache 5 min (catalogue fréquemment consulté)
  }

  async findOne(id: string, organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('products')
      .select(`id, name, sku, barcode, price, cost_price, stock_quantity, alert_threshold, expiry_date, is_active, metadata, product_categories(id, name, color)`)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error || !data) throw new NotFoundException(`Produit ${id} introuvable.`);
    return data;
  }

  async create(dto: CreateProductDto, organizationId: string, currentUser: JwtPayload) {
    const { data, error } = await this.supabaseService.adminClient
      .from('products')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        name: dto.name,
        sku: dto.sku ?? null,
        barcode: dto.barcode ?? null,
        price: dto.price,
        cost_price: dto.costPrice ?? 0,
        stock_quantity: dto.stockQuantity ?? 0,
        alert_threshold: dto.alertThreshold ?? 5,
        category_id: dto.categoryId ?? null,
        expiry_date: dto.expiryDate ?? null,
        metadata: dto.metadata ?? {},
        is_active: true,
      })
      .select()
      .single();

    if (error || !data) throw new Error('Erreur lors de la création du produit.');
    await this.invalidateProductCache(organizationId);
    return data;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    organizationId: string,
    currentUser: JwtPayload,
  ) {
    const existing = await this.findOne(id, organizationId);

    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload['name'] = dto.name;
    if (dto.price !== undefined) updatePayload['price'] = dto.price;
    if (dto.costPrice !== undefined) updatePayload['cost_price'] = dto.costPrice;
    if (dto.sku !== undefined) updatePayload['sku'] = dto.sku;
    if (dto.barcode !== undefined) updatePayload['barcode'] = dto.barcode;
    if (dto.alertThreshold !== undefined) updatePayload['alert_threshold'] = dto.alertThreshold;
    if (dto.categoryId !== undefined) updatePayload['category_id'] = dto.categoryId;
    if (dto.expiryDate !== undefined) updatePayload['expiry_date'] = dto.expiryDate;
    if (dto.metadata !== undefined) updatePayload['metadata'] = dto.metadata;

    const { data, error } = await this.supabaseService.adminClient
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error || !data) throw new Error('Erreur lors de la mise à jour du produit.');
    await this.invalidateProductCache(organizationId);

    await this.auditService.log({
      organizationId,
      userId: currentUser.sub,
      action: AuditAction.UPDATE,
      tableName: 'products',
      recordId: id,
      oldValues: existing as Record<string, unknown>,
      newValues: updatePayload,
    });

    return data;
  }

  async remove(id: string, organizationId: string, currentUser: JwtPayload) {
    const existing = await this.findOne(id, organizationId);

    // Soft delete — on désactive le produit, on ne le supprime pas
    const { data, error } = await this.supabaseService.adminClient
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select('id, name')
      .single();

    if (error) throw new Error('Erreur lors de la suppression du produit.');
    await this.invalidateProductCache(organizationId);

    await this.auditService.log({
      organizationId,
      userId: currentUser.sub,
      action: AuditAction.DELETE,
      tableName: 'products',
      recordId: id,
      oldValues: existing as Record<string, unknown>,
      newValues: { is_active: false },
    });

    return { message: `Produit "${data?.name}" désactivé.` };
  }

  /**
   * Synchronisation offline — reçoit un batch de produits vendus hors-ligne.
   * Règle .antigravityrules : endpoint /sync pour l'offline-first.
   */
  async syncOffline(
    records: Array<{ productId: string; quantity: number; timestamp: string }>,
    organizationId: string,
  ) {
    const results = [];
    for (const record of records) {
      try {
        await this.decrementStock(record.productId, record.quantity, organizationId);
        results.push({ productId: record.productId, status: 'synced' });
      } catch {
        results.push({ productId: record.productId, status: 'failed' });
      }
    }
    await this.invalidateProductCache(organizationId);
    return { synced: results.filter((r) => r.status === 'synced').length, results };
  }

  async decrementStock(productId: string, quantity: number, organizationId: string): Promise<void> {
    const { error } = await this.supabaseService.adminClient.rpc('decrement_stock', {
      p_product_id: productId,
      p_organization_id: organizationId,
      p_quantity: quantity,
    });
    if (error) throw new Error(`Erreur décrement stock: ${error.message}`);
  }

  private async invalidateProductCache(organizationId: string): Promise<void> {
    await this.redisService.invalidateOrganization(organizationId);
  }
}
