import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resMessage = exception.getResponse();
      message = typeof resMessage === 'object' ? (resMessage as any).message || JSON.stringify(resMessage) : resMessage;
    } else if (exception.code === '23505') {
      // Código de error PostgreSQL para valores duplicados (ej. Placa o Nombre de usuario duplicado)
      status = HttpStatus.BAD_REQUEST;
      message = 'El registro ya existe en el sistema (Dato duplicado).';
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      message: message,
    });
  }
}