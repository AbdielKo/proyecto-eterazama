import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pasajes')
export class Pasaje {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pasajeroNombre: string;

  @Column()
  placaVehiculo: string;

  @Column('int', { array: true })
  asientos: number[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  montoAsientos: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoEncomienda: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  montoTotal: number;

  @Column()
  tramo: string; // 'cochabamba' | 'eterazama'

  @Column({ nullable: true })
  origen: string;

  @Column({ nullable: true })
  destino: string;

  @Column({ nullable: true })
  vehiculoId: number;

  @Column({ nullable: true })
  codigo: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  codigoBarras: string | null;

  @Column({ type: 'varchar', default: 'ACTIVO' })
  estadoBoleto: string;

  @Column({ type: 'timestamp', nullable: true })
  fechaEscaneo: Date | null;

  @Column({ type: 'varchar', nullable: true })
  escaneadoPor: string | null;

  @Column({ nullable: true })
  contactoRecibo: string;

  @Column({ nullable: true })
  ciRecibo: string;

  @Column({ nullable: true })
  telefonoRecibo: string;

  @Column({ type: 'jsonb', nullable: true })
  pasajeros: { asiento: number; nombre: string; ci?: string; telefono?: string }[];

  @Column({ default: 'EFECTIVO' })
  metodoPago: string;

@Column({ type: 'varchar', nullable: true })
  estadoReembolso: string | null;

  @Column({ type: 'varchar', nullable: true })
  motivoCancelacion: string | null;

  @Column({ type: 'varchar', nullable: true })
  secretariaReembolso: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  montoReembolsado: number | null;

  @Column({ type: 'timestamp', nullable: true })
  fechaReembolso: Date | null;

  @CreateDateColumn()
  fechaCreacion: Date;
}