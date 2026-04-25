import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseService } from '../../shared/services/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { GenerateReportDto } from './dto/ai.dto';
import { SubscriptionStatus } from '../../shared/types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly organizationsService: OrganizationsService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('Clé OpenAI manquante. Le module IA fonctionnera en mode "mock".');
    }
  }

  /**
   * Tâche planifiée : S'exécute tous les jours à 23h00.
   * Règle .antigravityrules : Cron job pour agrégation et analyse IA.
   */
  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async generateDailyReports() {
    this.logger.log('Début de la génération des rapports IA journaliers...');

    // 1. Récupérer toutes les organisations actives (ex: PRO)
    const { data: orgs } = await this.supabaseService.adminClient
      .from('organizations')
      .select('id, name, sector')
      .eq('subscription_status', SubscriptionStatus.PRO);

    if (!orgs) return;

    for (const org of orgs) {
      try {
        await this.generateAndSendReport(org.id, org.name, org.sector);
      } catch (err) {
        this.logger.error(`Erreur rapport IA pour l'org ${org.id}: ${(err as Error).message}`);
      }
    }

    this.logger.log('Rapports IA terminés.');
  }

  /**
   * Génère le rapport IA et l'envoie (mock WhatsApp pour l'instant).
   */
  async generateAndSendReport(organizationId: string, orgName: string, sector: string, date?: string) {
    // 1. Récupérer les données financières
    const summary = await this.financeService.getDailySummary(organizationId, date);

    // 2. Construire le prompt pour GPT-4o
    const prompt = `
      Tu es l'assistant IA "Lumina", un conseiller stratégique pour PME.
      Analyse les résultats du jour pour l'entreprise "${orgName}" (Secteur : ${sector}).
      Date : ${summary.date}
      - Ventes totales : ${summary.totalSales} XAF
      - Dépenses : ${summary.totalExpenses} XAF
      - Bénéfice net : ${summary.netRevenue} XAF
      - Transactions : ${summary.transactionCount}
      - Espèces : ${summary.cashAmount} XAF | Mobile Money : ${summary.mobileMoneyAmount} XAF

      Rédige un rapport concis, professionnel et encourageant à envoyer au gérant sur WhatsApp (avec des émojis).
      Mets en évidence un conseil d'optimisation si nécessaire.
    `;

    // 3. Appeler OpenAI
    let aiResponse = '';
    if (this.openai) {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: prompt }],
      });
      aiResponse = completion.choices[0]?.message?.content ?? 'Impossible de générer l\'analyse.';
    } else {
      aiResponse = `[Mode Mock] Bonjour ! Vos ventes d'aujourd'hui s'élèvent à ${summary.totalSales} XAF. Beau travail ! 🚀`;
    }

    // 4. Envoyer sur WhatsApp (Mock)
    this.sendWhatsAppMessage(organizationId, aiResponse);

    return { report: aiResponse, rawData: summary };
  }

  /**
   * Envoi de message WhatsApp (Simulé).
   */
  private sendWhatsAppMessage(organizationId: string, message: string) {
    // Dans le futur : appel à graph.facebook.com via axios
    this.logger.log(`📱 WhatsApp envoyé au gérant de ${organizationId}:\n${message}`);
  }
}
