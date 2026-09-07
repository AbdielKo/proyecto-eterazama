import {
  Injectable,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';


import {
  InjectRepository
} from '@nestjs/typeorm';


import {
  Repository,
  IsNull
} from 'typeorm';


import {
  Vehiculo
} from '../flota/vehiculo.entity';


import {
  Pasaje
} from '../pasajes/pasaje.entity';


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
Repository<Vehiculo>,



@InjectRepository(Pasaje)

private readonly pasajeRepo:
Repository<Pasaje>


){}




// usuarioId proviene SIEMPRE de req.user.userId (JWT), nunca del frontend.
async crearReview(

data:CreateReviewDto,

usuarioId:string

){



const vehiculo =

await this.vehiculoRepo.findOne({

where:{

id:data.vehiculoId

}

});


if(!vehiculo){

throw new BadRequestException(

"El vehículo no existe"

);

}




// Si se adjunta un pasaje debe existir, pertenecer al usuario autenticado
// y corresponder al vehículo indicado. Sin pasaje, se valida identidad (JWT)
// y se limita a una calificación por vehículo/sesión.

if(data.pasajeId){

const pasaje =

await this.pasajeRepo.findOne({

where:{

id:data.pasajeId

}

});


if(!pasaje){

throw new BadRequestException(

"El pasaje indicado no existe"

);

}


if(!pasaje.pasajeroUsuarioId){

throw new BadRequestException(

"Este pasaje no está vinculado a tu cuenta y no se puede calificar."

);

}


if(pasaje.pasajeroUsuarioId !== usuarioId){

throw new ForbiddenException(

"No puedes calificar el viaje de otra persona."

);

}


if(pasaje.vehiculoId !== data.vehiculoId){

throw new BadRequestException(

"El pasaje no corresponde al vehículo seleccionado."

);

}

}


// Anti-duplicado: un solo voto por pasaje o por vehículo (sin pasaje).
const existe =

data.pasajeId

? await this.reviewRepo.findOne({
    where:{ usuarioId, pasajeId:data.pasajeId }
  })

: await this.reviewRepo.findOne({
    where:{ usuarioId, vehiculoId:data.vehiculoId, pasajeId: IsNull() }
  });


if(existe){

throw new BadRequestException(

"Ya calificaste este viaje"

);

}




const review =

this.reviewRepo.create({

usuarioId,

vehiculoId:data.vehiculoId,

pasajeId:data.pasajeId || undefined,

estrellas:data.estrellas,

comentario:data.comentario || undefined

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