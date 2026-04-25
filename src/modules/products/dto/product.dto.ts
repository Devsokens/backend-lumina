import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Boissons' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '#FF6B35' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Bière Régab 65cl' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'BRG-065' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: '3270190207924' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ example: 1500, description: 'Prix de vente en XAF' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional({ example: 900, description: 'Prix d\'achat (coût) en XAF' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice?: number;

  @ApiPropertyOptional({ example: 50, description: 'Quantité initiale en stock' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 5, description: 'Seuil d\'alerte stock bas' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  alertThreshold?: number;

  @ApiPropertyOptional({ description: 'ID de la catégorie' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Date de péremption (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Métadonnées JSON personnalisées' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class UpdateStockDto {
  @ApiProperty({ example: 20, description: 'Quantité à ajouter (positive) ou retirer (négative)' })
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ example: 'Réception fournisseur SEEG' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ProductQueryDto {
  @ApiPropertyOptional({ example: 'Bière' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filtrer les produits en stock bas' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  lowStock?: boolean;
}
