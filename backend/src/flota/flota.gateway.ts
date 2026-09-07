import {
  WebSocketGateway,
  WebSocketServer,
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

  // Única vía de emisión: el SERVIDOR la dispara cuando realmente cambia la
  // fila o un asiento. Los clientes NO pueden pedir broadcasts (se eliminó el
  // handler 'actualizarEstado' para evitar amplificación/DoS desde cualquier
  // cliente anónimo conectado).
  notificarCambioFlota() {
    this.server.emit('flotaActualizada', { timestamp: new Date() });
  }
}