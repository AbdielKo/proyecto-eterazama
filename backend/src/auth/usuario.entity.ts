import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

import { ROLES } from './roles';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    unique: true,
  })
  nombreUsuario: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  nombre: string | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  apellidos: string | null;

  @Column({
    type: 'varchar',
    unique: true,
    nullable: true,
  })
  gmail: string | null;

  @Column({
    type: 'varchar',
    unique: true,
    nullable: true,
  })
  telefono: string | null;

  @Column({
    type: 'varchar',
    unique: true,
    nullable: true,
  })
  ci: string | null;

  @Column({
    type: 'varchar',
    default: 'activo',
  })
  estado: string;

  @Column({
    type: 'varchar',
    select: false,
    nullable: true,
  })
  passwordHash: string | null;

  @Column({ type: 'int', default: 0 })
  intentosFallidos: number;

  @Column({ type: 'int', default: 0 })
  nivelBloqueo: number;

  @Column({ type: 'timestamptz', nullable: true, select: true })
  bloqueoTemporalHasta: Date | null;

  @Column({ type: 'boolean', default: false })
  cuentaBloqueada: boolean;

  @Column({
    type: 'varchar',
    default: ROLES.USUARIO,
  })
  rol: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  placaAsignada: string | null;

  @CreateDateColumn()
  fechaRegistro: Date;
}