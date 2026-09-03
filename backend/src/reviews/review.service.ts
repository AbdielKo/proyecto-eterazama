import {
  Injectable,
  BadRequestException
} from '@nestjs/common';


import {
  InjectRepository
} from '@nestjs/typeorm';


import {
  Repository
} from 'typeorm';


import {
  Vehiculo
} from '../flota/vehiculo.entity';


import {
  Review
} from './review.entity';


import {
  CreateReviewDto
} from './dto/create-review.dto';



@Injectable()
export class ReviewService {



constructor(


@InjectRepository(Review)

private readonly reviewRepo:
Repository<Review>,



@InjectRepository(Vehiculo)

private readonly vehiculoRepo:
Repository<Vehiculo>


){}





async crearReview(

data:CreateReviewDto

){



const existe =

await this.reviewRepo.findOne({

where:{

usuarioId:data.usuarioId,

pasajeId:data.pasajeId

}

});




if(existe){

throw new BadRequestException(

"Ya calificaste este viaje"

);

}





const review =

this.reviewRepo.create({

usuarioId:data.usuarioId,

vehiculoId:data.vehiculoId,

pasajeId:data.pasajeId,

estrellas:data.estrellas,

comentario:data.comentario

});





const guardada =

await this.reviewRepo.save(

review

);





// Actualizar estrellas del trufi

await this.actualizarPromedioVehiculo(

data.vehiculoId

);





return guardada;


}








async actualizarPromedioVehiculo(

vehiculoId:number

){



const reviews =

await this.reviewRepo.find({

where:{

vehiculoId

}

});





const vehiculo =

await this.vehiculoRepo.findOne({

where:{

id:vehiculoId

}

});





if(!vehiculo){

return;

}





if(reviews.length===0){


vehiculo.promedioEstrellas = 0;

vehiculo.cantidadResenas = 0;


}

else{



const suma =

reviews.reduce(

(total,r)=>

total + r.estrellas,

0

);




vehiculo.promedioEstrellas =

Number(

(

suma /

reviews.length

)

.toFixed(2)

);





vehiculo.cantidadResenas =

reviews.length;



}





await this.vehiculoRepo.save(

vehiculo

);


}









async obtenerPorVehiculo(

vehiculoId:number

){



return await this.reviewRepo.find({


where:{

vehiculoId

},


order:{

fechaCreacion:'DESC'

}


});


}









async promedioVehiculo(

vehiculoId:number

){



const reviews =

await this.obtenerPorVehiculo(

vehiculoId

);





if(reviews.length===0){


return {

promedio:0,

cantidad:0

};


}






const suma =

reviews.reduce(


(total,r)=>

total+r.estrellas,


0


);






return {


promedio:

Number(

(

suma /

reviews.length

)

.toFixed(2)

),



cantidad:

reviews.length



};



}









async graficas(

periodo:string

){



let fecha =

new Date();





if(periodo==='dia'){


fecha.setDate(

fecha.getDate()-1

);


}





if(periodo==='semana'){


fecha.setDate(

fecha.getDate()-7

);


}





if(periodo==='mes'){


fecha.setMonth(

fecha.getMonth()-1

);


}





return await this.reviewRepo


.createQueryBuilder('r')



.select(

"DATE(r.fechaCreacion)",

"fecha"

)



.addSelect(

"AVG(r.estrellas)",

"promedio"

)



.where(

"r.fechaCreacion >= :fecha",

{

fecha

}

)



.groupBy(

"DATE(r.fechaCreacion)"

)



.orderBy(

"fecha",

"ASC"

)



.getRawMany();



}





}