import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('vehiculos')
export class Vehiculo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  choferNombre: string;

  @Column({ nullable: true })
  choferCi: string;

  @Column({ nullable: true, type: 'text' })
  qrImagenUrl: string;

  @Column()
  tipoVehiculo: string;

  @Column()
  color: string;

  @Column({ unique: true })
  placa: string;

  @Column({ default: 'cochabamba' })
  paradaActual: string;

  @Column({ default: 1 })
  puestoFila: number;

  @Column({ type: 'int', array: true, default: '{}' })
  asientosOcupados: number[];

  @CreateDateColumn()
  fechaRegistro: Date;
}