import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmarReembolsoDto {
  @IsString()
  @IsNotEmpty()
  motivo: string;
}