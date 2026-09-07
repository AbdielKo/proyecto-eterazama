import {
  Controller,
  Delete,
  Get,
  MethodNotAllowedException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES } from '../auth/roles';
import { AuditoriaService, FiltrosMovimientos } from './auditoria.service';

// Bitácora de la Secretaría: SOLO LECTURA.
// El registro es append-only; cualquier intento de modificar o eliminar
// un movimiento responde 405 Method Not Allowed.
@Controller('secretaria/movimientos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SECRETARIA)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  async listar(@Query() query: any) {
    const filtros: FiltrosMovimientos = {
      busqueda: query.busqueda,
      usuario: query.usuario,
      modulo: query.modulo,
      accion: query.accion,
      desde: query.desde,
      hasta: query.hasta,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    };
    return this.auditoriaService.listar(filtros);
  }

  @Get(':id')
  async obtenerUno(@Param('id') id: string) {
    return this.auditoriaService.obtenerPorId(id);
  }

  @Post()
  async crearProhibido() {
    throw new MethodNotAllowedException(
      'No se pueden crear movimientos de auditoría manualmente. La bitácora se genera automáticamente con el usuario de la sesión.',
    );
  }

  @Put()
  async reemplazarProhibido() {
    throw new MethodNotAllowedException(
      'La bitácora de auditoría es inmutable: no se puede modificar un movimiento.',
    );
  }

  @Patch()
  async actualizarProhibido() {
    throw new MethodNotAllowedException(
      'La bitácora de auditoría es inmutable: no se puede modificar un movimiento.',
    );
  }

  @Delete()
  async eliminarProhibido() {
    throw new MethodNotAllowedException(
      'La bitácora de auditoría es inmutable: no se puede eliminar un movimiento.',
    );
  }
}