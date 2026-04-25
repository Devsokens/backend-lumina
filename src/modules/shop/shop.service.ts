import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../shared/services/supabase.service';
import { ProductsService } from '../products/products.service';
import {
  CreateSupplierDto,
  InventoryMovementDto,
  CreateCustomerDto,
} from './dto/shop.dto';
import { JwtPayload } from '../../shared/types';

@Injectable()
export class ShopService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly productsService: ProductsService,
  ) {}

  // ─── FOURNISSEURS ─────────────────────────────────────────

  async createSupplier(dto: CreateSupplierDto, organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('suppliers')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        ...dto,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error('Erreur lors de la création du fournisseur.');
    return data;
  }

  async findAllSuppliers(organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('suppliers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error('Erreur lors de la récupération des fournisseurs.');
    return data;
  }

  // ─── INVENTAIRE & GRAND LIVRE ─────────────────────────────

  async registerMovement(dto: InventoryMovementDto, organizationId: string, currentUser: JwtPayload) {
    const db = this.supabaseService.adminClient;

    // 1. Vérifier le produit
    const product = await this.productsService.findOne(dto.productId, organizationId);

    // 2. Enregistrer le mouvement (Traceabilité anti-vol)
    const { error: moveError } = await db.from('inventory_movements').insert({
      id: uuidv4(),
      organization_id: organizationId,
      product_id: dto.productId,
      user_id: currentUser.sub,
      type: dto.type,
      quantity: dto.quantity,
      unit_cost: dto.unitCost ?? null,
      reason: dto.reason ?? null,
    });

    if (moveError) throw new Error('Erreur lors de l\'enregistrement du mouvement.');

    // 3. Mettre à jour le stock du produit via la procédure stockée
    let stockDelta = dto.quantity;
    if (['sale', 'breakage'].includes(dto.type)) {
      stockDelta = -dto.quantity; // Décrémenter si c'est une sortie
    }

    if (stockDelta !== 0) {
      const { error: stockError } = await db.rpc('adjust_stock', {
        p_product_id: dto.productId,
        p_organization_id: organizationId,
        p_delta: stockDelta,
      });
      if (stockError) throw new Error(`Erreur ajustement stock: ${stockError.message}`);
    }

    return { message: 'Mouvement enregistré avec succès.' };
  }

  async getInventoryMovements(organizationId: string, productId?: string) {
    let query = this.supabaseService.adminClient
      .from('inventory_movements')
      .select('*, users(first_name, last_name), products(name, sku)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) throw new Error('Erreur lors de la récupération des mouvements.');
    return data;
  }

  // ─── CRM CLIENTS ──────────────────────────────────────────

  async createCustomer(dto: CreateCustomerDto, organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('customers')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
        loyalty_points: 0,
        total_spent: 0,
        total_orders: 0,
      })
      .select()
      .single();

    if (error) throw new Error('Erreur lors de la création du client.');
    return data;
  }

  async findAllCustomers(organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('customers')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');

    if (error) throw new Error('Erreur lors de la récupération des clients.');
    return data;
  }
}
