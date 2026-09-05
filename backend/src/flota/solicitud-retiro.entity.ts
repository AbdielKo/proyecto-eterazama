import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Solicitud de retiro voluntario de la fila realizada por un chofer.
// Estados: PENDIENTE -> ACEPTADA | RECHAZADA
@Entity('solicitudes_retiro')
export class SolicitudRetiro {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Id del usuario (chofer) que solicita el retiro
  @Column({ type: 'varchar' })
  choferId: string;

  @Column({ type: 'varchar', nullable: true })
  choferNombre: string | null;

  // Placa del vehículo del chofer que solicita retirarse
  @Column({ type: 'varchar' })
  placa: string;

  // Id del vehículo del chofer
  @Column({ type: 'int', nullable: true })
  vehiculoId: number | null;

  // Parada en la que estaba anotado al momento de solicitar
  @Column({ type: 'varchar', default: 'cochabamba' })
  parada: string;

  // Puesto que ocupaba en la fila al momento de solicitar
  @Column({ type: 'int', default: 0 })
  puestoFila: number;

  // Si tenía pasajeros/asientos vendidos al momento de solicitar
  @Column({ type: 'boolean', default: false })
  tienePasajeros: boolean;

  // Cantidad de asientos vendidos al momento de solicitar
  @Column({ type: 'int', default: 0 })
  cantidadAsientos: number;

  // Motivo obligatorio que explica por qué necesita retirarse
  @Column({ type: 'text', default: '' })
  motivo: string;

  // Estado de la solicitud
  @Column({ type: 'varchar', default: 'PENDIENTE' })
  estado: string;

  // Secretaría que procesó la solicitud (respuesta)
  @Column({ type: 'varchar', nullable: true })
  procesadoPor: string | null;

  // Comentario opcional de la secretaría al aceptar/rechazar
  @Column({ type: 'text', nullable: true })
  comentarioRespuesta: string | null;

  @CreateDateColumn()
  fechaCreacion: Date;

  @UpdateDateColumn()
  fechaActualizacion: Date;
}
