import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';

import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { ROLES } from './roles';

import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { CrearChoferDto } from './dto/crear-chofer.dto';
import { AsignarRolDto } from './dto/asignar-rol.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
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

  @Post('login')
  login(
    @Body() body: LoginDto,
  ) {
    return this.authService.login(body);
  }

  @Post('google')
  loginGoogle(
    @Body() body: GoogleLoginDto,
  ) {
    return this.authService.loginGoogle(
      body.token,
    );
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
  crearChofer(
    @Body() body: CrearChoferDto,
  ) {
    return this.authService.crearChofer(body);
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
  asignarRol(
    @Param('id') id: string,
    @Body() body: AsignarRolDto,
  ) {
    return this.authService.asignarRolChofer(
      id,
      body.rol,
    );
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
  restablecerPassword(
    @Param('id') id: string,
    @Body('nuevaPassword')
    nuevaPassword: string,
  ) {
    return this.authService.restablecerPassword(
      id,
      nuevaPassword,
    );
  }

  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles(ROLES.SECRETARIA)
  @Patch('chofer/:id')
  actualizarChofer(
    @Param('id') id: string,
    @Body() body: {
      nombre?: string;
      apellidos?: string;
      gmail?: string;
      telefono?: string;
      placaAsignada?: string;
    },
  ) {
    return this.authService.actualizarChofer(
      id,
      body,
    );
  }
}