import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';

import { SalidasService } from './salidas.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES } from '../auth/roles';

@Controller('secretaria/notificaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
export class NotificacionesSecretariaController {
  constructor(private readonly salidasService: SalidasService) {}

  // Listar las notificaciones del rol SECRETARIA del usuario autenticado.
  @Get()
  obtener(@Request() req: any) {
    return this.salidasService.obtenerNotificacionesSecretaria(req.user.userId);
  }

  // Marcar como leída UNA notificación (solo si es de la secretaria autenticada).
  @Patch(':id/leer')
  marcarLeida(@Request() req: any, @Param('id') id: string) {
    return this.salidasService.marcarSecretariaNotificacionLeida(
      req.user.userId,
      id,
    );
  }

  // Marcar todas las notificaciones como leídas.
  @Patch('todas-leer')
  marcarTodasLeidas(@Request() req: any) {
    return this.salidasService.marcarTodasSecretariaLeidas(req.user.userId);
  }
}