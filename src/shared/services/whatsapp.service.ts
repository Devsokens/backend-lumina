import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service WhatsApp — Intégration avec l'API Cloud WhatsApp Business.
 * Règle .antigravityrules : Utilisation des API officielles pour la pérennité.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('whatsapp.accessToken') || '';
    this.phoneNumberId = this.configService.get<string>('whatsapp.phoneNumberId') || '';
    // L'URL par défaut de Facebook Graph API
    this.baseUrl = this.configService.get<string>('whatsapp.apiUrl') || 'https://graph.facebook.com/v17.0';
  }

  /**
   * Envoie un message texte simple à un numéro spécifique.
   * @param to Numéro de téléphone au format international (ex: 24107000000)
   * @param message Contenu du message
   */
  async sendMessage(to: string, message: string): Promise<boolean> {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn('⚠️ WhatsApp non configuré (Token ou Phone ID manquant). Envoi simulé.');
      this.logger.debug(`[SIMULATION WHATSAPP to ${to}]: ${message}`);
      return true;
    }

    // Nettoyage du numéro : enlever les '+' et espaces
    const cleanNumber = to.replace(/\D/g, '');

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanNumber,
          type: 'text',
          text: { body: message },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`❌ Échec envoi WhatsApp: ${JSON.stringify(data)}`);
        return false;
      }

      this.logger.log(`✅ Message WhatsApp envoyé avec succès à ${cleanNumber}`);
      return true;
    } catch (err) {
      this.logger.error(`❌ Erreur réseau lors de l'envoi WhatsApp: ${(err as Error).message}`);
      return false;
    }
  }
}
