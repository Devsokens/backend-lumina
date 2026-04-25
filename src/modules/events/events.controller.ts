import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto, BuyTicketDto, ScanTicketDto } from './dto/events.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { UserRole } from '../../shared/types';
import type { JwtPayload } from '../../shared/types';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ─── ÉVÉNEMENTS ───────────────────────────────────────────

  @ApiBearerAuth('JWT-Auth')
  @Post()
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Créer un événement' })
  createEvent(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
    return this.eventsService.createEvent(dto, user.organizationId);
  }

  @ApiBearerAuth('JWT-Auth')
  @Get()
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.EVENT_SCANNER)
  @ApiOperation({ summary: 'Lister les événements' })
  findAllEvents(@CurrentUser() user: JwtPayload) {
    return this.eventsService.findAllEvents(user.organizationId);
  }

  // ─── BILLETS ──────────────────────────────────────────────

  /**
   * Endpoint public : un client achète son billet depuis une landing page
   */
  @Public()
  @Post('tickets/buy')
  @ApiOperation({ summary: '[Public] Acheter un billet (génère le QR Code)' })
  buyTicket(@Body() dto: BuyTicketDto) {
    // Note: Pour cet endpoint public, il faudrait passer l'organizationId en paramètre
    // ou le déduire depuis l'eventId. Simplification ici.
    // Idéalement : extraire l'orgId depuis la DB.
    return this.eventsService.buyTicket(dto, 'org-id-from-event');
  }

  // ─── SCANNER ──────────────────────────────────────────────

  @ApiBearerAuth('JWT-Auth')
  @Post('tickets/scan')
  @Roles(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.EVENT_SCANNER)
  @ApiOperation({ summary: 'Scanner et valider un billet à l\'entrée' })
  scanTicket(@Body() dto: ScanTicketDto, @CurrentUser() user: JwtPayload) {
    return this.eventsService.scanTicket(dto, user.organizationId, user);
  }
}
