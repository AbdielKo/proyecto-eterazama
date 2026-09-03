import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';

@Entity('liquidaciones')
export class Liquidacion {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  choferId: string;

  @Column()
  choferNombre: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'int', default: 0 })
  cantidadViajes: number;

  @Column({ type: 'int', default: 0 })
  cantidadPasajeros: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPasajes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalEncomiendas: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalGenerado: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoLiquidado: number;

  @Column({
    default: 'pendiente'
  })
  estado: string;

  @CreateDateColumn()
  fechaCreacion: Date;

}
