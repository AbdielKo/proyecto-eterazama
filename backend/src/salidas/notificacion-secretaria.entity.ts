import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// Notificaciones del rol SECRETARIA.
// Equivalente exacto de `notificaciones_chofer` y `notificaciones_pasajero`,
// pero con el destinatario identificado por `secretariaId` (el `usuarios.id`
// del JWT de la secretaria). Se crearon para el flujo de salida (por_salir y
// EN RUTA) que debe notificar a los 3 roles.
@Entity('notificaciones_secretaria')
export class NotificacionSecretaria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  secretariaId: string;

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