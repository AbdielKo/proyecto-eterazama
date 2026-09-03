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



@Module({

  imports:[

    TypeOrmModule.forFeature([

      Review,

      Vehiculo

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