import {
  IsArray,
  IsInt,
  ArrayMinSize,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

// Cada fila es un array de celdas: número de asiento o null (espacio vacío).
// El número de asiento es la única numeración oficial (libre por fila).
export class ConfigurarAsientosDto {
  @IsOptional()
  @IsInt()
  ancho?: number;

  @IsArray()
  @ArrayMinSize(1)
  filas: (number | null)[][];

  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty()
  asientosChofer: number[];
}
