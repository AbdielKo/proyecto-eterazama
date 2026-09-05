import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { NotificacionPasajero } from './notificacion-pasajero.entity';
import { NotificacionesGateway } from './notificaciones.gateway';

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(NotificacionPasajero)
    private readonly notificacionRepo: Repository<NotificacionPasajero>,
    private readonly gateway: NotificacionesGateway,
  ) {}

  // Solo se devuelven las notificaciones del usuario autenticado
  // (req.user.userId). Nunca se filtra por un id enviado desde el frontend.
  async obtener(usuarioId: string) {
    return this.notificacionRepo.find({
      where: { usuarioId },
      order: { fechaCreacion: 'DESC' },
    });
  }

  async marcarLeida(usuarioId: string, notificacionId: string) {
    const notificacion = await this.notificacionRepo.findOne({
      where: { id: notificacionId, usuarioId },
    });

    if (!notificacion) {
      throw new NotFoundException('Notificación no encontrada');
    }

    notificacion.leida = true;
    return this.notificacionRepo.save(notificacion);
  }

  async marcarTodasLeidas(usuarioId: string) {
    await this.notificacionRepo.update(
      { usuarioId, leida: false },
      { leida: true },
    );
    return { success: true };
  }

  // Crea y persiste la notificación DENTRO de la misma transacción del evento.
  // Si la operación principal hace rollback, la notificación no queda guardada.
  async crearEnTransaccion(
    manager: EntityManager,
    usuarioId: string,
    tipo: string,
    titulo: string,
    mensaje: string,
  ): Promise<NotificacionPasajero> {
    const notificacion = manager.create(NotificacionPasajero, {
      usuarioId,
      tipo,
      titulo,
      mensaje,
    });
    return manager.save(NotificacionPasajero, notificacion);
  }

  // Emisión WebSocket DESPUÉS del commit (best-effort). Si el WS falla, la
  // notificación ya está persistida en PostgreSQL y se consulta por GET.
  notificarWS(usuarioId: string, notificacion: NotificacionPasajero) {
    this.gateway.emitir(usuarioId, notificacion);
  }
}