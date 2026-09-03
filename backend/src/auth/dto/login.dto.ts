import {
  IsString,
  Length,
} from 'class-validator';

export class LoginDto {
  @IsString()
  nombreUsuario: string;

  @IsString()
  @Length(1, 100)
  password: string;
}