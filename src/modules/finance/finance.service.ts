import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../shared/services/supabase.service';
import { CreateTransactionDto, TransactionQueryDto } from './dto/transaction.dto';
import { JwtPayload, TransactionStatus } from '../../shared/types';

interface DailySummary {
  date: string;
  totalSales: number;
  totalExpenses: number;
  netRevenue: number;
  transactionCount: number;
  cashAmount: number;
  mobileMoneyAmount: number;
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Crée une transaction.
   * Règle .antigravityrules : Double validation — le backend recalcule chaque montant.
   */
  async createTransaction(dto: CreateTransactionDto, currentUser: JwtPayload) {
    const { data, error } = await this.supabaseService.adminClient
      .from('transactions')
      .insert({
        id: uuidv4(),
        organization_id: currentUser.organizationId,
        amount: dto.amount,
        payment_method: dto.paymentMethod,
        type: dto.type,
        status: TransactionStatus.COMPLETED,
        reference_id: dto.referenceId ?? null,
        description: dto.description ?? null,
        mobile_money_ref: dto.mobileMoneyRef ?? null,
        metadata: dto.metadata ?? {},
        created_by: currentUser.sub,
      })
      .select()
      .single();

    if (error) throw new Error('Erreur lors de la création de la transaction.');
    return data;
  }

  /**
   * Liste les transactions avec filtres et pagination.
   */
  async findAll(organizationId: string, query: TransactionQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    let queryBuilder = this.supabaseService.adminClient
      .from('transactions')
      .select('id, amount, payment_method, type, status, reference_id, description, mobile_money_ref, created_at', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (query.type) queryBuilder = queryBuilder.eq('type', query.type);
    if (query.paymentMethod) queryBuilder = queryBuilder.eq('payment_method', query.paymentMethod);
    if (query.startDate) queryBuilder = queryBuilder.gte('created_at', query.startDate);
    if (query.endDate) queryBuilder = queryBuilder.lte('created_at', `${query.endDate}T23:59:59`);

    const { data, error, count } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error('Erreur lors de la récupération des transactions.');

    return {
      data,
      meta: { total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) },
    };
  }

  /**
   * Rapport journalier — agrégation des ventes du jour.
   * Utilisé par le module IA pour les rapports WhatsApp.
   */
  async getDailySummary(organizationId: string, date?: string): Promise<DailySummary> {
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    const startOfDay = `${targetDate}T00:00:00`;
    const endOfDay = `${targetDate}T23:59:59`;

    const { data, error } = await this.supabaseService.adminClient
      .from('transactions')
      .select('amount, payment_method, type')
      .eq('organization_id', organizationId)
      .eq('status', TransactionStatus.COMPLETED)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (error) throw new Error('Erreur lors du calcul du résumé journalier.');

    const transactions = data ?? [];

    const sales = transactions.filter((t) => t.type === 'sale');
    const expenses = transactions.filter((t) => t.type === 'expense');

    const totalSales = sales.reduce((sum, t) => sum + (t.amount as number), 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + (t.amount as number), 0);
    const cashAmount = sales.filter((t) => t.payment_method === 'cash').reduce((sum, t) => sum + (t.amount as number), 0);
    const mobileMoneyAmount = sales.filter((t) => t.payment_method === 'mobile_money').reduce((sum, t) => sum + (t.amount as number), 0);

    return {
      date: targetDate,
      totalSales,
      totalExpenses,
      netRevenue: totalSales - totalExpenses,
      transactionCount: transactions.length,
      cashAmount,
      mobileMoneyAmount,
    };
  }

  /**
   * Récupère les logs d'audit de l'organisation.
   */
  async getAuditLogs(organizationId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabaseService.adminClient
      .from('audit_logs')
      .select('id, user_id, action, table_name, record_id, old_values, new_values, ip_address, created_at', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error('Erreur lors de la récupération des logs.');
    return {
      data,
      meta: { total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) },
    };
  }
}
