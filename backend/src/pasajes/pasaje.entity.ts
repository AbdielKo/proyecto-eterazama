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
  tramo: string; // 'Cochabamba ➔ Eterazama' | 'Eterazama ➔ Cochabamba'

  @Column({ nullable: true })
  contactoRecibo: string;

  @CreateDateColumn()
  fechaCreacion: Date;
}