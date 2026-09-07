import { IsArray, IsInt, IsNumber, IsString, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class RegistrarVentaDto {
  @IsOptional()
  @IsInt()
  vehiculoId?: number;

  @IsString()
  @IsNotEmpty()
  pasajeroNombre: string;

  @IsString()
  @IsNotEmpty()
  placaVehiculo: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  asientos: number[];

  // Campos de compatibilidad con la compra pública existente: se aceptan para
  // no romper el flujo del pasajero, pero el backend NUNCA los usa como
  // fuente de verdad (precios y montos se recalculan desde la configuración).
  // El ValidationPipe global tiene whitelist + forbidNonWhitelisted: cualquier
  // campo que no esté declarado aquí (rol, usuarioId, vendedorId, estadoBoleto,
  // etc.) es rechazado.
  @IsOptional()
  @IsNumber()
  montoAsientos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoEncomienda?: number;

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