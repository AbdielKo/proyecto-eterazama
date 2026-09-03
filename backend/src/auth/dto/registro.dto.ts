import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class RegistroDto {
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
}