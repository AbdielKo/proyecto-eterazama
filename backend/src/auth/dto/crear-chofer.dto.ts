import {
  IsEmail,
  IsOptional,
  IsString,
  IsNumber,
  Length,
  MaxLength,
  Min,
  IsArray,
  IsInt,
} from 'class-validator';

export class CrearChoferDto {
  @IsString()
  @Length(3, 50)
  nombreUsuario: string;

  @IsString()
  @Length(6, 100)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidos?: string;

  @IsOptional()
  @IsEmail()
  gmail?: string;

  @IsOptional()
  @IsString()
  @Length(7, 20)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ci?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  placa?: string;

  @IsOptional()
  @IsNumber()
  @Min(4)
  capacidadTotal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipoVehiculo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsArray()
  filas?: (number | null)[][];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  asientosChofer?: number[];
}
