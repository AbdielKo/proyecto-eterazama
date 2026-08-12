import { IsNumber, IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class RegistrarVentaDto {
  @IsNumber()
  @IsNotEmpty()
  vehiculoId: number;

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

  @IsString()
  @IsNotEmpty()
  tramo: string;

  @IsString()
  @IsOptional()
  contactoRecibo?: string;
}