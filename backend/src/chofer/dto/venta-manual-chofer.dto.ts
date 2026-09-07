import {
  Type,
} from 'class-transformer';

import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

import { AsientoPasajeroDto } from '../../secretaria/dto/vender-boleteria.dto';

// Entrada de la venta manual que hace el CHOFER. NO contiene vehiculoId,
// monto, parada, fila, sentido ni tramo: el backend los determina desde el
// JWT y el estado actual de la base de datos (vehículo asignado, fila,
// posición y sentido que corresponde a la parada). El pago SIEMPRE es
// EFECTIVO. El único dato del recibo pedido al chofer es el CELULAR del
// pasajero (número boliviano de 8 dígitos) porque es el destino del envío por
// WhatsApp; no se piden nombre de contacto, correo ni CI. Cualquier campo
// extra es rechazado por el ValidationPipe global (whitelist +
// forbidNonWhitelisted), evitando que el cliente manipule precios, vehículos
// o sentidos.
export class VentaManualChoferDto {
  @IsArray()
  @IsNotEmpty()
  asientos: number[];

  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => AsientoPasajeroDto)
  pasajeros: AsientoPasajeroDto[];

  @IsString()
  @Matches(/^[67]\d{7}$/, {
    message:
      'El celular del pasajero debe ser un número boliviano de 8 dígitos (ej: 71234567).',
  })
  celular: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  montoEncomienda?: number;
}