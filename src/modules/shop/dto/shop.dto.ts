import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryMovementType, PurchaseOrderStatus } from '../../../shared/types';

// ─── FOURNISSEURS ─────────────────────────────────────────

export class CreateSupplierDto {
  @ApiProperty({ example: 'SOBOA' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Jean Dupont' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ example: '+24177123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@soboa.ga' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

// ─── INVENTAIRE ───────────────────────────────────────────

export class InventoryMovementDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ enum: InventoryMovementType })
  @IsEnum(InventoryMovementType)
  type: InventoryMovementType;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ description: 'Coût unitaire lors d\'un réapprovisionnement' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Raison (ex: bouteille cassée)' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── CRM CLIENTS ──────────────────────────────────────────

export class CreateCustomerDto {
  @ApiProperty({ example: 'Marc' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '+24177112233', description: 'Numéro WhatsApp' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}
