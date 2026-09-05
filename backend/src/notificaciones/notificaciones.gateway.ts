import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

// Gateway de notificaciones del pasajero. Usa el mismo namespace por defecto
// y las mismas opciones CORS que el FlotaGateway existente.
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificacionesGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  // El cliente se identifica con su JWT y entra al room `pasajero:{userId}`.
  // Solo recibe notificaciones el usuario dueño de ese JWT.
  @SubscribeMessage('identificar')
  identificar(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { token?: string },
  ) {
    const token = body?.token;
    if (!token) return;

    try {
      const payload = this.jwtService.verify(token) as { sub?: string };
      if (payload?.sub) {
        client.join(`pasajero:${payload.sub}`);
      }
    } catch {
      // Token inválido: el cliente no entra al room y no recibe nada.
    }
  }

  emitir(usuarioId: string, datos: unknown) {
    this.server.to(`pasajero:${usuarioId}`).emit('notificacionPasajero', datos);
  }
}