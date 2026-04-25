import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── ÉVÉNEMENTS ───────────────────────────────────────────

export class CreateEventDto {
  @ApiProperty({ example: 'Festival de la Musique' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-12-31T20:00:00Z' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ example: 'Stade de l\'Amitié' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ example: 5000, description: 'Capacité maximale' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  capacity: number;

  @ApiProperty({ example: 10000, description: 'Prix du billet standard' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  ticketPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}

// ─── BILLETS ──────────────────────────────────────────────

export class BuyTicketDto {
  @ApiProperty()
  @IsUUID()
  eventId: string;

  @ApiProperty({ example: 'Jean Dupont' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: '+24177123456' })
  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string;
}

export class ScanTicketDto {
  @ApiProperty({ description: 'Le hash unique du QR Code scanné' })
  @IsString()
  @IsNotEmpty()
  qrCodeHash: string;
}
