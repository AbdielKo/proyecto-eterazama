import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('viajes')
export class Viaje {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  placaVehiculo: string;

  @Column()
  choferNombre: string;

  @Column()
  origen: string;

  @Column()
  destino: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'time' })
  horaSalida: string;

  @Column({ type: 'time', nullable: true })
  horaLlegada: string;

  @Column({
    default: 'programado'
  })
  estado: string;

  @Column({ type: 'int', default: 0 })
  asientosOcupados: number;

  @Column({ type: 'int', default: 14 })
  capacidadTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalGenerado: number;

  @Column({ type: 'int', default: 0 })
  pasajerosTransportados: number;

  @CreateDateColumn()
  fechaCreacion: Date;

  @UpdateDateColumn()
  fechaActualizacion: Date;

}
