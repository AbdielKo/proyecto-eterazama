import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

// Gateway de notificaciones de la secretaría. Usa el mismo namespace por
// defecto y las mismas opciones CORS que los gateways existentes.
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificacionesSecretariaGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  // La secretaria se identifica con su JWT y entra al room `secretaria:{userId}`.
  // Solo recibe notificaciones la titular de ese JWT.
  @SubscribeMessage('identificarSecretaria')
  identificar(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { token?: string },
  ) {
    const token = body?.token;
    if (!token) return;

    try {
      const payload = this.jwtService.verify(token) as { sub?: string };
      if (payload?.sub) {
        client.join(`secretaria:${payload.sub}`);
      }
    } catch {
      // Token inválido: la secretaria no entra al room y no recibe nada.
    }
  }

  emitir(secretariaId: string, datos: unknown) {
    this.server.to(`secretaria:${secretariaId}`).emit('notificacionSecretaria', datos);
  }
}