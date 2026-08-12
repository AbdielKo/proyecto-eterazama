import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { FlotaService } from './flota.service';
import { CrearVehiculoDto } from './dto/crear-vehiculo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Asegúrate de importar el guard

@Controller('flota')
export class FlotaController {
  constructor(private readonly flotaService: FlotaService) {}

  @Get('todos')
  obtenerTodos() { return this.flotaService.obtenerTodos(); }

  @UseGuards(JwtAuthGuard) // <--- PROTECCIÓN
  @Post('nuevo')
  crearVehiculo(@Body() body: CrearVehiculoDto) { return this.flotaService.crearVehiculo(body); }

  @UseGuards(JwtAuthGuard) // <--- PROTECCIÓN
  @Post(':id/trasladar')
  trasladarVehiculo(@Param('id') id: number, @Body('parada') parada: string) { return this.flotaService.trasladarVehiculo(id, parada); }
  
  // Aplica @UseGuards(JwtAuthGuard) en todos los métodos de administración
}