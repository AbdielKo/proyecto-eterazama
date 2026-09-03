import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';


@Entity('reviews')
export class Review {


  @PrimaryGeneratedColumn('uuid')
  id: string;



  @Column()
  usuarioId: string;



  @Column()
  vehiculoId: number;



  @Column({
    nullable: true
  })
  pasajeId: string;



  @Column({
    type: 'int'
  })
  estrellas: number;



  @Column({
    type: 'text',
    nullable: true
  })
  comentario: string;



  @CreateDateColumn()
  fechaCreacion: Date;


}