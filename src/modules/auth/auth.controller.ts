import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import { Public } from '../../shared/decorators/public.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtPayload } from '../../shared/types';

/**
 * Contrôleur Auth — Gère l'inscription, la connexion et les sessions.
 * Toutes les routes ici sont @Public() sauf /logout.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/register
   * Crée une organisation et son premier administrateur.
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Créer un compte entreprise (organisation + admin)' })
  @ApiResponse({ status: 201, description: 'Compte créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /api/v1/auth/login
   * Authentifie un utilisateur et retourne les tokens JWT.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion utilisateur' })
  @ApiResponse({ status: 200, description: 'Connexion réussie, tokens retournés' })
  @ApiResponse({ status: 401, description: 'Email ou mot de passe incorrect' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /api/v1/auth/refresh
   * Renouvelle l'access token à partir du refresh token.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouveler l\'access token' })
  @ApiResponse({ status: 200, description: 'Nouveau access token généré' })
  @ApiResponse({ status: 401, description: 'Refresh token invalide ou expiré' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  /**
   * POST /api/v1/auth/logout
   * Révoque le refresh token de l'utilisateur connecté.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déconnexion (révoque le refresh token)' })
  @ApiResponse({ status: 200, description: 'Déconnecté avec succès' })
  async logout(@CurrentUser() user: JwtPayload) {
    await this.authService.logout(user.sub);
    return { message: 'Vous avez été déconnecté avec succès.' };
  }

  /**
   * POST /api/v1/auth/me
   * Retourne les informations de l'utilisateur connecté.
   */
  @Post('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Profil de l\'utilisateur connecté' })
  async me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
