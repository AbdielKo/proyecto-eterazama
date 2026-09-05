import { IsString, IsOptional, IsNumber, IsArray, IsInt } from 'class-validator';

export class CrearVehiculoDto {
  @IsString()
  choferNombre: string;

  @IsOptional()
  @IsString()
  choferCi?: string;

  @IsOptional()
  @IsString()
  qrImagenUrl?: string;

  @IsString()
  tipoVehiculo: string;

  @IsString()
  color: string;

  @IsString()
  placa: string;

  @IsOptional()
  @IsString()
  paradaActual?: string;

  @IsOptional()
  @IsNumber()
  puestoFila?: number;

  @IsNumber()
  capacidadTotal: number;

  @IsOptional()
  @IsArray()
  filas?: (number | null)[][];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  asientosChofer?: number[];
}