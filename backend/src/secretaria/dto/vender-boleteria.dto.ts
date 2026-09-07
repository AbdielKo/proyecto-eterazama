import {
  Type,
} from 'class-transformer';

import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class AsientoPasajeroDto {
  @IsInt()
  @Min(1)
  asiento: number;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  ci?: string;

  @IsString()
  @IsOptional()
  telefono?: string;
}

export class VentaBoleteriaDto {
  @IsInt()
  @IsNotEmpty()
  vehiculoId: number;

  @IsArray()
  @IsNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  asientos: number[];

  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => AsientoPasajeroDto)
  pasajeros: AsientoPasajeroDto[];

  @IsString()
  @IsIn(['cochabamba', 'eterazama'])
  tramo: 'cochabamba' | 'eterazama';

  @IsString()
  @IsNotEmpty()
  contactoRecibo: string;

  @IsString()
  @IsOptional()
  ciRecibo?: string;

  @IsString()
  @IsOptional()
  telefonoRecibo?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  montoEncomienda?: number;

  @IsString()
  @IsIn(['EFECTIVO'])
  @IsOptional()
  metodoPago?: 'EFECTIVO';
}