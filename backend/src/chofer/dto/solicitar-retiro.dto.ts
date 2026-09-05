import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SolicitarRetiroDto {
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
