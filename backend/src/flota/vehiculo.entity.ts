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