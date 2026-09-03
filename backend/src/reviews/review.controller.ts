import {
 Controller,
 Post,
 Body,
 Get,
 Param,
 Query
}
from '@nestjs/common';


import {
 ReviewService
}
from './review.service';


import {
 CreateReviewDto
}
from './dto/create-review.dto';



@Controller('reviews')
export class ReviewController {


constructor(
private readonly reviewService:
ReviewService
){}



@Post()
crear(
@Body()
data:CreateReviewDto
){

return this.reviewService
.crearReview(data);

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