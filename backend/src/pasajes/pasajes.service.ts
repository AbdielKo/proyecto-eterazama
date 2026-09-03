import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Pasaje } from './pasaje.entity';
import { Vehiculo } from '../flota/vehiculo.entity';
import { FlotaService } from '../flota/flota.service';
import { RegistrarVentaDto } from './dto/registrar-venta.dto';


@Injectable()
export class PasajesService {

  constructor(

    @InjectRepository(Pasaje)
    private readonly pasajeRepo: Repository<Pasaje>,

    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,

    private readonly flotaService: FlotaService,

  ) {}



  async registrarVenta(data: RegistrarVentaDto) {


    const montoTotal =
    Number(data.montoAsientos) +
    Number(data.montoEncomienda);



    const nuevoPasaje =
    this.pasajeRepo.create({

      ...data,

      montoTotal,

    });



    const pasajeGuardado =
    await this.pasajeRepo.save(nuevoPasaje);

    const codigoBoleto = `ECT-${pasajeGuardado.id
      .substring(0, 8)
      .toUpperCase()}`;

    if (!pasajeGuardado.codigoBarras) {
      pasajeGuardado.codigo = codigoBoleto;
      pasajeGuardado.codigoBarras = codigoBoleto;
    }
    if (!pasajeGuardado.estadoBoleto) {
      pasajeGuardado.estadoBoleto = 'ACTIVO';
    }
    await this.pasajeRepo.save(pasajeGuardado);



    if(data.asientos && data.asientos.length > 0){

      await this.flotaService.ocuparAsientos(
        data.vehiculoId,
        data.asientos
      );

    }


    return pasajeGuardado;

  }





  async obtenerCaja(){

    return this.pasajeRepo.find({

      order:{
        fechaCreacion:"DESC"
      }

    });

  }





  obtenerHistorial(){

    return this.pasajeRepo.find({

      order:{
        fechaCreacion:'DESC'
      }

    });

  }





  async obtenerPorId(id:string){

    const pasaje =
    await this.pasajeRepo.findOneBy({
      id
    });


    if(!pasaje)

      throw new NotFoundException(
        'Pasaje no encontrado'
      );


    return pasaje;

  }


  // El usuario (pasajero) SOLICITA la cancelación de su pasaje.
  // Solo crea la solicitud PENDIENTE: no libera el asiento ni reembolsa.
  async solicitarCancelacion(id:string, motivo?:string){

    const pasaje =
    await this.pasajeRepo.findOneBy({
      id
    });


    if(!pasaje)

      throw new NotFoundException(
        'Pasaje no encontrado'
      );


    if(pasaje.estadoReembolso === 'REEMBOLSADO')

      throw new BadRequestException(
        'Este pasaje ya fue reembolsado y no puede cancelarse de nuevo.'
      );


    if(pasaje.estadoReembolso === 'PENDIENTE')

      throw new BadRequestException(
        'Ya existe una solicitud de reembolso pendiente para este pasaje.'
      );


    // Regla de seguridad: si el vehiculo esta EN RUTA, no se puede
    // solicitar (ni procesar) un reembolso.
    if (pasaje.vehiculoId) {
      const vehiculo = await this.vehiculoRepo.findOne({
        where: { id: pasaje.vehiculoId },
      });

      if (vehiculo && vehiculo.estadoViaje === 'en_ruta') {
        throw new BadRequestException(
          'El vehículo se encuentra EN RUTA. No es posible solicitar un reembolso mientras el vehículo esté en ruta.',
        );
      }
    }


    pasaje.estadoReembolso = 'PENDIENTE';

    pasaje.motivoCancelacion = (motivo || '').trim() || null;


    return this.pasajeRepo.save(pasaje);

  }





  obtenerPorPlaca(placa:string){

    return this.pasajeRepo.find({

      where:{
        placaVehiculo:placa
      },

      order:{
        fechaCreacion:'DESC'
      }

    });

  }





  async obtenerCierreCaja(){


    const pasajes =
    await this.pasajeRepo.find();



    let totalAsientos = 0;

    let totalEncomiendas = 0;

    let totalCaja = 0;



    pasajes.forEach((p)=>{


      totalAsientos +=
      Number(p.montoAsientos);


      totalEncomiendas +=
      Number(p.montoEncomienda);


      totalCaja +=
      Number(p.montoTotal);


    });



    return {

      totalBoletosEmitidos:
      pasajes.length,


      subtotalAsientos:
      totalAsientos,


      subtotalEncomiendas:
      totalEncomiendas,


      montoTotalCaja:
      totalCaja,

    };


  }






  async obtenerVentasDelDia(){


    const inicioDia =
    new Date();


    inicioDia.setHours(
      0,0,0,0
    );



    const finDia =
    new Date();


    finDia.setHours(
      23,59,59,999
    );



    const pasajesHoy =
    await this.pasajeRepo.find({

      where:{

        fechaCreacion:
        Between(
          inicioDia,
          finDia
        )

      },


      order:{
        fechaCreacion:'DESC'
      }


    });




    const totalHoy =
    pasajesHoy.reduce(

      (acc,item)=>

      acc +
      Number(item.montoTotal),

      0

    );




    return {

      fecha:
      inicioDia
      .toISOString()
      .split('T')[0],


      totalVentasHoy:
      pasajesHoy.length,


      montoTotalHoy:
      totalHoy,


      detalles:
      pasajesHoy

    };


  }


}