import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('configuracion_sindicato')
export class Configuracion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'Sindicato Mixto Trans Eterazama' })
  nombreSindicato: string;

  @Column({ default: '' })
  telefono: string;

  @Column({ default: '' })
  email: string;

  @Column({ default: '' })
  direccion: string;

  // Precio oficial Cochabamba -> Eterazama
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 20 })
  precioCochabamba: number;

  // Precio oficial Eterazama -> Cochabamba
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 15 })
  precioEterazama: number;

  @Column({ default: '05:00' })
  horarioApertura: string;

  @Column({ default: '22:00' })
  horarioCierre: string;

  @UpdateDateColumn()
  actualizadoEn: Date;
}