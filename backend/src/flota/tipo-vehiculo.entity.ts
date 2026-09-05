import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('tipos_vehiculo')
export class TipoVehiculo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    unique: true,
  })
  nombre: string;

  @CreateDateColumn()
  fechaRegistro: Date;
}
