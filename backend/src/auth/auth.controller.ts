import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';

import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { ROLES } from './roles';
import { AuditoriaService, ActorAuditoria } from '../auditoria/auditoria.service';

import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { CrearChoferDto } from './dto/crear-chofer.dto';
import { AsignarRolDto } from './dto/asignar-rol.dto';

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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // ==========================================
  // RUTAS PÚBLICAS
  // ==========================================

  @Post('registro')
  registrar(
    @Body() body: RegistroDto,
  ) {
    return this.authService.registrarPublico(body);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  login(
    @Body() body: LoginDto,
    @Req() req: Request,
  ) {
    return this.authService.login(body, req.ip);
  }

  // ==========================================
  // RUTAS SECRETARÍA
  // ==========================================

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(ROLES.SECRETARIA)
  @Get('usuarios')
  obtenerUsuarios() {
    return this.authService.obtenerUsuarios();
  }

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(ROLES.SECRETARIA)
  @Get('choferes')
  obtenerChoferes() {
    return this.authService.obtenerChoferes();
  }

  // ==========================================
  // CREAR NUEVO CHOFER (SÓLO SECRETARÍA)
  // El rol siempre será "chofer" en el backend.
  // ==========================================

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(ROLES.SECRETARIA)
  @Post('secretaria/choferes')
  async crearChofer(
    @Body() body: CrearChoferDto,
    @Req() req: Request,
  ) {
    const resultado = await this.authService.crearChofer(body);
    await this.auditoriaService.registrar(actorDeReq(req), {
      accion: 'registrar_chofer',
      modulo: 'choferes',
      detalle: `Chofer ${body.nombreUsuario || ''} registrado${body.placa ? ` con placa ${body.placa}` : ''}.`,
      registroId: (resultado as any)?.id != null ? String((resultado as any).id) : null,
      datosNuevos: {
        nombreUsuario: body.nombreUsuario,
        nombre: body.nombre,
        placa: body.placa,
        capacidadTotal: body.capacidadTotal,
      },
    });
    return resultado;
  }

  // ==========================================
  // ASIGNAR ROL DE CHOFER (SÓLO SECRETARÍA)
  // El backend únicamente acepta el rol "chofer".
  // Intentar enviar "secretaria" es rechazado.
  // ==========================================

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(ROLES.SECRETARIA)
  @Patch('secretaria/usuario/:id/rol')
  async asignarRol(
    @Param('id') id: string,
    @Body() body: AsignarRolDto,
    @Req() req: Request,
  ) {
    const resultado = await this.authService.asignarRolChofer(
      id,
      body.rol,
    );
    await this.auditoriaService.registrar(actorDeReq(req), {
      accion: 'asignar_rol',
      modulo: 'usuarios',
      detalle: `Rol "${body.rol}" asignado al usuario #${id}.`,
      registroId: id,
      datosNuevos: { rol: body.rol },
    });
    return resultado;
  }

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(ROLES.SECRETARIA)
  @Post('buscar')
  buscarSugerencias(
    @Body('criterio') criterio: string,
  ) {
    return this.authService.buscarSugerencias(
      criterio,
    );
  }

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(ROLES.SECRETARIA)
  @Post('restablecer/:id')
  async restablecerPassword(
    @Param('id') id: string,
    @Body('nuevaPassword')
    nuevaPassword: string,
    @Req() req: Request,
  ) {
    const resultado = await this.authService.restablecerPassword(
      id,
      nuevaPassword,
    );
    await this.auditoriaService.registrar(actorDeReq(req), {
      accion: 'restablecer_clave',
      modulo: 'usuarios',
      detalle: `Contraseña restablecida del usuario #${id}.`,
      registroId: id,
    });
    return resultado;
  }

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(ROLES.SECRETARIA)
  @Patch('usuarios/:id/desbloquear')
  async desbloquearCuenta(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const usuario = await this.authService.desbloquearCuenta(id);
    await this.auditoriaService.registrar(actorDeReq(req), {
      accion: 'cuenta_desbloqueada',
      modulo: 'seguridad',
      detalle: `Secretaria ${actorDeReq(req).usuarioNombre} desbloqueó la cuenta ${usuario.nombreUsuario}.`,
      registroId: id,
      datosNuevos: { nombreUsuario: usuario.nombreUsuario, intentosFallidos: 0, nivelBloqueo: 0 },
    });
    return { mensaje: `La cuenta ${usuario.nombreUsuario} ha sido desbloqueada correctamente.` };
  }

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(ROLES.SECRETARIA)
  @Patch('chofer/:id')
  async actualizarChofer(
    @Param('id') id: string,
    @Body() body: {
      nombre?: string;
      apellidos?: string;
      gmail?: string;
      telefono?: string;
      placaAsignada?: string;
    },
    @Req() req: Request,
  ) {
    const resultado = await this.authService.actualizarChofer(
      id,
      body,
    );
    await this.auditoriaService.registrar(actorDeReq(req), {
      accion: 'modificar_chofer',
      modulo: 'choferes',
      detalle: `Chofer #${id} modificado.`,
      registroId: id,
      datosNuevos: body && typeof body === 'object' ? body : {},
    });
    return resultado;
  }
}