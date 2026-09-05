import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// Notificaciones del rol PASAJERO (usuario).
// Son el equivalente exacto de `notificaciones_chofer`, pero con el
// destinatario identificado por `usuarioId` (el `usuarios.id` del JWT).
@Entity('notificaciones_pasajero')
export class NotificacionPasajero {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  usuarioId: string;

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