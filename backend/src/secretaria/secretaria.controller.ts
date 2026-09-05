import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { SecretariaService } from './secretaria.service';

import { VentaBoleteriaDto } from './dto/vender-boleteria.dto';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto';
import { ConfirmarReembolsoDto } from './dto/confirmar-reembolso.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES } from '../auth/roles';

@Controller('secretaria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
export class SecretariaController {
  constructor(
    private readonly secretariaService: SecretariaService,
  ) {}

  // Nómina de choferes (datos reales desde PostgreSQL)
  @Get('nomina')
  obtenerNomina() {
    return this.secretariaService.obtenerNomina();
  }

  // Choferes activos (estado operativo en tiempo real del submenú)
  @Get('choferes-activos')
  obtenerChoferesActivos() {
    return this.secretariaService.obtenerChoferesActivos();
  }

  // Vehículos sin chofer oficial asociado (solo informe, nunca se eliminan)
  @Get('vehiculos-sin-chofer')
  vehiculosSinChoferOficial() {
    return this.secretariaService.vehiculosSinChoferOficial();
  }

  // Historial de ventas con filtros (día/semana/mes/chofer/vehículo)
  @Get('ventas')
  obtenerVentas(
    @Query('periodo') periodo?: string,
    @Query('choferId') choferId?: string,
    @Query('placa') placa?: string,
  ) {
    return this.secretariaService.obtenerVentas({
      periodo,
      choferId,
      placa,
    });
  }

  // Detalle de una venta (consultar, NUNCA modifica registros). Solo Secretaría.
  @Get('ventas/:id')
  obtenerDetalleVenta(@Param('id') id: string) {
    return this.secretariaService.obtenerDetalleVenta(id);
  }

  // Caja central (totales reales)
  @Get('caja')
  obtenerCaja() {
    return this.secretariaService.obtenerCaja();
  }

  // Reembolsos: solicitudes pendientes y pasajes ya reembolsados
  @Get('reembolsos')
  obtenerReembolsos() {
    return this.secretariaService.obtenerReembolsos();
  }

  // La Secretaría confirma manualmente que devolvió el dinero:
  // libera el asiento y marca el pasaje como reembolsado (transacción).
  @Post('reembolsos/:id/confirmar')
  confirmarReembolso(
    @Param('id') id: string,
    @Body() body: ConfirmarReembolsoDto,
    @Req() req: Request,
  ) {
    const secretaria =
      (req.user as { username?: string } | undefined)?.username ||
      'Secretaria';
    return this.secretariaService.confirmarReembolso(
      id,
      body.motivo,
      secretaria,
    );
  }

  // Reseñas y calificaciones de un chofer
  @Get('resenas/:choferId')
  obtenerResenas(@Param('choferId') choferId: string) {
    return this.secretariaService.obtenerResenas(choferId);
  }

  // Gráficas de calificaciones de un chofer (día/semana/mes)
  @Get('graficas/:choferId')
  obtenerGraficas(
    @Param('choferId') choferId: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.secretariaService.obtenerGraficas(
      choferId,
      periodo || 'mes',
    );
  }

  // =============================================================
  // BOLETERÍA DE SECRETARÍA
  // =============================================================

  // Configuración del sindicato (fuente de verdad de los precios)
  @Get('configuracion')
  obtenerConfiguracion() {
    return this.secretariaService.obtenerConfiguracion();
  }

  // Guardar configuración (precios oficiales de pasajes)
  @Put('configuracion')
  actualizarConfiguracion(@Body() body: ActualizarConfiguracionDto) {
    return this.secretariaService.actualizarConfiguracion(body);
  }

  // Paradas principales (Cochabamba / Eterazama) con sus vehículos reales
  @Get('boleteria/paradas')
  obtenerBoleteriaParadas() {
    return this.secretariaService.obtenerBoleteriaParadas();
  }

  // Detalle de un vehículo para la selección de asientos
  @Get('boleteria/vehiculo/:id')
  obtenerVehiculoBoleteria(@Param('id') id: number) {
    return this.secretariaService.obtenerVehiculoParaBoleteria(id);
  }

  // Venta en ventanilla (pago en efectivo). Valida disponibilidad en backend.
  @Post('boleteria/venta')
  venderBoleteria(@Body() body: VentaBoleteriaDto) {
    return this.secretariaService.venderBoleteria(body);
  }

  // =============================================================
  // SOLICITUDES DE RETIRO VOLUNTARIO DE LA FILA
  // =============================================================

  @Get('retiros')
  listarSolicitudesRetiro(@Query('estado') estado?: string) {
    return this.secretariaService.listarSolicitudesRetiro(estado);
  }

  @Patch('retiros/:id/aprobar')
  aprobarRetiro(@Param('id') id: string, @Req() req: any, @Body('comentario') comentario?: string) {
    const nombre = req.user?.username || req.user?.userId || 'Secretaria';
    return this.secretariaService.aprobarRetiro(id, nombre, comentario);
  }

  @Patch('retiros/:id/rechazar')
  rechazarRetiro(@Param('id') id: string, @Req() req: any, @Body('comentario') comentario?: string) {
    const nombre = req.user?.username || req.user?.userId || 'Secretaria';
    return this.secretariaService.rechazarRetiro(id, nombre, comentario);
  }
}
