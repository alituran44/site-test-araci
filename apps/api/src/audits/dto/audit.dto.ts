import { IsUrl, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAuditDto {
  @ApiProperty({ example: 'https://example.com' })
  @IsUrl({}, { message: 'Please provide a valid URL' })
  url: string;

  @ApiProperty({ required: false, description: 'AI provider to use' })
  @IsOptional()
  @IsString()
  aiProvider?: 'openai' | 'gemini';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brandColor?: string;
}

export class AuditFilterDto {
  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;

  @IsOptional()
  status?: string;
}
