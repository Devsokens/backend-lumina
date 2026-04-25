import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as qrcode from 'qrcode';
import { SupabaseService } from '../../shared/services/supabase.service';
import { ConfigService } from '@nestjs/config';
import { CreateEventDto, BuyTicketDto, ScanTicketDto } from './dto/events.dto';
import { JwtPayload, TicketPaymentStatus } from '../../shared/types';

@Injectable()
export class EventsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  // ─── ÉVÉNEMENTS ───────────────────────────────────────────

  async createEvent(dto: CreateEventDto, organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('events')
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        ...dto,
        is_published: dto.isPublished ?? false,
      })
      .select()
      .single();

    if (error) throw new Error('Erreur lors de la création de l\'événement.');
    return data;
  }

  async findAllEvents(organizationId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('events')
      .select('*, tickets(count)')
      .eq('organization_id', organizationId)
      .order('date', { ascending: false });

    if (error) throw new Error('Erreur lors de la récupération des événements.');
    return data;
  }

  // ─── BILLETS ──────────────────────────────────────────────

  async buyTicket(dto: BuyTicketDto, organizationId: string) {
    const db = this.supabaseService.adminClient;

    // 1. Vérifier la capacité
    const { data: event } = await db
      .from('events')
      .select('capacity, ticket_price')
      .eq('id', dto.eventId)
      .eq('organization_id', organizationId)
      .single();

    if (!event) throw new NotFoundException('Événement introuvable.');

    const { count } = await db
      .from('tickets')
      .select('id', { count: 'exact' })
      .eq('event_id', dto.eventId);

    if ((count ?? 0) >= event.capacity) {
      throw new BadRequestException('Événement complet.');
    }

    // 2. Générer le QR Code Hash unique
    const rawQrData = `${dto.eventId}-${dto.customerPhone}-${Date.now()}`;
    const qrCodeHash = crypto.createHash('sha256').update(rawQrData).digest('hex');

    // 3. Créer le billet
    const { data: ticket, error } = await db
      .from('tickets')
      .insert({
        id: uuidv4(),
        event_id: dto.eventId,
        organization_id: organizationId,
        customer_name: dto.customerName,
        customer_phone: dto.customerPhone,
        customer_email: dto.customerEmail ?? null,
        qr_code_hash: qrCodeHash,
        is_scanned: false,
        payment_status: TicketPaymentStatus.PENDING,
      })
      .select()
      .single();

    if (error) throw new Error('Erreur lors de la création du billet.');

    // 4. Générer l'image du QR Code pour le client
    const qrCodeDataUrl = await qrcode.toDataURL(qrCodeHash);

    return { ticket, qrCodeDataUrl };
  }

  // ─── SCANNER ──────────────────────────────────────────────

  async scanTicket(dto: ScanTicketDto, organizationId: string, currentUser: JwtPayload) {
    const db = this.supabaseService.adminClient;

    // 1. Trouver le billet avec ce hash
    const { data: ticket } = await db
      .from('tickets')
      .select('id, is_scanned, payment_status, event_id, customer_name')
      .eq('qr_code_hash', dto.qrCodeHash)
      .eq('organization_id', organizationId)
      .single();

    if (!ticket) throw new NotFoundException('Billet invalide ou introuvable.');

    // 2. Vérifications métier
    if (ticket.payment_status !== TicketPaymentStatus.PAID) {
      throw new BadRequestException('Ce billet n\'est pas encore payé.');
    }

    if (ticket.is_scanned) {
      throw new BadRequestException('Ce billet a DÉJÀ ÉTÉ SCANNÉ.');
    }

    // 3. Marquer comme scanné
    const { error } = await db
      .from('tickets')
      .update({
        is_scanned: true,
        scanned_at: new Date().toISOString(),
        scanned_by: currentUser.sub,
      })
      .eq('id', ticket.id);

    if (error) throw new Error('Erreur lors de la validation du billet.');

    // 4. (Optionnel) Déclencher la génération du certificat de présence
    // this.eventEmitter.emit('ticket.scanned', { ticketId: ticket.id });

    return {
      message: 'Billet valide et scanné avec succès !',
      customerName: ticket.customer_name,
    };
  }
}
