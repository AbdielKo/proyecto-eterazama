import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

// Guard que permite solicitudes SIN token (deja req.user = null) y usa
// req.user.userId solo cuando viene un JWT válido. Se usa para vincular la
// compra de un pasaje al usuario autenticado sin romper compras anónimas.
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err) {
      throw err;
    }
    return (user as TUser) || (null as TUser);
  }
}