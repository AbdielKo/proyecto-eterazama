import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class FlotaGateway {
  @WebSocketServer()
  server: Server;

  // Notificar a todos los clientes cuando cambie la fila o un asiento
  notificarCambioFlota() {
    this.server.emit('flotaActualizada', { timestamp: new Date() });
  }

  // Escuchar eventos desde los clientes si fuera necesario
  @SubscribeMessage('actualizarEstado')
  handleActualizar(@MessageBody() data: any) {
    this.notificarCambioFlota();
  }
}