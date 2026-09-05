import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from 'typeorm';


@Entity('vehiculos')
export class Vehiculo {


  @PrimaryGeneratedColumn()
  id:number;



  @Column()
  choferNombre:string;



  @Column({
    nullable:true
  })
  choferCi:string;



  @Column({
    nullable:true,
    type:'text'
  })
  qrImagenUrl:string;



  @Column()
  tipoVehiculo:string;



  @Column()
  color:string;



  @Column({
    unique:true
  })
  placa:string;



  @Column({
    default:'cochabamba'
  })
  paradaActual:string;



  @Column({
    default:1
  })
  puestoFila:number;



  @Column({
    type:'int',
    array:true,
    default:'{}'
  })
  asientosOcupados:number[];



  @Column({
    type:'int',
    array:true,
    default:'{}'
  })
  asientosChofer:number[];

  // Configuración dinámica de la distribución/orden de los asientos.
  // Cada trufi conserva su propia configuración definida por Secretaría.
  // Estructura: { ancho: number; filas: (number | null)[][] }
  // Donde cada fila es un array de celdas: un número = asiento (numeración
  // libre/única), y null = espacio vacío (no vendible). El índice de fila es
  // la posición vertical (Y) y el índice dentro de la fila la posición
  // horizontal (X). El tipo de asiento chofer se define en asientosChofer.
  @Column({
    type:'jsonb',
    nullable:true
  })
  configuracionAsientos: { ancho: number; filas: (number | null)[][] } | null;

  @Column({
    default:14
  })
  capacidadTotal:number;


  @Column({
    default:'activo'
  })
  estadoVehiculo:string;


  @Column({
    default:'listo'
  })
  estadoViaje:string;


  @Column({
    type:'timestamp',
    nullable:true
  })
  horaIngresoFila:Date | null;


  @Column({
    type:'timestamp',
    nullable:true
  })
  fechaEstado:Date | null;


  // Fecha/hora real (timestamp) en la que el vehículo está programado para
  // partir (estadoViaje = 'por_salir'). Se persiste en PostgreSQL; la cuenta
  // regresiva es solo la diferencia con la hora actual. Al llegar el momento,
  // el backend transita el vehículo a EN RUTA y limpia este campo.
  @Column({
    type:'timestamp',
    nullable:true
  })
  salidaProgramada:Date | null;


  // ====================================
  // NUEVO SISTEMA DE CALIFICACIONES
  // ====================================


  @Column({
    type:'decimal',
    precision:3,
    scale:2,
    default:0
  })
  promedioEstrellas:number;



  @Column({
    default:0
  })
  cantidadResenas:number;



  @CreateDateColumn()
  fechaRegistro:Date;


}