import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsUUID,
} from 'class-validator';


export class CreateReviewDto {


  @IsUUID()
  usuarioId:string;


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