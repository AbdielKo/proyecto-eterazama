import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Delete,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { FlotaService } from './flota.service';

import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { CrearTipoVehiculoDto } from './dto/crear-tipo-vehiculo.dto';
import { ConfigurarAsientosDto } from './dto/configurar-asientos.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES } from '../auth/roles';
import { AuditoriaService, ActorAuditoria } from '../auditoria/auditoria.service';

// Actor autenticado derivado del JWT para la bitácora de auditoría.
function actorDeReq(req: Request): ActorAuditoria {
  const u = (req.user || {}) as {
    userId?: string;
    id?: string;
    username?: string;
    nombreUsuario?: string;
    rol?: string;
  };
  return {
    usuarioId: u.userId || u.id || 'desconocido',
    usuarioNombre: u.username || u.nombreUsuario || 'desconocido',
    rol: u.rol || ROLES.SECRETARIA,
    ip: (req as any).ip || null,
  };
}

@Controller('flota')
export class FlotaController {


constructor(
private readonly flotaService: FlotaService,
private readonly auditoriaService: AuditoriaService,
){}



@Get()
@UseGuards(JwtAuthGuard)
obtenerTodos(){

return this.flotaService.obtenerTodos();

}



@Get('todos')
@UseGuards(JwtAuthGuard)
obtenerTodosCompleto(){

return this.flotaService.obtenerTodos();

}



@Get('parada/:parada')
@UseGuards(JwtAuthGuard)
obtenerPorParada(
@Param('parada') parada:string
){

return this.flotaService.obtenerPorParada(parada);

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Post()
async crearVehiculo(
@Body() body: CrearVehiculoDto,
@Req() req: Request
){
const resultado = await this.flotaService.crearVehiculo(body);
await this.auditoriaService.registrar(actorDeReq(req), {
  accion: 'registrar_vehiculo',
  modulo: 'vehiculos',
  detalle: `Vehículo ${body.placa || ''} registrado en la flota.`,
  registroId: resultado?.id != null ? String(resultado.id) : null,
  datosNuevos: {
    placa: body.placa,
    tipoVehiculo: body.tipoVehiculo,
    color: body.color,
    capacidadTotal: body.capacidadTotal,
  },
});
return resultado;
}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Post('nuevo')
async crearVehiculoNuevo(
@Body() body: CrearVehiculoDto,
@Req() req: Request
){
const resultado = await this.flotaService.crearVehiculo(body);
await this.auditoriaService.registrar(actorDeReq(req), {
  accion: 'registrar_vehiculo',
  modulo: 'vehiculos',
  detalle: `Vehículo ${body.placa || ''} registrado en la flota.`,
  registroId: resultado?.id != null ? String(resultado.id) : null,
  datosNuevos: {
    placa: body.placa,
    tipoVehiculo: body.tipoVehiculo,
    color: body.color,
    capacidadTotal: body.capacidadTotal,
  },
});
return resultado;
}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Post(':id/trasladar')
async trasladarVehiculo(
@Param('id') id:number,
@Body('parada') parada:string,
@Req() req: Request
){
const resultado = await this.flotaService.trasladarVehiculo(
  id,
  parada
);
await this.auditoriaService.registrar(actorDeReq(req), {
  accion: 'trasladar_vehiculo',
  modulo: 'filas',
  detalle: `Vehículo #${id} trasladado a la parada ${parada || '(sin especificar)'}.`,
  registroId: String(id),
  datosNuevos: { parada },
});
return resultado;
}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Patch()
async reordenarFila(
@Body('cambios') cambios:{ id:number; puestoFila:number }[],
@Req() req: Request
){
const resultado = await this.flotaService.reordenarFila(cambios);
await this.auditoriaService.registrar(actorDeReq(req), {
  accion: 'reordenar_fila',
  modulo: 'filas',
  detalle: `Fila reordenada: ${(cambios || []).length} vehículo(s) con puesto actualizado.`,
  datosNuevos: { cambios: cambios || [] },
});
return resultado;
}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Patch(':id')
async actualizarVehiculo(
@Param('id') id:number,
@Body() body: {
  choferNombre?: string;
  choferCi?: string;
  tipoVehiculo?: string;
  color?: string;
  placa?: string;
  paradaActual?: string;
  puestoFila?: number;
  capacidadTotal?: number;
  estadoVehiculo?: string;
},
@Req() req: Request
){
const resultado = await this.flotaService.actualizarVehiculo(id, body);
await this.auditoriaService.registrar(actorDeReq(req), {
  accion: 'modificar_vehiculo',
  modulo: 'vehiculos',
  detalle: `Vehículo #${id} modificado.`,
  registroId: String(id),
  datosNuevos: body && typeof body === 'object' ? body : {},
});
return resultado;
}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Delete(':id')
async eliminarVehiculo(
@Param('id') id:number,
@Req() req: Request
){
const resultado = await this.flotaService.eliminarVehiculo(id);
await this.auditoriaService.registrar(actorDeReq(req), {
  accion: 'eliminar_vehiculo',
  modulo: 'vehiculos',
  detalle: `Vehículo #${id} dado de baja de la flota.`,
  registroId: (resultado as any)?.id != null ? String((resultado as any).id) : null,
  datosAnteriores: { id },
});
return resultado;
}



// =============================================
// TIPOS / MODELOS DE VEHÍCULO
// =============================================

@Get('tipos')
@UseGuards(JwtAuthGuard)
obtenerTiposVehiculo(){

return this.flotaService.obtenerTiposVehiculo();

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Post('tipos')
async crearTipoVehiculo(
@Body() body: CrearTipoVehiculoDto,
@Req() req: Request
){
const resultado = await this.flotaService.crearTipoVehiculo(body.nombre);
await this.auditoriaService.registrar(actorDeReq(req), {
  accion: 'crear_tipo_vehiculo',
  modulo: 'vehiculos',
  detalle: `Nuevo tipo de vehículo: ${body.nombre || ''}.`,
  registroId: (resultado as any)?.id != null ? String((resultado as any).id) : null,
  datosNuevos: { nombre: body.nombre },
});
return resultado;
}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Delete('tipos/:id')
async eliminarTipoVehiculo(
@Param('id') id:number,
@Req() req: Request
){
const resultado = await this.flotaService.eliminarTipoVehiculo(id);
await this.auditoriaService.registrar(actorDeReq(req), {
  accion: 'eliminar_tipo_vehiculo',
  modulo: 'vehiculos',
  detalle: `Tipo de vehículo #${id} eliminado.`,
  registroId: (resultado as any)?.id != null ? String((resultado as any).id) : null,
  datosAnteriores: { id },
});
return resultado;
}



// =============================================
// CONFIGURACIÓN DINÁMICA DE ASIENTOS
// =============================================

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Patch(':id/asientos')
async configurarAsientos(
@Param('id') id:number,
@Body() body: ConfigurarAsientosDto,
@Req() req: Request
){
const resultado = await this.flotaService.configurarAsientos(
id,
body.filas,
body.asientosChofer
);
await this.auditoriaService.registrar(actorDeReq(req), {
  accion: 'configurar_asientos',
  modulo: 'vehiculos',
  detalle: `Distribución de asientos configurada para el vehículo #${id}.`,
  registroId: String(id),
  datosNuevos: {
    filas: body.filas,
    asientosChofer: body.asientosChofer,
  },
});
return resultado;
}



}
