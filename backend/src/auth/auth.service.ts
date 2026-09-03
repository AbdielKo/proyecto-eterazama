import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

import { OAuth2Client } from 'google-auth-library';

import { Usuario } from './usuario.entity';

import { FlotaService } from '../flota/flota.service';

import {
  ROLES,
  esRolValido,
} from './roles';

import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { CrearChoferDto } from './dto/crear-chofer.dto';

const googleClient = new OAuth2Client();

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,

    private readonly flotaService: FlotaService,

    private readonly jwtService: JwtService,
  ) {}

  // ============================================================
  // REGISTRO PÚBLICO
  // Siempre crea un USUARIO normal.
  // Nunca permite registrarse directamente como secretaria/chofer.
  // ============================================================

  async registrarPublico(data: RegistroDto) {
    const usuario = await this.crearUsuarioInterno({
      ...data,
      rol: ROLES.USUARIO,
    });

    return this.usuarioSeguro(usuario);
  }

  // ============================================================
  // CREACIÓN INTERNA DE USUARIO
  // Devuelve la entidad Usuario COMPLETA.
  // Se utiliza internamente por el sistema.
  // ============================================================

  private async crearUsuarioInterno(data: {
    nombreUsuario: string;
    password?: string;
    nombre?: string;
    apellidos?: string;
    gmail?: string;
    telefono?: string;
    ci?: string;
    rol?: string;
    placaAsignada?: string;
    estado?: string;
  }): Promise<Usuario> {
    const nombreUsuario = data.nombreUsuario.trim();

    if (nombreUsuario.length < 3) {
      throw new BadRequestException(
        'El nombre de usuario debe tener al menos 3 caracteres.',
      );
    }

    // ------------------------------------------------------------
    // VERIFICAR NOMBRE DE USUARIO
    // ------------------------------------------------------------

    const existeUsuario = await this.usuarioRepo.findOne({
      where: {
        nombreUsuario,
      },
    });

    if (existeUsuario) {
      throw new BadRequestException(
        'El nombre de usuario ya está registrado. Elija otro.',
      );
    }

    // ------------------------------------------------------------
    // VERIFICAR CORREO
    // ------------------------------------------------------------

    let gmail: string | undefined;

    if (data.gmail) {
      gmail = data.gmail.trim().toLowerCase();

      const existeGmail = await this.usuarioRepo.findOne({
        where: {
          gmail,
        },
      });

      if (existeGmail) {
        throw new BadRequestException(
          'El correo electrónico ya se encuentra registrado.',
        );
      }
    }

    // ------------------------------------------------------------
    // VERIFICAR TELÉFONO
    // ------------------------------------------------------------

    let telefono: string | undefined;

    if (data.telefono) {
      telefono = data.telefono.trim();

      const existeTelefono = await this.usuarioRepo.findOne({
        where: {
          telefono,
        },
      });

      if (existeTelefono) {
        throw new BadRequestException(
          'El número de teléfono ya está registrado con otra cuenta.',
        );
      }
    }

    // ------------------------------------------------------------
    // VERIFICAR CI
    // ------------------------------------------------------------

    let ci: string | undefined;

    if (data.ci) {
      ci = data.ci.trim();

      const existeCi = await this.usuarioRepo.findOne({
        where: {
          ci,
        },
      });

      if (existeCi) {
        throw new BadRequestException(
          'El número de CI ya está registrado con otra cuenta.',
        );
      }
    }

    // ------------------------------------------------------------
    // VALIDAR ROL
    // ------------------------------------------------------------

    const rol = data.rol || ROLES.USUARIO;

    if (!esRolValido(rol)) {
      throw new BadRequestException(
        'El rol especificado no es válido.',
      );
    }

    // ------------------------------------------------------------
    // RESTRICCIÓN DE SEGURIDAD:
    // Ninguna cuenta creada a través del sistema puede ser secretaria.
    // La secretaría únicamente puede crear/cambiar a rol "chofer".
    // Esto se refuerza también en el backend (no solo ocultando botones).
    // ------------------------------------------------------------

    if (rol === ROLES.SECRETARIA) {
      throw new BadRequestException(
        'No está permitido crear una cuenta con rol de secretaria a través del sistema.',
      );
    }

    // ------------------------------------------------------------
    // CONTRASEÑA
    // ------------------------------------------------------------

    let passwordHash: string | undefined;

    if (data.password) {
      if (data.password.length < 6) {
        throw new BadRequestException(
          'La contraseña debe tener al menos 6 caracteres.',
        );
      }

      passwordHash = await bcrypt.hash(
        data.password,
        10,
      );
    }

    // ------------------------------------------------------------
    // CREAR ENTIDAD
    // ------------------------------------------------------------

    const usuario = this.usuarioRepo.create({
      nombreUsuario,

      nombre:
        data.nombre?.trim() || undefined,

      apellidos:
        data.apellidos?.trim() || undefined,

      gmail,

      telefono,

      ci,

      passwordHash,

      rol,

      estado:
        data.estado || 'activo',

      placaAsignada:
        data.placaAsignada?.trim() || undefined,
    });

    // ------------------------------------------------------------
    // GUARDAR Y DEVOLVER ENTIDAD REAL
    // ------------------------------------------------------------

    return await this.usuarioRepo.save(usuario);
  }

  // ============================================================
  // LOGIN NORMAL
  // ============================================================

  async login(data: LoginDto) {
    const usuario = await this.usuarioRepo.findOne({
      where: {
        nombreUsuario:
          data.nombreUsuario.trim(),
      },

      select: {
        id: true,
        nombreUsuario: true,
        nombre: true,
        apellidos: true,
        gmail: true,
        telefono: true,
        passwordHash: true,
        rol: true,
        placaAsignada: true,
        fechaRegistro: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException(
        'Usuario o contraseña incorrectos.',
      );
    }

    if (!usuario.passwordHash) {
      throw new UnauthorizedException(
        'Esta cuenta no tiene contraseña local. Inicie sesión con Google.',
      );
    }

    const contraseñaCorrecta = await bcrypt.compare(
      data.password,
      usuario.passwordHash,
    );

    if (!contraseñaCorrecta) {
      throw new UnauthorizedException(
        'Usuario o contraseña incorrectos.',
      );
    }

    if (!esRolValido(usuario.rol)) {
      throw new UnauthorizedException(
        'La cuenta tiene un rol inválido.',
      );
    }

    return this.generarSesion(usuario);
  }

  // ============================================================
  // LOGIN CON GOOGLE
  // ============================================================

  async loginGoogle(
    googleToken: string,
  ) {
    try {
      const ticket =
        await googleClient.verifyIdToken({
          idToken: googleToken,
        });

      const payload =
        ticket.getPayload();

      if (
        !payload ||
        !payload.email
      ) {
        throw new UnauthorizedException(
          'Token de Google inválido.',
        );
      }

      const email =
        payload.email
          .trim()
          .toLowerCase();

      // IMPORTANTE:
      // Aquí usuario sí es Usuario | null.
      let usuario: Usuario | null =
        await this.usuarioRepo.findOne({
          where: {
            gmail: email,
          },
        });

      // ----------------------------------------------------------
      // SI NO EXISTE, CREAR AUTOMÁTICAMENTE COMO USUARIO
      // ----------------------------------------------------------

      if (!usuario) {
        const baseUsuario =
          this.normalizarNombreUsuario(
            email.split('@')[0],
          );

        let nombreUsuario =
          baseUsuario;

        let contador = 1;

        // Evitar nombres de usuario duplicados
        while (
          await this.usuarioRepo.findOne({
            where: {
              nombreUsuario,
            },
          })
        ) {
          nombreUsuario =
            `${baseUsuario}${contador}`;

          contador++;
        }

        // AHORA crearUsuarioInterno devuelve Usuario,
        // no un objeto parcial.
        usuario =
          await this.crearUsuarioInterno({
            nombreUsuario,

            nombre:
              payload.given_name ||
              undefined,

            apellidos:
              payload.family_name ||
              undefined,

            gmail: email,

            rol:
              ROLES.USUARIO,
          });
      }

      // TypeScript ya sabe que aquí usuario NO es null.
      return this.generarSesion(
        usuario,
      );
    } catch (error) {
      if (
        error instanceof
        UnauthorizedException
      ) {
        throw error;
      }

      throw new UnauthorizedException(
        'Error al autenticar con Google.',
      );
    }
  }

  // ============================================================
  // GENERAR SESIÓN Y TOKEN JWT
  // ============================================================

  private generarSesion(
    usuario: Usuario,
  ) {
    const payload = {
      sub:
        usuario.id,

      usuario:
        usuario.nombreUsuario,

      rol:
        usuario.rol,
    };

    const accessToken =
      this.jwtService.sign(
        payload,
      );

    return {
      access_token:
        accessToken,

      usuario: {
        id:
          usuario.id,

        nombreUsuario:
          usuario.nombreUsuario,

        nombre:
          usuario.nombre,

        apellidos:
          usuario.apellidos,

        nombreCompleto:
          `${usuario.nombre || ''} ${usuario.apellidos || ''}`
            .trim() ||
          usuario.nombreUsuario,

        gmail:
          usuario.gmail,

        telefono:
          usuario.telefono,

        ci:
          usuario.ci,

        rol:
          usuario.rol,

        estado:
          usuario.estado,

        placaAsignada:
          usuario.placaAsignada,

        fechaRegistro:
          usuario.fechaRegistro,
      },
    };
  }

  // ============================================================
  // CREAR CHOFER (SÓLO SECRETARÍA)
  // Forzosamente asigna el rol "chofer".
  // No permite crear cuentas de secretaria (reforzado en backend).
  // ============================================================

  async crearChofer(data: CrearChoferDto) {
    let placaAsignada: string | undefined;

    if (data.placa && data.capacidadTotal) {
      const existente = await this.flotaService.buscarPorPlaca(data.placa);
      if (existente) {
        throw new BadRequestException(
          `La placa ${data.placa} ya está registrada a otro vehículo.`,
        );
      }

      const nombreCompleto =
        [data.nombre, data.apellidos].filter(Boolean).join(' ').trim() ||
        data.nombreUsuario;

      await this.flotaService.crearVehiculo({
        choferNombre: nombreCompleto,
        choferCi: data.ci,
        tipoVehiculo: data.tipoVehiculo || 'Trufi',
        color: data.color || 'N/D',
        placa: data.placa,
        capacidadTotal: data.capacidadTotal,
        paradaActual: 'cochabamba',
      });

      placaAsignada = data.placa;
    }

    const usuario = await this.crearUsuarioInterno({
      ...data,
      rol: ROLES.CHOFER,
      estado: 'activo',
      placaAsignada,
    });

    return this.usuarioSeguro(usuario);
  }

  // ============================================================
  // ASIGNAR ROL DE CHOFER A UN USUARIO EXISTENTE (SÓLO SECRETARÍA)
  // Únicamente permite asignar el rol "chofer".
  // Rechaza cualquier intento de asignar "secretaria" u otro rol.
  // ============================================================

  async asignarRolChofer(
    userId: string,
    rolSolicitado: string,
  ) {
    if (rolSolicitado !== ROLES.CHOFER) {
      throw new BadRequestException(
        'La secretaría únicamente puede asignar el rol de chofer.',
      );
    }

    const usuario = await this.usuarioRepo.findOne({
      where: {
        id: userId,
      },
    });

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado.',
      );
    }

    if (usuario.rol === ROLES.SECRETARIA) {
      throw new BadRequestException(
        'No se puede modificar el rol de una cuenta de secretaria.',
      );
    }

    usuario.rol = ROLES.CHOFER;
    usuario.estado = 'activo';

    await this.usuarioRepo.save(usuario);

    return this.usuarioSeguro(usuario);
  }

  // ============================================================
  // OBTENER TODOS LOS USUARIOS
  // SOLO SE LLAMA DESDE RUTA PROTEGIDA PARA SECRETARÍA
  // ============================================================

  async obtenerUsuarios() {
    return await this.usuarioRepo.find({
      select: {
        id: true,
        nombreUsuario: true,
        nombre: true,
        apellidos: true,
        gmail: true,
        telefono: true,
        ci: true,
        rol: true,
        estado: true,
        placaAsignada: true,
        fechaRegistro: true,
      },

      order: {
        fechaRegistro: 'DESC',
      },
    });
  }

  // ============================================================
  // OBTENER CHOFERES
  // ============================================================

  async obtenerChoferes() {
    return await this.usuarioRepo.find({
      where: {
        rol: ROLES.CHOFER,
      },

      select: {
        id: true,
        nombreUsuario: true,
        nombre: true,
        apellidos: true,
        gmail: true,
        telefono: true,
        ci: true,
        rol: true,
        estado: true,
        placaAsignada: true,
        fechaRegistro: true,
      },

      order: {
        fechaRegistro: 'DESC',
      },
    });
  }

  // ============================================================
  // BUSCAR USUARIOS
  // ============================================================

  async buscarSugerencias(
    criterio: string,
  ) {
    if (
      !criterio ||
      criterio.trim().length === 0
    ) {
      return [];
    }

    const usuarios =
      await this.obtenerUsuarios();

    const buscar =
      criterio
        .trim()
        .toLowerCase();

    return usuarios.filter(
      (usuario) =>
        usuario.nombreUsuario
          ?.toLowerCase()
          .includes(buscar) ||

        usuario.gmail
          ?.toLowerCase()
          .includes(buscar) ||

        usuario.telefono
          ?.toLowerCase()
          .includes(buscar) ||

        usuario.nombre
          ?.toLowerCase()
          .includes(buscar) ||

        usuario.apellidos
          ?.toLowerCase()
          .includes(buscar),
    );
  }

  // ============================================================
  // RESTABLECER CONTRASEÑA
  // ============================================================

  async restablecerPassword(
    userId: string,
    nuevaPassword: string,
  ) {
    if (
      !nuevaPassword ||
      nuevaPassword.length < 6
    ) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 6 caracteres.',
      );
    }

    const usuario =
      await this.usuarioRepo.findOne({
        where: {
          id: userId,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado.',
      );
    }

    usuario.passwordHash =
      await bcrypt.hash(
        nuevaPassword,
        10,
      );

    await this.usuarioRepo.save(
      usuario,
    );

    return {
      status:
        'Contraseña actualizada correctamente.',
    };
  }

  // ============================================================
  // ACTUALIZAR DATOS DE CHOFER
  // ============================================================

  async actualizarChofer(
    userId: string,

    data: {
      nombre?: string;
      apellidos?: string;
      gmail?: string;
      telefono?: string;
      placaAsignada?: string;
    },
  ) {
    const usuario =
      await this.usuarioRepo.findOne({
        where: {
          id: userId,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado.',
      );
    }

    if (
      usuario.rol !==
      ROLES.CHOFER
    ) {
      throw new BadRequestException(
        'El usuario seleccionado no tiene rol de chofer.',
      );
    }

    // ------------------------------------------------------------
    // NOMBRE
    // ------------------------------------------------------------

    if (
      data.nombre !== undefined
    ) {
      usuario.nombre =
        data.nombre.trim();
    }

    // ------------------------------------------------------------
    // APELLIDOS
    // ------------------------------------------------------------

    if (
      data.apellidos !== undefined
    ) {
      usuario.apellidos =
        data.apellidos.trim();
    }

    // ------------------------------------------------------------
    // CORREO
    // ------------------------------------------------------------

    if (
      data.gmail !== undefined
    ) {
      const gmail =
        data.gmail
          .trim()
          .toLowerCase();

      if (gmail) {
        const existe =
          await this.usuarioRepo.findOne({
            where: {
              gmail,
            },
          });

        if (
          existe &&
          existe.id !== usuario.id
        ) {
          throw new BadRequestException(
            'El correo electrónico ya está registrado en otra cuenta.',
          );
        }
      }

      usuario.gmail =
        gmail || null;
    }

    // ------------------------------------------------------------
    // TELÉFONO
    // ------------------------------------------------------------

    if (
      data.telefono !== undefined
    ) {
      const telefono =
        data.telefono.trim();

      if (telefono) {
        const existe =
          await this.usuarioRepo.findOne({
            where: {
              telefono,
            },
          });

        if (
          existe &&
          existe.id !== usuario.id
        ) {
          throw new BadRequestException(
            'El teléfono ya está registrado en otra cuenta.',
          );
        }
      }

      usuario.telefono =
        telefono || null;
    }

    // ------------------------------------------------------------
    // PLACA
    // ------------------------------------------------------------

    if (
      data.placaAsignada !== undefined
    ) {
      usuario.placaAsignada =
        data.placaAsignada
          .trim() ||
        null;
    }

    const actualizado =
      await this.usuarioRepo.save(
        usuario,
      );

    return this.usuarioSeguro(
      actualizado,
    );
  }

  // ============================================================
  // DEVOLVER USUARIO SIN CONTRASEÑA
  // ============================================================

  private usuarioSeguro(
    usuario: Usuario,
  ) {
    return {
      id:
        usuario.id,

      nombreUsuario:
        usuario.nombreUsuario,

      nombre:
        usuario.nombre,

      apellidos:
        usuario.apellidos,

      gmail:
        usuario.gmail,

      telefono:
        usuario.telefono,

      ci:
        usuario.ci,

      rol:
        usuario.rol,

      estado:
        usuario.estado,

      placaAsignada:
        usuario.placaAsignada,

      fechaRegistro:
        usuario.fechaRegistro,
    };
  }

  // ============================================================
  // NORMALIZAR NOMBRE PARA CUENTA GOOGLE
  // ============================================================

  private normalizarNombreUsuario(
    valor: string,
  ): string {
    const limpio =
      valor
        .toLowerCase()
        .replace(
          /[^a-z0-9._-]/g,
          '',
        )
        .substring(
          0,
          40,
        );

    if (
      limpio.length >= 3
    ) {
      return limpio;
    }

    return `usuario${Date.now()}`;
  }
}