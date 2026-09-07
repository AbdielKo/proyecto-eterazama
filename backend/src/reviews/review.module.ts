import {
  Module
} from '@nestjs/common';


import {
  TypeOrmModule
} from '@nestjs/typeorm';


import {
  Review
} from './review.entity';


import {
  ReviewController
} from './review.controller';


import {
  ReviewService
} from './review.service';


import {
  Vehiculo
} from '../flota/vehiculo.entity';


import {
  Pasaje
} from '../pasajes/pasaje.entity';



@Module({

  imports:[

    TypeOrmModule.forFeature([

      Review,

      Vehiculo,

      Pasaje

    ])

  ],



  controllers:[

    ReviewController

  ],



  providers:[

    ReviewService

  ],



  exports:[

    ReviewService

  ]

})


export class ReviewModule {}