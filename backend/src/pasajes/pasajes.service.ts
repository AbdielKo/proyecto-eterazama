import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between } from 'typeorm';
import { Pasaje } from './pasaje.entity';
import { Vehiculo } from '../flota/vehiculo.entity';
import { Usuario } from '../auth/usuario.entity';
import { FlotaService } from '../flota/flota.service';
import { RegistrarVentaDto } from './dto/registrar-venta.dto';
import { NotificacionPasajero } from '../notificaciones/notificacion-pasajero.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { SalidasService } from '../salidas/salidas.service';
import { Configuracion } from '../secretaria/entities/configuracion.entity';
import { ROLES } from '../auth/roles';


@Injectable()
export class PasajesService {

  constructor(

    @InjectRepository(Pasaje)
    private readonly pasajeRepo: Repository<Pasaje>,

    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,

    @InjectRepository(Configuracion)
    private readonly configRepo: Repository<Configuracion>,

    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,

    private readonly dataSource: DataSource,

    private readonly flotaService: FlotaService,

    private readonly notificacionesService: NotificacionesService,

    private readonly salidasService: SalidasService,

  ) {}



  // usuarioId proviene SIEMPRE de req.user.userId (JWT), nunca del frontend.
  // El precio de los asientos lo calcula el backend desde la configuración
  // oficial (precioUnitario * cantidad) y NUNCA se confía en el monto enviado
  // por el cliente. La encomienda opcional se valida como número >= 0.
  async registrarVenta(data: RegistrarVentaDto, usuarioId?: string) {

    const tramo = this.normalizarTramo(data.tramo);
    const precioUnitario = await this.obtenerPrecioTramo(tramo);

    const asientos = Array.from(new Set((data.asientos || []).map(Number)));
    if (asientos.length === 0) {
      throw new BadRequestException(
        'Debe seleccionar al menos un asiento.',
      );
    }
    if (asientos.length > 50) {
      throw new BadRequestException(
        'No se pueden vender más de 50 asientos en una sola operación.',
      );
    }
    for (const asiento of asientos) {
      if (!Number.isInteger(asiento) || !Number.isFinite(asiento)) {
        throw new BadRequestException(
          `El valor de asiento "${asiento}" no es válido. Debe ser un número entero positivo.`,
        );
      }
    }

    const montoEncomienda = Number(data.montoEncomienda || 0);
    if (!Number.isFinite(montoEncomienda) || montoEncomienda < 0) {
      throw new BadRequestException(
        'El monto de la encomienda no puede ser negativo.',
      );
    }
    if (montoEncomienda > 5000) {
      throw new BadRequestException(
        'El monto de la encomienda excede el límite permitido (Bs 5000).',
      );
    }

    // El precio SIEMPRE lo calcula el servidor desde la configuración oficial.
    // Los valores montoAsientos/montoTotal enviados por el cliente son ignorados.
    const montoAsientos = precioUnitario * asientos.length;
    const montoTotal = montoAsientos + montoEncomienda;

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

        // Validar estado operativo y ubicación real del vehículo. Nunca se
        // confía únicamente en lo que envía el navegador: el origen real lo
        // determina el backend a partir de la fila/parada actual en PostgreSQL.
        if (vehiculo.estadoVehiculo === 'inactivo') {
          throw new BadRequestException(
            'Este vehículo está INACTIVO y no puede recibir ventas de pasajes.',
          );
        }
        if (vehiculo.estadoViaje === 'mantenimiento') {
          throw new BadRequestException(
            'Este vehículo está en MANTENIMIENTO y no puede recibir ventas de pasajes.',
          );
        }
        if (vehiculo.estadoViaje === 'en_ruta') {
          throw new BadRequestException(
            'Este vehículo está EN RUTA y no puede recibir nuevas ventas de pasajes.',
          );
        }
        if (vehiculo.estadoViaje === 'fin_de_ruta') {
          throw new BadRequestException(
            'Este vehículo terminó su ruta y no puede recibir nuevas ventas de pasajes.',
          );
        }
        if (vehiculo.paradaActual !== 'cochabamba' && vehiculo.paradaActual !== 'eterazama') {
          throw new BadRequestException(
            'Este vehículo no está operando desde una parada válida y no puede recibir ventas de pasajes.',
          );
        }

        // Coherencia tramo vs ubicación real del vehículo:
        //  - Vehículo en COCHABAMBA  → solo puede vender cochabamba→eterazama
        //  - Vehículo en ETERAZAMA   → solo puede vender eterazama→cochabamba
        if (vehiculo.paradaActual !== tramo) {
          throw new BadRequestException(
            `El vehículo ${vehiculo.placa} está ubicado en ${vehiculo.paradaActual === 'cochabamba' ? 'Cochabamba' : 'Eterazama'}, por lo que solo puede vender pasajes desde esa parada. El tramo enviado no coincide con la ubicación real del vehículo.`,
          );
        }

        // El vehículo debe pertenecer a un chofer oficial ACTIVO para vender.
        const choferOficial = await manager.findOne(Usuario, {
          where: {
            rol: ROLES.CHOFER,
            estado: 'activo',
            placaAsignada: vehiculo.placa,
          },
        });
        if (!choferOficial) {
          throw new BadRequestException(
            `El vehículo ${vehiculo.placa} no tiene un chofer oficial activo y no puede recibir ventas de pasajes.`,
          );
        }

        // Rango permitido de asientos: 1..capacidad REAL del vehículo.
        for (const asiento of asientos) {
          if (
            !Number.isInteger(asiento) ||
            asiento < 1 ||
            asiento > vehiculo.capacidadTotal
          ) {
            throw new BadRequestException(
              `El asiento ${asiento} está fuera del rango permitido (1-${vehiculo.capacidadTotal}).`,
            );
          }
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

        if (asientos.length > 0) {
          for (const asiento of asientos) {
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
            pasajeroNombre: data.pasajeroNombre,
            placaVehiculo: vehiculo.placa,
            vehiculoId: vehiculo.id,
            asientos,
            tramo,
            montoAsientos,
            montoEncomienda,
            montoTotal,
            contactoRecibo: data.contactoRecibo || undefined,
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





  // Acceso al historial según el rol:
  //  - USUARIO (pasajero): solo sus propios pasajes (comprados con su cuenta).
  //  - CHOFER: solo los pasajes de SU vehículo asignado.
  //  - SECRETARIA: historial administrativo completo.
  obtenerHistorial(usuario?: { userId?: string; rol?: string }) {
    const rol = usuario?.rol;

    if (rol === ROLES.USUARIO) {
      return this.pasajeRepo.find({
        where: { pasajeroUsuarioId: usuario!.userId || '' },
        order: { fechaCreacion: 'DESC' },
      });
    }

    if (rol === ROLES.CHOFER) {
      return this.obtenerHistorialChofer(usuario!.userId || '');
    }

    return this.pasajeRepo.find({
      order: { fechaCreacion: 'DESC' },
    });
  }

  // Historial limitado al vehículo asignado al chofer en su cuenta.
  private async obtenerHistorialChofer(choferId: string) {
    const chofer = await this.usuarioRepo.findOne({
      where: { id: choferId },
      select: { placaAsignada: true },
    });

    if (!chofer?.placaAsignada) {
      return [];
    }

    return this.pasajeRepo.find({
      where: { placaVehiculo: chofer.placaAsignada },
      order: { fechaCreacion: 'DESC' },
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


  // Acceso al comprobante PDF: solo el dueño del pasaje o la Secretaría.
  // Los choferes descargan sus recibos desde el panel del chofer.
  async obtenerPasajeAutorizado(
    id: string,
    usuario?: { userId?: string; rol?: string },
  ) {
    const pasaje = await this.obtenerPorId(id);

    if (usuario && usuario.rol === ROLES.SECRETARIA) {
      return pasaje;
    }

    if (usuario && usuario.rol === ROLES.CHOFER) {
      throw new ForbiddenException(
        'Los recibos de chofer se descargan desde el panel del chofer.',
      );
    }

    if (!pasaje.pasajeroUsuarioId) {
      throw new ForbiddenException(
        'Este pasaje no está vinculado a tu cuenta.',
      );
    }

    if (pasaje.pasajeroUsuarioId !== usuario?.userId) {
      throw new ForbiddenException(
        'No puedes descargar el comprobante de otro pasajero.',
      );
    }

    return pasaje;
  }


  private normalizarTramo(tramo: string): 'cochabamba' | 'eterazama' {
    const texto = String(tramo || '').trim().toLowerCase();

    if (texto === 'cochabamba') return 'cochabamba';
    if (texto === 'eterazama') return 'eterazama';

    // Composiciones tipo "Cochabamba -> Eterazama": el origen define el tramo.
    const [origen] = texto.split(/->|→|—|–/);
    const desde = (origen || '').trim().toLowerCase();
    if (desde.includes('cochabamba')) return 'cochabamba';
    if (desde.includes('eterazama')) return 'eterazama';

    // Fallback por mención (compatibilidad).
    if (texto.includes('cochabamba')) return 'cochabamba';
    if (texto.includes('eterazama')) return 'eterazama';

    throw new BadRequestException(
      'Tramo no válido para la venta. Debe ser Cochabamba o Eterazama.',
    );
  }

  private async obtenerConfiguracionFila() {
    let cfg = await this.configRepo.findOneBy({ id: 1 });

    if (!cfg) {
      cfg = await this.configRepo.save(
        this.configRepo.create({
          id: 1,
          nombreSindicato: 'Sindicato Mixto Trans Eterazama',
          telefono: '',
          email: '',
          direccion: '',
          precioCochabamba: 20,
          precioEterazama: 15,
          horarioApertura: '05:00',
          horarioCierre: '22:00',
        }),
      );
    }

    return cfg;
  }

  private async obtenerPrecioTramo(tramo: 'cochabamba' | 'eterazama') {
    const cfg = await this.obtenerConfiguracionFila();

    const precio = Number(
      tramo === 'cochabamba' ? cfg.precioCochabamba : cfg.precioEterazama,
    );

    if (!Number.isFinite(precio) || precio <= 0) {
      throw new BadRequestException(
        'La configuración de precios no es válida. Configúrela en Configuración.',
      );
    }

    return precio;
  }

  // Precios oficiales vigentes para que el pasajero vea el total REAL que el
  // backend cobrará (el frontend no fija precios).
  async obtenerPreciosOficiales() {
    const cfg = await this.obtenerConfiguracionFila();
    return {
      cochabamba: Number(cfg.precioCochabamba || 0),
      eterazama: Number(cfg.precioEterazama || 0),
    };
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

        // Regla de propiedad: el pasajero SOLO puede solicitar la cancelación
        // de un pasaje vinculado a SU cuenta (JWT). Los pasajes anónimos se
        // gestionan desde la Secretaría. No se auto-vincula ni se permite
        // cancelar pasajes ajenos.
        if (!guardado.pasajeroUsuarioId) {
          throw new BadRequestException(
            'Este pasaje no está vinculado a tu cuenta. Si lo compraste en ventanilla, contacta a la Secretaría para gestionar el reembolso.',
          );
        }

        if (usuarioId !== guardado.pasajeroUsuarioId) {
          throw new ForbiddenException(
            'No puedes solicitar la cancelación de un pasaje que no es tuyo.',
          );
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





  async obtenerPorPlaca(
    placa: string,
    usuario?: { userId?: string; rol?: string },
  ) {
    const rol = usuario?.rol;

    // Un pasajero/usuario común no puede consultar el historial administrativo.
    if (rol !== ROLES.SECRETARIA && rol !== ROLES.CHOFER) {
      throw new ForbiddenException(
        'No tienes permisos para consultar las ventas por vehículo.',
      );
    }

    // Chofer: solo puede consultar SU propio vehículo asignado.
    if (rol === ROLES.CHOFER) {
      const chofer = await this.usuarioRepo.findOne({
        where: { id: usuario!.userId || '' },
        select: { placaAsignada: true },
      });

      if (!chofer?.placaAsignada || chofer.placaAsignada !== placa) {
        throw new ForbiddenException(
          'No puedes consultar las ventas de otro vehículo.',
        );
      }
    }

    return this.pasajeRepo.find({
      where: { placaVehiculo: placa },
      order: { fechaCreacion: 'DESC' },
    });
  }




async obtenerCierreCaja(usuario?: { userId?: string; rol?: string }) {
    // Defensa en profundidad: la caja es información administrativa exclusiva
    // de la Secretaría. El controlador ya restringe por rol; aquí se vuelve a
    // validar ante llamadas directas al servicio.
    if (usuario?.rol !== ROLES.SECRETARIA) {
      throw new ForbiddenException(
        'No tienes permisos para consultar el cierre de caja.',
      );
    }

    const pasajes = await this.pasajeRepo.find();

    let totalAsientos = 0;
    let totalEncomiendas = 0;
    let totalCaja = 0;

    pasajes.forEach((p) => {
      totalAsientos += Number(p.montoAsientos);
      totalEncomiendas += Number(p.montoEncomienda);
      totalCaja += Number(p.montoTotal);
    });

    return {
      totalBoletosEmitidos: pasajes.length,
      subtotalAsientos: totalAsientos,
      subtotalEncomiendas: totalEncomiendas,
      montoTotalCaja: totalCaja,
    };
  }





async obtenerVentasDelDia(usuario?: { userId?: string; rol?: string }) {
    // Defensa en profundidad: reporte administrativo exclusivo de Secretaría.
    if (usuario?.rol !== ROLES.SECRETARIA) {
      throw new ForbiddenException(
        'No tienes permisos para consultar las ventas del día.',
      );
    }

    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const pasajesHoy = await this.pasajeRepo.find({
      where: {
        fechaCreacion: Between(inicioDia, finDia),
      },
      order: { fechaCreacion: 'DESC' },
    });

    const totalHoy =
      pasajesHoy.reduce(
        (acc, item) =>
          acc + Number(item.montoTotal),
        0,
      );

    return {
      fecha: inicioDia.toISOString().split('T')[0],
      totalVentasHoy: pasajesHoy.length,
      montoTotalHoy: totalHoy,
      detalles: pasajesHoy,
    };
  }


}