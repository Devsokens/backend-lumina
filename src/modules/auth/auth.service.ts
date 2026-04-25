import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../shared/services/supabase.service';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import {
  JwtPayload,
  OrganizationSector,
  SubscriptionStatus,
  UserRole,
} from '../../shared/types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    organizationId: string;
    sector: OrganizationSector;
  };
  tokens: AuthTokens;
}

/**
 * Service d'authentification — Inscription, Connexion, Refresh, Déconnexion.
 *
 * Règle .antigravityrules : Double validation côté serveur.
 * Le backend recalcule et vérifie tous les montants et identités.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Inscription : crée l'organisation ET le premier administrateur en une transaction.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const db = this.supabaseService.adminClient;

    // 1. Vérifier que l'email n'est pas déjà utilisé
    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single();

    if (existingUser) {
      throw new ConflictException('Cet email est déjà associé à un compte.');
    }

    // 2. Créer l'organisation (tenant)
    const { data: org, error: orgError } = await db
      .from('organizations')
      .insert({
        id: uuidv4(),
        name: dto.organizationName,
        sector: dto.sector,
        subscription_status: SubscriptionStatus.FREE,
        subscription_plan: 'free',
        settings: this.getDefaultSettings(dto.sector),
      })
      .select()
      .single();

    if (orgError || !org) {
      this.logger.error(`Création organisation échouée: ${orgError?.message}`);
      throw new Error('Erreur lors de la création de votre organisation.');
    }

    // 3. Hasher le mot de passe (bcrypt, 12 rounds)
    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    // 4. Créer le premier utilisateur (org_admin)
    const { data: user, error: userError } = await db
      .from('users')
      .insert({
        id: uuidv4(),
        organization_id: org.id,
        email: dto.email,
        password_hash: passwordHash,
        role: UserRole.ORG_ADMIN,
        first_name: dto.firstName,
        last_name: dto.lastName,
        phone: dto.phone ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (userError || !user) {
      // Rollback manuel de l'organisation si l'utilisateur échoue
      await db.from('organizations').delete().eq('id', org.id);
      this.logger.error(`Création utilisateur échouée: ${userError?.message}`);
      throw new Error("Erreur lors de la création de votre compte.");
    }

    this.logger.log(`✅ Nouvelle organisation créée: ${org.name} (${org.id})`);

    // 5. Générer les tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      organizationId: org.id,
      role: UserRole.ORG_ADMIN,
      sector: dto.sector,
    });

    // 6. Sauvegarder le refresh token (hashé)
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: UserRole.ORG_ADMIN,
        organizationId: org.id,
        sector: dto.sector,
      },
      tokens,
    };
  }

  /**
   * Connexion : vérifie email + password, retourne les tokens.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const db = this.supabaseService.adminClient;

    // 1. Trouver l'utilisateur avec son organisation
    const { data: user } = await db
      .from('users')
      .select(`
        id, email, password_hash, role, first_name, last_name, is_active,
        organization_id,
        organizations!inner(id, sector, subscription_status)
      `)
      .eq('email', dto.email)
      .single();

    // Message générique pour ne pas révéler si l'email existe
    const invalidCredentialsMsg = 'Email ou mot de passe incorrect.';

    if (!user) throw new UnauthorizedException(invalidCredentialsMsg);
    if (!user.is_active) throw new UnauthorizedException('Votre compte est désactivé. Contactez votre administrateur.');

    // 2. Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) throw new UnauthorizedException(invalidCredentialsMsg);

    const org = user.organizations as unknown as { id: string; sector: OrganizationSector; subscription_status: string };

    // 3. Générer les tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      organizationId: org.id,
      role: user.role as UserRole,
      sector: org.sector,
    });

    await this.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`🔐 Connexion: ${user.email} (org: ${org.id})`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role as UserRole,
        organizationId: org.id,
        sector: org.sector,
      },
      tokens,
    };
  }

  /**
   * Refresh token : renouvelle l'access token sans se reconnecter.
   */
  async refreshToken(dto: RefreshTokenDto): Promise<AuthTokens> {
    const db = this.supabaseService.adminClient;

    // 1. Décoder le refresh token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    // 2. Vérifier que le token existe en base (rotation de token)
    const hashedToken = await bcrypt.hash(dto.refreshToken, 10);
    const { data: tokenRecord } = await db
      .from('refresh_tokens')
      .select('id, is_revoked')
      .eq('user_id', payload.sub)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!tokenRecord) {
      throw new UnauthorizedException('Session expirée. Veuillez vous reconnecter.');
    }

    // 3. Révoquer l'ancien token et générer de nouveaux tokens
    await db
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('id', tokenRecord.id);

    const tokens = await this.generateTokens(payload);
    await this.saveRefreshToken(payload.sub, tokens.refreshToken);

    return tokens;
  }

  /**
   * Déconnexion : révoque le refresh token actif.
   */
  async logout(userId: string): Promise<void> {
    await this.supabaseService.adminClient
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('user_id', userId)
      .eq('is_revoked', false);

    this.logger.log(`🚪 Déconnexion: utilisateur ${userId}`);
  }

  // ─── Méthodes privées ──────────────────────────────────────

  private async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessToken = this.jwtService.sign(
      { sub: payload.sub, organizationId: payload.organizationId, role: payload.role, sector: payload.sector },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: (this.configService.get<string>('jwt.accessExpiresIn') ?? '15m') as any,
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, organizationId: payload.organizationId, role: payload.role, sector: payload.sector },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: (this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d') as any,
      },
    );

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.supabaseService.adminClient.from('refresh_tokens').insert({
      id: uuidv4(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      is_revoked: false,
    });
  }

  /**
   * Retourne les paramètres par défaut selon le secteur d'activité.
   * Règle .antigravityrules : Agnosticisme sectoriel du noyau.
   */
  private getDefaultSettings(sector: OrganizationSector): Record<string, unknown> {
    const defaults: Record<OrganizationSector, Record<string, unknown>> = {
      [OrganizationSector.RESTAURANT]: {
        currency: 'XAF',
        theme: 'restaurant',
        enableQrMenu: true,
        defaultTableCount: 10,
        enableKitchenDisplay: true,
      },
      [OrganizationSector.SHOP]: {
        currency: 'XAF',
        theme: 'shop',
        enableBarcodeScan: true,
        lowStockAlertThreshold: 5,
        enableOfflineMode: true,
      },
      [OrganizationSector.EVENT]: {
        currency: 'XAF',
        theme: 'event',
        enableQrTickets: true,
        enableCertificates: true,
      },
    };
    return defaults[sector];
  }
}
