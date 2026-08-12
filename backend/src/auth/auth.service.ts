import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { Usuario } from './usuario.entity';

const googleClient = new OAuth2Client();

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly jwtService: JwtService,
  ) {}

  async registrar(data: {
    nombreUsuario: string;
    password?: string;
    nombre?: string;
    apellidos?: string;
    gmail?: string;
    telefono?: string;
    rol?: string;
    placaAsignada?: string;
  }) {
    const existeUser = await this.usuarioRepo.findOneBy({ nombreUsuario: data.nombreUsuario });
    if (existeUser) throw new BadRequestException('El nombre de usuario ya está registrado. Elija otro.');

    if (data.gmail) {
      const existeGmail = await this.usuarioRepo.findOneBy({ gmail: data.gmail });
      if (existeGmail) throw new BadRequestException('El correo electrónico ya se encuentra registrado.');
    }

    if (data.telefono) {
      const existeTelefono = await this.usuarioRepo.findOneBy({ telefono: data.telefono });
      if (existeTelefono) throw new BadRequestException('El número de teléfono ya está registrado con otra cuenta.');
    }

    let passwordHash = '';
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(data.password, salt);
    }

    const usuario = this.usuarioRepo.create({
      nombreUsuario: data.nombreUsuario,
      nombre: data.nombre,
      apellidos: data.apellidos,
      gmail: data.gmail,
      telefono: data.telefono,
      passwordHash,
      rol: data.rol || 'pasajero',
      placaAsignada: data.placaAsignada,
    });

    const guardado = await this.usuarioRepo.save(usuario);
    const result = { ...guardado };
    delete (result as { passwordHash?: string }).passwordHash;
    return result;
  }

  async login(data: { nombreUsuario: string; password: string }) {
    const usuario = await this.usuarioRepo.findOne({
      where: { nombreUsuario: data.nombreUsuario },
      select: {
        id: true,
        nombreUsuario: true,
        passwordHash: true,
        rol: true,
        placaAsignada: true,
        nombre: true,
        apellidos: true,
      },
    });

    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');
    if (!usuario.passwordHash) throw new UnauthorizedException('Inicie sesión con su cuenta de Google');

    const coincide = await bcrypt.compare(data.password, usuario.passwordHash);
    if (!coincide) throw new UnauthorizedException('Credenciales inválidas');

    const payload = { sub: usuario.id, usuario: usuario.nombreUsuario, rol: usuario.rol };
    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nombreUsuario: usuario.nombreUsuario,
        nombreCompleto: usuario.nombre ? `${usuario.nombre} ${usuario.apellidos || ''}`.trim() : usuario.nombreUsuario,
        rol: usuario.rol,
        placaAsignada: usuario.placaAsignada,
      },
    };
  }

  async loginGoogle(googleToken: string) {
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: googleToken });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) throw new UnauthorizedException('Token de Google inválido');

      const email: string = payload.email;

      let usuario = await this.usuarioRepo.findOneBy({ nombreUsuario: email });
      if (!usuario) {
        usuario = await this.registrar({
          nombreUsuario: email,
          nombre: payload.given_name,
          apellidos: payload.family_name,
          gmail: email,
          rol: 'pasajero',
        });
      }

      const jwtPayload = { sub: usuario.id, usuario: usuario.nombreUsuario, rol: usuario.rol };
      return {
        access_token: this.jwtService.sign(jwtPayload),
        usuario: {
          id: usuario.id,
          nombreUsuario: usuario.nombreUsuario,
          nombreCompleto: `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim() || usuario.nombreUsuario,
          rol: usuario.rol,
          placaAsignada: usuario.placaAsignada,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Error al autenticar con Google');
    }
  }

  async buscarSugerencias(criterio: string) {
    if (!criterio || criterio.trim().length === 0) return [];

    const usuarios = await this.usuarioRepo.find({
      select: {
        id: true,
        nombreUsuario: true,
        nombre: true,
        apellidos: true,
        gmail: true,
        telefono: true,
        rol: true,
      },
    });

    const c = criterio.toLowerCase().trim();
    return usuarios.filter(
      (u) =>
        (u.nombreUsuario && u.nombreUsuario.toLowerCase().includes(c)) ||
        (u.gmail && u.gmail.toLowerCase().includes(c)) ||
        (u.telefono && u.telefono.includes(c)) ||
        (u.nombre && u.nombre.toLowerCase().includes(c)) ||
        (u.apellidos && u.apellidos.toLowerCase().includes(c)),
    );
  }

  async restablecerPassword(userId: string, nuevaPassword: string) {
    const usuario = await this.usuarioRepo.findOneBy({ id: userId });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const salt = await bcrypt.genSalt(10);
    usuario.passwordHash = await bcrypt.hash(nuevaPassword, salt);

    await this.usuarioRepo.save(usuario);
    return { status: 'Contraseña actualizada correctamente' };
  }

  async obtenerChoferes() {
    return this.usuarioRepo.find({
      where: { rol: 'chofer' },
      select: {
        id: true,
        nombreUsuario: true,
        nombre: true,
        apellidos: true,
        gmail: true,
        telefono: true,
        rol: true,
        placaAsignada: true,
        fechaRegistro: true,
      },
    });
  }

  async actualizarChofer(
    userId: string,
    data: { nombre?: string; apellidos?: string; gmail?: string; telefono?: string; placaAsignada?: string },
  ) {
    const usuario = await this.usuarioRepo.findOneBy({ id: userId });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    if (data.nombre !== undefined) usuario.nombre = data.nombre;
    if (data.apellidos !== undefined) usuario.apellidos = data.apellidos;
    if (data.gmail !== undefined) usuario.gmail = data.gmail;
    if (data.telefono !== undefined) usuario.telefono = data.telefono;
    if (data.placaAsignada !== undefined) usuario.placaAsignada = data.placaAsignada;

    await this.usuarioRepo.save(usuario);
    return { status: 'Información del chofer actualizada correctamente' };
  }

  obtenerUsuarios() {
    return this.usuarioRepo.find({
      select: {
        id: true,
        nombreUsuario: true,
        nombre: true,
        apellidos: true,
        gmail: true,
        telefono: true,
        rol: true,
        placaAsignada: true,
        fechaRegistro: true,
      },
    });
  }
}