import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
} from 'class-validator';

export class ActualizarConfiguracionDto {
  @IsString()
  @IsOptional()
  nombreSindicato?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100000)
  precioCochabamba: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100000)
  precioEterazama: number;

  @IsString()
  @IsOptional()
  horarioApertura?: string;

  @IsString()
  @IsOptional()
  horarioCierre?: string;
}