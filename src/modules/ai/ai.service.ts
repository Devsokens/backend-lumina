import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseService } from '../../shared/services/supabase.service';
import { FinanceService } from '../finance/finance.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { WhatsappService } from '../../shared/services/whatsapp.service';
import { GenerateReportDto } from './dto/ai.dto';
import { SubscriptionStatus, UserRole } from '../../shared/types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly financeService: FinanceService,
    private readonly organizationsService: OrganizationsService,
    private readonly whatsappService: WhatsappService,
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
   * Génère le rapport IA et l'envoie via WhatsApp.
   */
  async generateAndSendReport(organizationId: string, orgName: string, sector: string, date?: string) {
    // 1. Récupérer les données financières
    const summary = await this.financeService.getDailySummary(organizationId, date);

    // 2. Construire le prompt pour GPT-4o
    const prompt = `
      Tu es l'assistant stratégique "Lumina AI", expert en gestion de PME.
      Analyse les résultats financiers de l'entreprise "${orgName}" (Secteur : ${sector}) pour la journée du ${summary.date}.

      DONNÉES DU JOUR :
      - Ventes totales : ${summary.totalSales} XAF
      - Bénéfice net : ${summary.netRevenue} XAF (Marge brute)
      - Volume : ${summary.transactionCount} transactions
      - Répartition : ${summary.cashAmount} XAF (Espèces) | ${summary.mobileMoneyAmount} XAF (Mobile Money)
      - Dépenses enregistrées : ${summary.totalExpenses} XAF

      STRUCTURE DU RAPPORT (à envoyer sur WhatsApp) :
      1. 📊 *BILAN DE LA JOURNÉE* : Un résumé impactant de la performance globale.
      2. 🔍 *ANALYSE DES FLUX* : Analyse la répartition Cash vs Mobile Money. Si le cash est élevé, donne un rappel sur la sécurité.
      3. 💡 *CONSEIL STRATÉGIQUE* : Donne un conseil spécifique au secteur ${sector}. Par exemple, si les ventes sont faibles, suggère une promotion. Si elles sont fortes, suggère de vérifier les stocks.
      4. 🌟 *NOTE DU CONSULTANT* : Une remarque encourageante et personnalisée.

      CONTRAINTES :
      - Utilise un ton professionnel, chaleureux et expert.
      - Utilise des émojis pour rendre la lecture agréable sur mobile.
      - Fais des paragraphes courts et bien espacés.
      - Ne mentionne pas que tu es une IA.
    `;

    // 3. Appeler OpenAI
    let aiResponse = '';
    if (this.openai) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { 
              role: 'system', 
              content: 'Tu es Lumina AI, un consultant en gestion d\'entreprise africaine. Tu rédiges des rapports WhatsApp clairs, structurés et riches en conseils.' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        });
        aiResponse = completion.choices[0]?.message?.content ?? 'Impossible de générer l\'analyse.';
      } catch (err) {
        this.logger.error(`Erreur OpenAI: ${(err as Error).message}`);
        aiResponse = `[Lumina] Vos ventes d'aujourd'hui : ${summary.totalSales} XAF. (L'analyse détaillée est indisponible).`;
      }
    } else {
      aiResponse = `🌟 *Rapport Journalier Lumina* 🌟\n\nFélicitations pour votre journée chez *${orgName}* !\n\n📈 Ventes : ${summary.totalSales} XAF\n💰 Bénéfice : ${summary.netRevenue} XAF\n💳 Cash : ${summary.cashAmount} XAF\n📱 Mobile Money : ${summary.mobileMoneyAmount} XAF\n\nConseil : Continuez sur cette lancée ! 🚀`;
    }

    // 4. Récupérer le téléphone de l'admin
    const adminPhone = await this.getAdminPhoneNumber(organizationId);
    this.logger.log(`🔍 Recherche numéro admin pour l'org ${organizationId} : ${adminPhone || 'AUCUN TROUVÉ'}`);

    // 5. Envoyer sur WhatsApp
    if (adminPhone) {
      this.logger.log(`📤 Tentative d'envoi WhatsApp vers ${adminPhone}...`);
      await this.whatsappService.sendMessage(adminPhone, aiResponse);
    } else {
      this.logger.warn(`⚠️ Impossible d'envoyer le rapport : aucun numéro trouvé pour l'org ${organizationId}`);
    }

    return { report: aiResponse, rawData: summary };
  }

  /**
   * Récupère le numéro de téléphone de l'administrateur de l'organisation.
   */
  private async getAdminPhoneNumber(organizationId: string): Promise<string | null> {
    const { data, error } = await this.supabaseService.adminClient
      .from('users')
      .select('phone')
      .eq('organization_id', organizationId)
      .eq('role', UserRole.ORG_ADMIN)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data?.phone) return null;
    return data.phone;
  }
}
