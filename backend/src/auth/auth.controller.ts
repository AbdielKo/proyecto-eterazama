import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  registrar(@Body() body: any) {
    return this.authService.registrar(body);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Post('google')
  loginGoogle(@Body('token') token: string) {
    return this.authService.loginGoogle(token);
  }

  @Post('buscar')
  buscarSugerencias(@Body('criterio') criterio: string) {
    return this.authService.buscarSugerencias(criterio);
  }

  @Post('restablecer/:id')
  restablecerPassword(@Param('id') id: string, @Body('nuevaPassword') nuevaPassword: string) {
    return this.authService.restablecerPassword(id, nuevaPassword);
  }

  @Get('usuarios')
  obtenerUsuarios() {
    return this.authService.obtenerUsuarios();
  }
}