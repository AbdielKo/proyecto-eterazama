import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Delete
} from '@nestjs/common';

import { FlotaService } from './flota.service';

import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { CrearTipoVehiculoDto } from './dto/crear-tipo-vehiculo.dto';
import { ConfigurarAsientosDto } from './dto/configurar-asientos.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES } from '../auth/roles';


@Controller('flota')
export class FlotaController {


constructor(
private readonly flotaService: FlotaService
){}



@Get()
obtenerTodos(){

return this.flotaService.obtenerTodos();

}



@Get('todos')
obtenerTodosCompleto(){

return this.flotaService.obtenerTodos();

}



@Get('parada/:parada')
obtenerPorParada(
@Param('parada') parada:string
){

return this.flotaService.obtenerPorParada(parada);

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Post()
crearVehiculo(
@Body() body: CrearVehiculoDto
){

return this.flotaService.crearVehiculo(body);

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Post('nuevo')
crearVehiculoNuevo(
@Body() body: CrearVehiculoDto
){

return this.flotaService.crearVehiculo(body);

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Post(':id/trasladar')
trasladarVehiculo(
@Param('id') id:number,
@Body('parada') parada:string
){

return this.flotaService.trasladarVehiculo(
id,
parada
);

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Patch()
reordenarFila(
@Body('cambios') cambios:{ id:number; puestoFila:number }[]
){

return this.flotaService.reordenarFila(cambios);

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Patch(':id')
actualizarVehiculo(
@Param('id') id:number,
@Body() body:any
){

return this.flotaService.actualizarVehiculo(id, body);

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Delete(':id')
eliminarVehiculo(
@Param('id') id:number
){

return this.flotaService.eliminarVehiculo(id);

}



// =============================================
// TIPOS / MODELOS DE VEHÍCULO
// =============================================

@Get('tipos')
obtenerTiposVehiculo(){

return this.flotaService.obtenerTiposVehiculo();

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Post('tipos')
crearTipoVehiculo(
@Body() body: CrearTipoVehiculoDto
){

return this.flotaService.crearTipoVehiculo(body.nombre);

}



@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Delete('tipos/:id')
eliminarTipoVehiculo(
@Param('id') id:number
){

return this.flotaService.eliminarTipoVehiculo(id);

}



// =============================================
// CONFIGURACIÓN DINÁMICA DE ASIENTOS
// =============================================

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
@Patch(':id/asientos')
configurarAsientos(
@Param('id') id:number,
@Body() body: ConfigurarAsientosDto
){

return this.flotaService.configurarAsientos(
id,
body.filas,
body.asientosChofer
);

}



}
