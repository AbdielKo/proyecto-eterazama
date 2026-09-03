import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';

@Entity('boletos')
export class Boleto {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pasajeroNombre: string;

  @Column({ nullable: true })
  pasajeroTelefono: string;

  @Column()
  placaVehiculo: string;

  @Column()
  viajeId: string;

  @Column({ type: 'int' })
  asiento: number;

  @Column()
  origen: string;

  @Column()
  destino: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({
    default: 'reservado'
  })
  estadoBoleto: string;

  @Column({
    default: 'pendiente'
  })
  estadoPago: string;

  @Column({ default: false })
  escaneado: boolean;

  @Column({ nullable: true })
  codigoQR: string;

  @Column({ nullable: true })
  contactoRecibo: string;

  @CreateDateColumn()
  fechaCreacion: Date;

}
