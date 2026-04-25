import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationSector } from '../../../shared/types';

/**
 * DTO d'inscription — Crée une organisation et son premier administrateur.
 * Règle .antigravityrules : Validation class-validator sur tous les DTOs.
 */
export class RegisterDto {
  // ─── Informations de l'organisation ──────────────────────
  @ApiProperty({ example: 'Bar Le Prestige', description: 'Nom de votre entreprise' })
  @IsString()
  @IsNotEmpty()
  organizationName: string;

  @ApiProperty({
    enum: OrganizationSector,
    example: OrganizationSector.RESTAURANT,
    description: 'Secteur d\'activité de votre entreprise',
  })
  @IsEnum(OrganizationSector)
  sector: OrganizationSector;

  // ─── Informations du premier administrateur ───────────────
  @ApiProperty({ example: 'Jean-Marie', description: 'Prénom' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Nguema', description: 'Nom de famille' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'contact@leprestige.ga', description: 'Email de connexion' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MotDePasse123!', description: 'Mot de passe (min. 8 caractères)' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  password: string;

  @ApiPropertyOptional({ example: '+24177123456', description: 'Numéro WhatsApp pour les notifications' })
  @IsOptional()
  @IsString()
  phone?: string;
}

/**
 * DTO de connexion.
 */
export class LoginDto {
  @ApiProperty({ example: 'contact@leprestige.ga' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MotDePasse123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

/**
 * DTO de renouvellement du token d'accès via le refresh token.
 */
export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token obtenu lors du login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
