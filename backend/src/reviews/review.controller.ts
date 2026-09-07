import {
 Controller,
 Post,
 Body,
 Get,
 Param,
 Query,
 Req,
 UseGuards
}
from '@nestjs/common';

import type { Request } from 'express';

import {
 ReviewService
}
from './review.service';


import {
 CreateReviewDto
}
from './dto/create-review.dto';


import {
 JwtAuthGuard
}
from '../auth/jwt-auth.guard';



@Controller('reviews')
export class ReviewController {


constructor(
private readonly reviewService:
ReviewService
){}



// Solo usuarios autenticados pueden calificar. El usuarioId se toma del JWT
// (req.user.userId) y nunca del body, que solo aporta datos de la calificación.
@UseGuards(JwtAuthGuard)
@Post()
crear(
@Body()
data:CreateReviewDto,
@Req()
req: Request
){

return this.reviewService
.crearReview(
  data,
  (req.user as { userId: string }).userId
);

}




@Get('vehiculo/:id')
obtenerVehiculo(

@Param('id')
id:number

){

return this.reviewService
.obtenerPorVehiculo(
Number(id)
);

}




@Get('promedio/:id')
promedio(

@Param('id')
id:number

){

return this.reviewService
.promedioVehiculo(
Number(id)
);

}





@Get('graficas')
graficas(

@Query('periodo')
periodo:string

){

return this.reviewService
.graficas(
periodo || 'mes'
);

}



}