import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { MovimientoSecretaria } from './movimiento-secretaria.entity';

export interface ActorAuditoria {
  usuarioId: string;
  usuarioNombre: string;
  rol: string;
  ip?: string | null;
}

export interface RegistrarMovimientoInput {
  accion: string;
  modulo: string;
  detalle?: string;
  registroId?: string | null;
  datosAnteriores?: Record<string, unknown> | null;
  datosNuevos?: Record<string, unknown> | null;
}

export interface FiltrosMovimientos {
  busqueda?: string;
  usuario?: string;
  modulo?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(MovimientoSecretaria)
    private readonly movimientoRepo: Repository<MovimientoSecretaria>,
  ) {}

  // Registro simple (fuera de transaccion). Se usa en operaciones cuyo
  // guardado ya se confirmo y que no requieren atomicidad con la auditoria.
  async registrar(
    actor: ActorAuditoria,
    entrada: RegistrarMovimientoInput,
  ): Promise<MovimientoSecretaria> {
    const movimiento = this.movimientoRepo.create({
      fechaHora: new Date(),
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      rol: actor.rol,
      ip: actor.ip || null,
      accion: entrada.accion,
      modulo: entrada.modulo,
      detalle: entrada.detalle || null,
      registroId: entrada.registroId || null,
      datosAnteriores: entrada.datosAnteriores || null,
      datosNuevos: entrada.datosNuevos || null,
    });
    return this.movimientoRepo.save(movimiento);
  }

  // Registro dentro de una transaccion existente: si la operacion principal
  // falla y hace rollback, el movimiento de auditoria tambien se revierte.
  // La bitácora queda consistente con el estado real de los datos.
  async registrarEnTransaccion(
    manager: EntityManager,
    actor: ActorAuditoria,
    entrada: RegistrarMovimientoInput,
  ): Promise<MovimientoSecretaria> {
    const movimiento = manager.create(MovimientoSecretaria, {
      fechaHora: new Date(),
      usuarioId: actor.usuarioId,
      usuarioNombre: actor.usuarioNombre,
      rol: actor.rol,
      ip: actor.ip || null,
      accion: entrada.accion,
      modulo: entrada.modulo,
      detalle: entrada.detalle || null,
      registroId: entrada.registroId || null,
      datosAnteriores: entrada.datosAnteriores || null,
      datosNuevos: entrada.datosNuevos || null,
    });
    return manager.save(MovimientoSecretaria, movimiento);
  }

  // Listado con filtros y paginacion. Solo lectura (registro inmutable).
  async listar(filtros: FiltrosMovimientos) {
    const page = Math.max(1, filtros.page || 1);
    const pageSize = Math.min(100, Math.max(1, filtros.pageSize || 25));

    const qb = this.movimientoRepo
      .createQueryBuilder('m')
      .orderBy('m.fechaHora', 'DESC')
      .addOrderBy('m.createdAt', 'DESC');

    const FILAS_ESCAPADAS = {
      busqueda: '(m."usuarioNombre" ILIKE :b OR m.accion ILIKE :b OR m.modulo ILIKE :b OR m.detalle ILIKE :b OR m."registroId"::text ILIKE :b)',
      usuario: '(m."usuarioNombre" ILIKE :u OR m."usuarioId" = :uid)',
      modulo: 'm.modulo = :modulo',
      accion: 'm.accion ILIKE :accion',
      desde: 'm."fechaHora" >= :desde',
      hasta: 'm."fechaHora" <= :hasta',
    };

    if (filtros.busqueda?.trim()) {
      const b = filtros.busqueda.trim();
      qb.andWhere(FILAS_ESCAPADAS.busqueda, { b: `%${b}%` });
    }
    if (filtros.usuario?.trim()) {
      const u = filtros.usuario.trim();
      qb.andWhere(FILAS_ESCAPADAS.usuario, { u: `%${u}%`, uid: u });
    }
    if (filtros.modulo?.trim()) {
      qb.andWhere(FILAS_ESCAPADAS.modulo, { modulo: filtros.modulo.trim() });
    }
    if (filtros.accion?.trim()) {
      qb.andWhere(FILAS_ESCAPADAS.accion, {
        accion: `%${filtros.accion.trim()}%`,
      });
    }
    if (filtros.desde) {
      qb.andWhere(FILAS_ESCAPADAS.desde, { desde: new Date(filtros.desde) });
    }
    if (filtros.hasta) {
      qb.andWhere(FILAS_ESCAPADAS.hasta, { hasta: new Date(filtros.hasta) });
    }

    const [movimientos, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { movimientos, total, page, pageSize };
  }

  async obtenerPorId(id: string): Promise<MovimientoSecretaria> {
    const movimiento = await this.movimientoRepo.findOne({ where: { id } });
    if (!movimiento) {
      throw new NotFoundException('Movimiento de auditoría no encontrado.');
    }
    return movimiento;
  }
}