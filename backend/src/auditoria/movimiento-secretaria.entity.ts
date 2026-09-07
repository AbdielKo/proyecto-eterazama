import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Bitácora inmutable de acciones del rol SECRETARIA.
// Diseño append-only: este registro jamas se actualiza ni se elimina.
// El modulo de origen (SecretariaService, FlotaController o AuthController)
// crea un movimiento por cada operacion de escritura, con el usuario que
// aparece en el JWT, nunca con datos enviados por el frontend.
@Entity('movimientos_secretaria')
export class MovimientoSecretaria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  fechaHora: Date;

  @Index()
  @Column()
  usuarioId: string;

  @Column()
  usuarioNombre: string;

  @Column()
  rol: string;

  @Index()
  @Column()
  accion: string;

  @Index()
  @Column()
  modulo: string;

  @Column({ type: 'text', nullable: true })
  detalle: string | null;

  @Column({ type: 'varchar', nullable: true })
  registroId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  datosAnteriores: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  datosNuevos: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @CreateDateColumn()
  createdAt: Date;
}