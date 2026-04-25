import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiPropertyOptional({ example: '2024-12-31', description: 'Date spécifique pour le rapport (défaut: aujourd\'hui)' })
  @IsOptional()
  @IsString()
  date?: string;
}

export class ChatPromptDto {
  @ApiProperty({ example: 'Quels sont les produits qui se vendent le moins bien ?' })
  @IsString()
  @IsNotEmpty()
  prompt: string;
}
