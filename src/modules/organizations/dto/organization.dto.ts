import {
  IsEnum,
  IsJSON,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OrganizationSector, SubscriptionStatus } from '../../../shared/types';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Bar Le Prestige 2.0' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'Paramètres JSON personnalisés (currency, theme, etc.)',
    example: { currency: 'XAF', enableQrMenu: true },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class UpdateSubscriptionDto {
  @ApiProperty({ enum: SubscriptionStatus })
  @IsEnum(SubscriptionStatus)
  subscriptionStatus: SubscriptionStatus;

  @ApiProperty({ example: 'pro' })
  @IsString()
  @IsNotEmpty()
  subscriptionPlan: string;
}
