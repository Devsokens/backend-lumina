import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../../../shared/types';

// ─── TABLES ───────────────────────────────────────────────

export class CreateTableDto {
  @ApiProperty({ example: '1A' })
  @IsString()
  @IsNotEmpty()
  tableNumber: string;

  @ApiProperty({ example: 4 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  capacity: number;
}

// ─── COMMANDES ────────────────────────────────────────────

export class OrderItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ example: 'Sans glaçons' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  tableId: string;

  @ApiPropertyOptional({ description: 'Notes générales de la commande' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class CancelOrderDto {
  @ApiProperty({ example: 'Client parti sans consommer' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
