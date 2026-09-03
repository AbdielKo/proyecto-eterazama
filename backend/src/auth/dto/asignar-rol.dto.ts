import { IsString } from 'class-validator';

export class AsignarRolDto {
  @IsString()
  rol: string;
}
