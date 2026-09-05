import { IsIn, IsString, IsOptional, MaxLength } from 'class-validator';

export class ResponderRetiroDto {
  @IsString()
  @IsIn(['ACEPTADA', 'RECHAZADA'])
  estado: 'ACEPTADA' | 'RECHAZADA';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  comentario?: string;
}
