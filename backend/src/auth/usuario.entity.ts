import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  nombreUsuario: string;

  @Column({ nullable: true })
  nombre: string;

  @Column({ nullable: true })
  apellidos: string;

  @Column({ unique: true, nullable: true })
  gmail: string;

  @Column({ unique: true, nullable: true })
  telefono: string;

  @Column({ select: false, nullable: true })
  passwordHash: string;

  @Column({ default: 'pasajero' })
  rol: string; // 'pasajero', 'chofer', 'secretaria'

  @Column({ nullable: true })
  placaAsignada: string;

  @CreateDateColumn()
  fechaRegistro: Date;
}