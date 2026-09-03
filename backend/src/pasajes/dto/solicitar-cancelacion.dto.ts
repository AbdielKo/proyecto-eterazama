import { IsOptional, IsString } from 'class-validator';

export class SolicitarCancelacionDto {
  @IsString()
  @IsOptional()
  motivo?: string;
}