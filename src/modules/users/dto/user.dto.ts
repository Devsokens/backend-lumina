import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserRole } from '../../../shared/types';

/**
 * DTO de création d'un utilisateur (invitation par un admin).
 */
export class CreateUserDto {
  @ApiProperty({ example: 'Alice' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Moussavou' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'alice@leprestige.ga' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'TempPass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.WAITER })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: '+24177987654' })
  @IsOptional()
  @IsString()
  phone?: string;
}

/**
 * DTO de mise à jour partielle d'un utilisateur.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}

/**
 * DTO de changement de mot de passe.
 */
export class ChangePasswordDto {
  @ApiProperty({ description: 'Ancien mot de passe' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'Nouveau mot de passe (min. 8 caractères)' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
