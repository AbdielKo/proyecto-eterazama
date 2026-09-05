import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';

import { ChoferService } from './chofer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES } from '../auth/roles';

@Controller('chofer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.CHOFER)
export class ChoferController {

  constructor(
    private readonly choferService: ChoferService,
  ) {}


  // 1. Inicio
  @Get('inicio')
  obtenerInicio(@Request() req: any) {
    return this.choferService.obtenerInicio(req.user.userId);
  }


  // 2. Mi Vehiculo
  @Get('vehiculo')
  obtenerMiVehiculo(@Request() req: any) {
    return this.choferService.obtenerMiVehiculo(req.user.userId);
  }


  // 3. Mi Fila
  @Get('fila')
  obtenerMiFila(@Request() req: any) {
    return this.choferService.obtenerMiFila(req.user.userId);
  }

  @Post('fila/anotarse')
  anotarseEnFila(@Request() req: any, @Body('parada') parada: string) {
    return this.choferService.anotarseEnFila(req.user.userId, parada);
  }

  @Post('fila/salir')
  salirDeFila(@Request() req: any) {
    return this.choferService.salirDeFila(req.user.userId);
  }

  // El chofer indica manualmente su ubicación/sector actual (COCHABAMBA o
  // ETERAZAMA). La ubicación es independiente de la fila. Si está anotado en
  // otra fila, el backend lo saca de esa fila antes de cambiar de sector.
  @Patch('ubicacion')
  cambiarUbicacion(@Request() req: any, @Body('ubicacion') ubicacion: string) {
    return this.choferService.cambiarUbicacion(req.user.userId, ubicacion);
  }

  @Post('fila/retiro-solicitar')
  solicitarRetiroFila(@Request() req: any, @Body('motivo') motivo: string) {
    return this.choferService.solicitarRetiroFila(req.user.userId, motivo);
  }

  // PROGRAMAR SALIDA (POR SALIR): solo el chofer del PUESTO 1 de su parada.
  // Deja el vehículo con salidaProgramada = ahora + 10 min (cuenta regresiva
  // real persistida en PostgreSQL). Es idempotente (no doble activación).
  @Post('salida/programar')
  programarSalida(@Request() req: any) {
    return this.choferService.programarSalidaChofer(req.user.userId);
  }

  @Get('fila/retiro')
  obtenerMiSolicitudRetiro(@Request() req: any) {
    return this.choferService.obtenerMiSolicitudRetiro(req.user.userId);
  }


  // 4. Mi Viaje
  @Get('viaje')
  obtenerMiViaje(@Request() req: any) {
    return this.choferService.obtenerMiViaje(req.user.userId);
  }

  @Post('viaje/:id/iniciar')
  iniciarViaje(@Request() req: any, @Param('id') id: string) {
    return this.choferService.iniciarViaje(req.user.userId, id);
  }

  @Post('viaje/:id/finalizar')
  finalizarViaje(@Request() req: any, @Param('id') id: string) {
    return this.choferService.finalizarViaje(req.user.userId, id);
  }


  // 5. Mis Pasajeros
  @Get('pasajeros')
  obtenerMisPasajeros(@Request() req: any) {
    return this.choferService.obtenerMisPasajeros(req.user.userId);
  }

  @Post('pasajeros/:id/confirmar')
  confirmarAbordaje(@Request() req: any, @Param('id') id: string) {
    return this.choferService.confirmarAbordaje(req.user.userId, id);
  }

  @Post('pasajeros/:id/no-presentado')
  marcarNoPresentado(@Request() req: any, @Param('id') id: string) {
    return this.choferService.marcarNoPresentado(req.user.userId, id);
  }


  // 6. Control de Asientos
  @Get('asientos')
  obtenerMapaAsientos(@Request() req: any) {
    return this.choferService.obtenerMapaAsientos(req.user.userId);
  }

  @Post('asientos/venta-manual')
  ventaManual(@Request() req: any, @Body() body: {
    pasajeroNombre: string;
    asiento: number;
    origen: string;
    destino: string;
    monto: number;
    montoEncomienda?: number;
    contactoRecibo?: string;
  }) {
    return this.choferService.ventaManual(req.user.userId, body);
  }


  // 7. Validacion QR
  @Post('validar-qr')
  validarBoletoQR(@Request() req: any, @Body('codigoQR') codigoQR: string) {
    return this.choferService.validarBoletoQR(req.user.userId, codigoQR);
  }

  @Post('validar-qr/:id/confirmar')
  confirmarAbordajeQR(@Request() req: any, @Param('id') id: string) {
    return this.choferService.confirmarAbordajeQR(req.user.userId, id);
  }

  // 7.1 Validacion de boleto (boleteria) por codigo de barras
  @Post('validar-boleto')
  validarBoletoPorBarras(@Request() req: any, @Body('codigoBarras') codigoBarras: string) {
    return this.choferService.validarBoletoPorBarras(req.user.userId, codigoBarras);
  }

  @Post('validar-boleto/:id/utilizar')
  confirmarBoletoUtilizado(@Request() req: any, @Param('id') id: string) {
    return this.choferService.confirmarBoletoUtilizado(req.user.userId, id);
  }


  // 8. Estado del Vehiculo (trufi) y del Viaje
  @Patch('estado-vehiculo')
  cambiarEstadoVehiculo(@Request() req: any, @Body('estado') estado: string) {
    return this.choferService.cambiarEstadoVehiculo(req.user.userId, estado);
  }

  @Patch('estado-viaje')
  cambiarEstadoViaje(@Request() req: any, @Body('estado') estado: string) {
    return this.choferService.cambiarEstadoViaje(req.user.userId, estado);
  }

  // Cambiar el estado de servicio del chofer (ACTIVO/INACTIVO).
  // Solo el chofer autenticado puede cambiar SU PROPIO estado
  // (req.user.userId proviene del JWT, nunca del frontend).
  @Patch('estado')
  cambiarEstadoServicio(@Request() req: any, @Body('estado') estado: string) {
    return this.choferService.cambiarEstadoServicio(req.user.userId, estado);
  }


  // 9. Liquidacion
  @Get('liquidacion')
  obtenerLiquidacion(@Request() req: any) {
    return this.choferService.obtenerLiquidacion(req.user.userId);
  }


  // 10. Historial de Viajes
  @Get('historial')
  obtenerHistorialViajes(
    @Request() req: any,
    @Query('filtro') filtro?: string,
  ) {
    return this.choferService.obtenerHistorialViajes(req.user.userId, filtro);
  }


  // 11. Mis Calificaciones
  @Get('calificaciones')
  obtenerMisCalificaciones(@Request() req: any) {
    return this.choferService.obtenerMisCalificaciones(req.user.userId);
  }


  // 12. Mis Estadisticas
  @Get('estadisticas')
  obtenerMisEstadisticas(
    @Request() req: any,
    @Query('periodo') periodo?: string,
  ) {
    return this.choferService.obtenerMisEstadisticas(req.user.userId, periodo);
  }


  // 13. Notificaciones
  @Get('notificaciones')
  obtenerNotificaciones(@Request() req: any) {
    return this.choferService.obtenerNotificaciones(req.user.userId);
  }

  @Patch('notificaciones/:id/leer')
  marcarNotificacionLeida(@Request() req: any, @Param('id') id: string) {
    return this.choferService.marcarNotificacionLeida(req.user.userId, id);
  }

  @Patch('notificaciones/todas-leer')
  marcarTodasLeidas(@Request() req: any) {
    return this.choferService.marcarTodasLeidas(req.user.userId);
  }


  // 14. Perfil
  @Get('perfil')
  obtenerPerfil(@Request() req: any) {
    return this.choferService.obtenerPerfil(req.user.userId);
  }

  @Patch('perfil')
  actualizarPerfil(@Request() req: any, @Body() body: {
    nombre?: string;
    apellidos?: string;
    telefono?: string;
  }) {
    return this.choferService.actualizarPerfil(req.user.userId, body);
  }

}
