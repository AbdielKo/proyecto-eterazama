import { IsNumber, IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class RegistrarVentaDto {
  // Identificador del vehículo (si el cliente lo envía). Si no viene,
  // se resuelve por placaVehiculo.
  @IsOptional()
  @IsNumber()
  vehiculoId?: number;

  @IsString()
  @IsNotEmpty()
  pasajeroNombre: string;

  @IsString()
  @IsNotEmpty()
  placaVehiculo: string;

  @IsArray()
  asientos: number[];

  @IsNumber()
  montoAsientos: number;

  @IsNumber()
  montoEncomienda: number;

  // Solo informativo: el backend siempre recalcula montoTotal.
  @IsOptional()
  @IsNumber()
  montoTotal?: number;

  @IsString()
  @IsNotEmpty()
  tramo: string;

  @IsString()
  @IsOptional()
  contactoRecibo?: string;
}