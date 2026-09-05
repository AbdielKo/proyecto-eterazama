import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';

import { NotificacionesService } from './notificaciones.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES } from '../auth/roles';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.USUARIO)
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
  ) {}

  // Listar las notificaciones del pasajero autenticado.
  @Get()
  obtener(@Request() req: any) {
    return this.notificacionesService.obtener(req.user.userId);
  }

  // Marcar como leída UNA notificación (solo si es del usuario autenticado).
  @Patch(':id/leer')
  marcarLeida(@Request() req: any, @Param('id') id: string) {
    return this.notificacionesService.marcarLeida(req.user.userId, id);
  }

  // Marcar todas como leídas.
  @Patch('todas-leer')
  marcarTodasLeidas(@Request() req: any) {
    return this.notificacionesService.marcarTodasLeidas(req.user.userId);
  }
}