import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';

@Entity('notificaciones_chofer')
export class NotificacionChofer {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  choferId: string;

  @Column()
  tipo: string;

  @Column()
  titulo: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ default: false })
  leida: boolean;

  @CreateDateColumn()
  fechaCreacion: Date;

}
