import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CrearTipoVehiculoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;
}
