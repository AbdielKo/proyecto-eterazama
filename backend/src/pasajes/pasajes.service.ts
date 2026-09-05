import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between } from 'typeorm';
import { Pasaje } from './pasaje.entity';
import { Vehiculo } from '../flota/vehiculo.entity';
import { FlotaService } from '../flota/flota.service';
import { RegistrarVentaDto } from './dto/registrar-venta.dto';
import { NotificacionPasajero } from '../notificaciones/notificacion-pasajero.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { SalidasService } from '../salidas/salidas.service';


@Injectable()
export class PasajesService {

  constructor(

    @InjectRepository(Pasaje)
    private readonly pasajeRepo: Repository<Pasaje>,

    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,

    private readonly dataSource: DataSource,

    private readonly flotaService: FlotaService,

    private readonly notificacionesService: NotificacionesService,

    private readonly salidasService: SalidasService,

  ) {}



  // usuarioId proviene SIEMPRE de req.user.userId (JWT), nunca del frontend.
  async registrarVenta(data: RegistrarVentaDto, usuarioId?: string) {

    const montoTotal =
      Number(data.montoAsientos) +
      Number(data.montoEncomienda);

    // Operación atómica: se bloquea el vehículo PRIMERO (pessimistic_write),
    // se releen sus asientosOcupados desde PostgreSQL bajo ese lock y se
    // validan los asientos contra ese estado. Solo entonces se crea el pasaje
    // y se actualiza el vehículo, todo dentro de la MISMA transacción.
    // Si dos compradores intentan vender el mismo asiento de forma simultánea,
    // el segundo queda bloqueado hasta que el primero confirme (commit) y al
    // releer verá la ocupación real, lanzando un error y haciendo rollback.
    // La notificación de "compra confirmada" se persiste dentro de la MISMA
    // transacción: si la venta hace rollback, la notificación tampoco queda.
    const { pasajeGuardado, notificacion, salida } =
      await this.dataSource.transaction(async (manager) => {

        const vehiculoRepo = manager.getRepository(Vehiculo);

        const vehiculo =
          await vehiculoRepo.findOne({
            where: data.vehiculoId
              ? { id: data.vehiculoId }
              : { placa: data.placaVehiculo },
            lock: { mode: 'pessimistic_write' },
          });

        if (!vehiculo) {
          throw new BadRequestException(
            'Vehículo no encontrado para la venta del pasaje.',
          );
        }

        // Un vehículo POR SALIR ya no recibe ventas: le queda solo partir.
        if (vehiculo.estadoViaje === 'por_salir') {
          throw new BadRequestException(
            'Este vehículo está POR SALIR y ya no recibe ventas de pasajes.',
          );
        }

        const ocupados =
          new Set(vehiculo.asientosOcupados || []);

        const asientosChofer =
          new Set(vehiculo.asientosChofer || []);

        if (data.asientos && data.asientos.length > 0) {
          for (const asiento of data.asientos) {
            if (asientosChofer.has(asiento)) {
              throw new BadRequestException(
                `El asiento ${asiento} pertenece al chofer y no está disponible para la venta.`,
              );
            }
            if (ocupados.has(asiento)) {
              throw new BadRequestException(
                `El asiento ${asiento} ya no está disponible. Fue vendida por otra persona.`,
              );
            }
            ocupados.add(asiento);
          }
        }

        const nuevoPasaje =
          manager.create(Pasaje, {
            ...data,
            vehiculoId: vehiculo.id,
            montoTotal,
            ...(usuarioId ? { pasajeroUsuarioId: usuarioId } : {}),
          });

        const pasajeGuardado =
          await manager.save(Pasaje, nuevoPasaje);

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
        await manager.save(Pasaje, pasajeGuardado);

        vehiculo.asientosOcupados =
          Array.from(ocupados);

        await vehiculoRepo.save(vehiculo);

        // AUTO programación de salida (si esta venta llena el vehículo): en la
        // MISMA transacción de la venta. Sin configuración de asientos no se
        // programa (comportamiento B1); el chofer igual puede hacerlo manual.
        const salida = await this.salidasService.programarSalidaEnTransaccion(
          manager,
          vehiculo.id,
          { manual: false },
        );

        // Notificación "compra confirmada" para el pasajero autenticado.
        // Se persiste junto con la venta; si hay rollback, no queda.
        let notificacion: NotificacionPasajero | null = null;
        if (usuarioId) {
          notificacion = await this.notificacionesService.crearEnTransaccion(
            manager,
            usuarioId,
            'compra',
            'Pasaje comprado',
            `Tu pasaje en el vehículo ${pasajeGuardado.placaVehiculo} fue confirmado. Asientos: ${(pasajeGuardado.asientos || []).join(', ')}. Total: Bs ${pasajeGuardado.montoTotal}.`,
          );
        }

        return { pasajeGuardado, notificacion, salida };

      });

    // Se notifica SOLO después de que la transacción hizo commit.
    this.flotaService.notificarFlota();

    if (salida.aplicada) {
      this.salidasService.emitirNotificaciones(salida);
    }

    // WebSocket post-commit (best-effort): la notificación ya está en
    // PostgreSQL, así que aunque el WS falle se consulta por GET.
    if (notificacion) {
      this.notificacionesService.notificarWS(notificacion.usuarioId, notificacion);
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
  // usuarioId proviene de req.user.userId (JWT), nunca del frontend.
  async solicitarCancelacion(id: string, motivo?: string, usuarioId?: string) {

    const { pasaje, notificacion } =
      await this.dataSource.transaction(async (manager) => {

        const guardado =
          await manager.findOne(Pasaje, {
            where: { id },
            lock: { mode: 'pessimistic_write' },
          });

        if (!guardado)
          throw new NotFoundException(
            'Pasaje no encontrado'
          );

        if (guardado.estadoReembolso === 'REEMBOLSADO')
          throw new BadRequestException(
            'Este pasaje ya fue reembolsado y no puede cancelarse de nuevo.'
          );

        if (guardado.estadoReembolso === 'PENDIENTE')
          throw new BadRequestException(
            'Ya existe una solicitud de reembolso pendiente para este pasaje.'
          );

        // Regla de seguridad: si el vehiculo esta EN RUTA, no se puede
        // solicitar (ni procesar) un reembolso.
        if (guardado.vehiculoId) {
          const vehiculo = await manager.findOne(Vehiculo, {
            where: { id: guardado.vehiculoId },
          });

          if (vehiculo && vehiculo.estadoViaje === 'en_ruta') {
            throw new BadRequestException(
              'El vehículo se encuentra EN RUTA. No es posible solicitar un reembolso mientras el vehículo esté en ruta.',
            );
          }
        }

        // Vincular el pasaje al usuario autenticado que solicita si todavía
        // no estaba vinculado (p. ej. pasajes creados antes de este cambio).
        if (usuarioId && !guardado.pasajeroUsuarioId) {
          guardado.pasajeroUsuarioId = usuarioId;
        }

        guardado.estadoReembolso = 'PENDIENTE';

        guardado.motivoCancelacion = (motivo || '').trim() || null;

        const guardadoFinal = await manager.save(Pasaje, guardado);

        // Notificación dentro de la MISMA transacción.
        let notificacion: NotificacionPasajero | null = null;
        if (guardadoFinal.pasajeroUsuarioId) {
          notificacion = await this.notificacionesService.crearEnTransaccion(
            manager,
            guardadoFinal.pasajeroUsuarioId,
            'cancelacion',
            'Solicitud de cancelación recibida',
            `Tu solicitud de cancelación del pasaje ${guardadoFinal.codigo || ''} fue registrada. La Secretaría la revisará para confirmar el reembolso.`,
          );
        }

        return { pasaje: guardadoFinal, notificacion };

      });

    // WebSocket post-commit (best-effort).
    if (notificacion) {
      this.notificacionesService.notificarWS(notificacion.usuarioId, notificacion);
    }

    return pasaje;

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