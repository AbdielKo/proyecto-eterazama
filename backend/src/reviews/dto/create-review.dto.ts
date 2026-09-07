import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsUUID,
} from 'class-validator';


export class CreateReviewDto {


  // Informativo: el backend SIEMPRE usa el usuario autenticado del JWT.
  @IsOptional()
  @IsUUID()
  usuarioId?:string;


  @IsInt()
  vehiculoId:number;


  @IsOptional()
  @IsUUID()
  pasajeId?:string;


  @IsInt()
  @Min(1)
  @Max(5)
  estrellas:number;


  @IsOptional()
  @IsString()
  comentario?:string;

}