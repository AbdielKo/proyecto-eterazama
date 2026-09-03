import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { Vehiculo } from '../flota/vehiculo.entity';
import { Viaje } from './entities/viaje.entity';
import { Boleto } from './entities/boleto.entity';
import { NotificacionChofer } from './entities/notificacion.entity';
import { Liquidacion } from './entities/liquidacion.entity';
import { Pasaje } from '../pasajes/pasaje.entity';
import { Review } from '../reviews/review.entity';
import { Usuario } from '../auth/usuario.entity';
import { FlotaGateway } from '../flota/flota.gateway';

const NOMBRES_PARADAS: Record<string, string> = {
  cochabamba: 'Cochabamba',
  eterazama: 'Eterazama',
};

@Injectable()
export class ChoferService {

  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,

    private readonly flotaGateway: FlotaGateway,

    @InjectRepository(Viaje)
    private readonly viajeRepo: Repository<Viaje>,

    @InjectRepository(Boleto)
    private readonly boletoRepo: Repository<Boleto>,

    @InjectRepository(NotificacionChofer)
    private readonly notificacionRepo: Repository<NotificacionChofer>,

    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,

    @InjectRepository(Pasaje)
    private readonly pasajeRepo: Repository<Pasaje>,

    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,

    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}


  // =============================================
  // 1. INICIO - Dashboard del chofer
  // =============================================

  async obtenerInicio(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const placa = usuario.placaAsignada;
    if (!placa) {
      return {
        nombre: usuario.nombre || usuario.nombreUsuario,
        vehiculo: null,
        placa: null,
        paradaActual: null,
        puestoFila: null,
        estadoVehiculo: null,
        estadoViaje: null,
        pasajerosCount: 0,
        asientosOcupados: 0,
        asientosDisponibles: 0,
        calificacionPromedio: 0,
      };
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa },
    });

    const pasajes = await this.pasajeRepo.find({
      where: { placaVehiculo: placa },
    });

    const reviews = await this.reviewRepo.find({
      where: { vehiculoId: vehiculo?.id || 0 },
    });

    const promedio = reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + r.estrellas, 0) / reviews.length).toFixed(2))
      : 0;

    return {
      nombre: usuario.nombre || usuario.nombreUsuario,
      vehiculo: vehiculo ? `${vehiculo.tipoVehiculo} ${vehiculo.color}` : null,
      placa,
      paradaActual: vehiculo?.paradaActual || null,
      puestoFila: vehiculo?.puestoFila || null,
      estadoVehiculo: vehiculo?.estadoVehiculo || 'inactivo',
      estadoViaje: vehiculo?.estadoViaje || 'listo',
      pasajerosCount: pasajes.length,
      asientosOcupados: vehiculo?.asientosOcupados?.length || 0,
      asientosDisponibles: (vehiculo?.capacidadTotal || 12) - 2 - (vehiculo?.asientosOcupados?.length || 0),
      calificacionPromedio: promedio,
    };
  }


  // =============================================
  // 2. MI VEHICULO
  // =============================================

  async obtenerMiVehiculo(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    const capacidad = Math.max(4, vehiculo.capacidadTotal || 12);
    const ocupadosTotal = (vehiculo.asientosOcupados || []).filter(
      (a) => a >= 3 && a <= capacidad,
    ).length;

    // Informacion real de pasajeros por asiento (misma fuente que Secretaria:
    // la tabla pasajes de PostgreSQL). Sin datos privados innecesarios.
    const pasajes = await this.pasajeRepo.find({
      where: { placaVehiculo: vehiculo.placa },
    });

    const pasajerosPorAsiento: Record<number, {
      pasajeroNombre: string;
      estadoPasaje: string;
    }> = {};

    pasajes.forEach((p) => {
      const asientos = p.asientos || [];
      const estadoPasaje =
        p.estadoReembolso === 'REEMBOLSADO'
          ? 'reembolsado'
          : p.estadoReembolso === 'PENDIENTE'
            ? 'pendiente de reembolso'
            : 'comprado';

      asientos.forEach((num) => {
        if (!pasajerosPorAsiento[num]) {
          pasajerosPorAsiento[num] = {
            pasajeroNombre: p.pasajeroNombre || '',
            estadoPasaje,
          };
        }
      });

      // Si el pasaje trae la lista detallada de pasajeros por asiento, usarla
      if (Array.isArray(p.pasajeros)) {
        p.pasajeros.forEach((pj: { asiento?: number; nombre?: string }) => {
          if (pj?.asiento != null) {
            pasajerosPorAsiento[pj.asiento] = {
              pasajeroNombre: pj.nombre || p.pasajeroNombre || '',
              estadoPasaje,
            };
          }
        });
      }
    });

    const mapaAsientos: {
      numero: number;
      estado: string;
      pasajero: string | null;
      estadoPasaje: string | null;
    }[] = [];

    for (let i = 1; i <= capacidad; i++) {
      // Asientos 1-2 siempre son del chofer (regla compartida con Secretaria)
      if (i <= 2) {
        mapaAsientos.push({ numero: i, estado: 'chofer', pasajero: null, estadoPasaje: null });
        continue;
      }
      const ocupado = (vehiculo.asientosOcupados || []).includes(i);
      if (ocupado) {
        const info = pasajerosPorAsiento[i];
        mapaAsientos.push({
          numero: i,
          estado: 'ocupado',
          pasajero: info?.pasajeroNombre || null,
          estadoPasaje: info?.estadoPasaje || null,
        });
      } else {
        mapaAsientos.push({ numero: i, estado: 'disponible', pasajero: null, estadoPasaje: null });
      }
    }

    return {
      id: vehiculo.id,
      placa: vehiculo.placa,
      tipoVehiculo: vehiculo.tipoVehiculo,
      choferNombre: vehiculo.choferNombre,
      choferCi: vehiculo.choferCi,
      color: vehiculo.color,
      capacidadTotal: capacidad,
      estadoVehiculo: vehiculo.estadoVehiculo,
      estadoViaje: vehiculo.estadoViaje,
      qrImagenUrl: vehiculo.qrImagenUrl,
      paradaActual: vehiculo.paradaActual,
      puestoFila: vehiculo.puestoFila,
      horaIngresoFila: vehiculo.horaIngresoFila,
      fechaEstado: vehiculo.fechaEstado,
      asientosOcupados: vehiculo.asientosOcupados,
      ocupadosTotal: ocupadosTotal,
      asientosLibres: Math.max(0, capacidad - 2 - ocupadosTotal),
      mapaAsientos,
    };
  }


  // =============================================
  // 3. MI FILA
  // =============================================

  async obtenerMiFila(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    const todosVehiculos = await this.vehiculoRepo.find({
      order: { puestoFila: 'ASC' },
    });

    const resumir = (lista: Vehiculo[]) => lista.map(v => ({
      placa: v.placa,
      tipoVehiculo: v.tipoVehiculo,
      color: v.color,
      puestoFila: v.puestoFila,
      choferNombre: v.choferNombre,
      choferCi: v.choferCi,
      estado: v.estadoVehiculo,
      horaIngresoFila: v.horaIngresoFila,
    }));

    const cochabamba = resumir(todosVehiculos.filter(v => v.paradaActual === 'cochabamba'));
    const eterazama = resumir(todosVehiculos.filter(v => v.paradaActual === 'eterazama'));
    const enRuta = resumir(todosVehiculos.filter(v => v.paradaActual === 'en_ruta'));
    const fueraDeFila = resumir(todosVehiculos.filter(v => v.paradaActual === 'fuera_de_fila'));

    const miFila = todosVehiculos
      .filter(v => v.paradaActual === vehiculo.paradaActual && (vehiculo.paradaActual === 'cochabamba' || vehiculo.paradaActual === 'eterazama'))
      .map(v => v.placa);

    const miPosicion = miFila.indexOf(vehiculo.placa);

    return {
      paradaActual: vehiculo.paradaActual,
      yaRegistrado: vehiculo.paradaActual === 'cochabamba' || vehiculo.paradaActual === 'eterazama',
      miPuesto: vehiculo.puestoFila,
      posicionEnFila: miPosicion >= 0 ? miPosicion + 1 : 0,
      totalEnFila: vehiculo.paradaActual === 'cochabamba' ? cochabamba.length : eterazama.length,
      estadoVehiculo: vehiculo.estadoVehiculo,
      estadoViaje: vehiculo.estadoViaje,
      cochabamba,
      eterazama,
      enRuta,
      fueraDeFila,
      delante: miPosicion > 0 ? cochabamba.concat(eterazama).slice(0, miPosicion) : [],
      detras: miPosicion >= 0 ? cochabamba.concat(eterazama).slice(miPosicion + 1) : [],
    };
  }

  async anotarseEnFila(choferId: string, parada: string) {
    const paradas = ['cochabamba', 'eterazama'];
    if (!paradas.includes(parada)) {
      throw new BadRequestException('Parada no valida. Debe ser cochabamba o eterazama');
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    if (vehiculo.estadoVehiculo !== 'activo') {
      throw new BadRequestException('El vehiculo se encuentra inactivo y no puede anotarse en la fila');
    }

    if (vehiculo.estadoViaje === 'mantenimiento') {
      throw new BadRequestException('El vehiculo se encuentra en mantenimiento y no puede anotarse en la fila');
    }

    if (vehiculo.estadoViaje === 'en_ruta') {
      throw new BadRequestException('El vehiculo se encuentra EN RUTA y no puede anotarse en la fila hasta que termine el recorrido');
    }

    const nombreParada = parada === 'cochabamba' ? 'Cochabamba' : 'Eterazama';

    if (vehiculo.paradaActual === parada) {
      throw new BadRequestException(`Ya estas registrado en la fila de ${nombreParada}.`);
    }

    if (vehiculo.paradaActual === 'cochabamba' || vehiculo.paradaActual === 'eterazama') {
      const otra = vehiculo.paradaActual === 'cochabamba' ? 'Cochabamba' : 'Eterazama';
      throw new BadRequestException(
        `Ya estas registrado en la fila de ${otra}. Solo puedes estar anotado en una fila a la vez. Sal de esa fila primero.`,
      );
    }

    const mismaParada = await this.vehiculoRepo.find({
      where: { paradaActual: parada },
      order: { puestoFila: 'ASC' },
    });

    const nuevoPuesto = mismaParada.length > 0
      ? Math.max(...mismaParada.map(v => v.puestoFila || 0)) + 1
      : 1;

    vehiculo.paradaActual = parada;
    vehiculo.puestoFila = nuevoPuesto;
    vehiculo.estadoViaje = 'listo';
    vehiculo.estadoVehiculo = 'activo';
    vehiculo.horaIngresoFila = new Date();
    await this.vehiculoRepo.save(vehiculo);

    await this.reindexarFila(parada);
    await this.iniciarNuevoViaje(vehiculo, parada);
    this.flotaGateway.notificarCambioFlota();

    return {
      paradaActual: vehiculo.paradaActual,
      puestoFila: vehiculo.puestoFila,
      horaIngresoFila: vehiculo.horaIngresoFila,
      mensaje: `Te anotaste en la fila de ${nombreParada}, puesto #${nuevoPuesto}`,
    };
  }

  // Al anotarse en la fila se inicia un nuevo viaje con los asientos de
  // pasajeros nuevamente disponibles (los 2 asientos del chofer se reservan).
  // No se elimina ni modifica el historial de viajes/pasajes anteriores.
  private async iniciarNuevoViaje(vehiculo: Vehiculo, parada: string) {
    const viajeAbierto = await this.viajeRepo.findOne({
      where: { placaVehiculo: vehiculo.placa },
      order: { fechaCreacion: 'DESC' },
    });

    if (viajeAbierto && (viajeAbierto.estado === 'programado' || viajeAbierto.estado === 'en_ruta')) {
      return;
    }

    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const hora = hoy.toTimeString().slice(0, 8);

    const origen = NOMBRES_PARADAS[parada] || 'Cochabamba';
    const destino = parada === 'cochabamba'
      ? NOMBRES_PARADAS['eterazama']
      : NOMBRES_PARADAS['cochabamba'];

    const nuevoViaje = this.viajeRepo.create({
      placaVehiculo: vehiculo.placa,
      choferNombre: vehiculo.choferNombre,
      origen,
      destino,
      fecha: `${anio}-${mes}-${dia}`,
      horaSalida: hora,
      estado: 'programado',
      asientosOcupados: 0,
      capacidadTotal: vehiculo.capacidadTotal,
      totalGenerado: 0,
      pasajerosTransportados: 0,
    });

    await this.viajeRepo.save(nuevoViaje);
  }

  async salirDeFila(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    if (vehiculo.paradaActual !== 'cochabamba' && vehiculo.paradaActual !== 'eterazama') {
      throw new BadRequestException('No estas registrado en ninguna fila');
    }

    const paradaSalida = vehiculo.paradaActual;

    vehiculo.paradaActual = 'fuera_de_fila';
    vehiculo.puestoFila = 0;
    vehiculo.horaIngresoFila = null;
    vehiculo.estadoViaje = 'listo';
    await this.vehiculoRepo.save(vehiculo);

    await this.reindexarFila(paradaSalida);
    this.flotaGateway.notificarCambioFlota();

    return {
      paradaActual: vehiculo.paradaActual,
      mensaje: 'Saliste de la fila correctamente. Los puestos se reorganizaron.',
    };
  }

  private async reindexarFila(parada: string) {
    const fila = await this.vehiculoRepo.find({
      where: { paradaActual: parada },
      order: { puestoFila: 'ASC', id: 'ASC' },
    });

    for (let i = 0; i < fila.length; i++) {
      const puestoEsperado = i + 1;
      if (fila[i].puestoFila !== puestoEsperado) {
        fila[i].puestoFila = puestoEsperado;
        await this.vehiculoRepo.save(fila[i]);
      }
    }
  }


  // =============================================
  // 4. MI VIAJE
  // =============================================

  async obtenerMiViaje(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const viaje = await this.viajeRepo.findOne({
      where: {
        placaVehiculo: usuario.placaAsignada,
        estado: Between('programado', 'en_ruta') as any,
      },
      order: { fechaCreacion: 'DESC' },
    });

    if (!viaje) {
      const ultimoViaje = await this.viajeRepo.findOne({
        where: { placaVehiculo: usuario.placaAsignada },
        order: { fechaCreacion: 'DESC' },
      });
      return ultimoViaje || null;
    }

    const boletos = await this.boletoRepo.find({
      where: { viajeId: viaje.id },
    });

    return {
      ...viaje,
      pasajerosRegistrados: boletos.length,
      asientosOcupados: boletos.length,
      asientosDisponibles: viaje.capacidadTotal - boletos.length,
    };
  }

  async iniciarViaje(choferId: string, viajeId: string) {
    const viaje = await this.viajeRepo.findOne({
      where: { id: viajeId },
    });

    if (!viaje) {
      throw new NotFoundException('Viaje no encontrado');
    }

    viaje.estado = 'en_ruta';
    viaje.horaSalida = new Date().toTimeString().slice(0, 5);
    await this.viajeRepo.save(viaje);

    await this.crearNotificacion(choferId, 'viaje', 'Viaje iniciado', 'Su viaje ha comenzado. Estado: En ruta.');

    return viaje;
  }

  async finalizarViaje(choferId: string, viajeId: string) {
    const viaje = await this.viajeRepo.findOne({
      where: { id: viajeId },
    });

    if (!viaje) {
      throw new NotFoundException('Viaje no encontrado');
    }

    viaje.estado = 'finalizado';
    viaje.horaLlegada = new Date().toTimeString().slice(0, 5);
    await this.viajeRepo.save(viaje);

    const boletos = await this.boletoRepo.find({
      where: { viajeId: viaje.id },
    });

    viaje.pasajerosTransportados = boletos.length;
    viaje.totalGenerado = boletos.reduce((acc, b) => acc + Number(b.monto), 0);
    await this.viajeRepo.save(viaje);

    await this.crearNotificacion(choferId, 'viaje', 'Viaje finalizado', `Viaje finalizado. ${boletos.length} pasajeros transportados.`);

    return viaje;
  }


  // =============================================
  // 5. MIS PASAJEROS
  // =============================================

  async obtenerMisPasajeros(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const viaje = await this.viajeRepo.findOne({
      where: { placaVehiculo: usuario.placaAsignada },
      order: { fechaCreacion: 'DESC' },
    });

    if (!viaje) {
      return [];
    }

    const boletos = await this.boletoRepo.find({
      where: { viajeId: viaje.id },
      order: { asiento: 'ASC' },
    });

    return boletos.map(b => ({
      id: b.id,
      pasajeroNombre: b.pasajeroNombre,
      asiento: b.asiento,
      destino: b.destino,
      estadoBoleto: b.estadoBoleto,
      estadoPago: b.estadoPago,
      escaneado: b.escaneado,
    }));
  }

  async confirmarAbordaje(choferId: string, boletoId: string) {
    const boleto = await this.boletoRepo.findOne({
      where: { id: boletoId },
    });

    if (!boleto) {
      throw new NotFoundException('Boleto no encontrado');
    }

    boleto.estadoBoleto = 'abordado';
    boleto.escaneado = true;
    await this.boletoRepo.save(boleto);

    return boleto;
  }

  async marcarNoPresentado(choferId: string, boletoId: string) {
    const boleto = await this.boletoRepo.findOne({
      where: { id: boletoId },
    });

    if (!boleto) {
      throw new NotFoundException('Boleto no encontrado');
    }

    boleto.estadoBoleto = 'no_presentado';
    await this.boletoRepo.save(boleto);

    return boleto;
  }


  // =============================================
  // 6. CONTROL DE ASIENTOS
  // =============================================

  async obtenerMapaAsientos(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    const viaje = await this.viajeRepo.findOne({
      where: { placaVehiculo: usuario.placaAsignada },
      order: { fechaCreacion: 'DESC' },
    });

    const boletos = viaje
      ? await this.boletoRepo.find({ where: { viajeId: viaje.id } })
      : [];

    const asientos: { numero: number; estado: string; pasajero: string | null; destino: string | null }[] = [];
    for (let i = 1; i <= vehiculo.capacidadTotal; i++) {
      const boleto = boletos.find(b => b.asiento === i);
      let estado = 'disponible';
      if (boleto) {
        if (boleto.estadoBoleto === 'abordado') estado = 'abordado';
        else if (boleto.estadoPago === 'pagado') estado = 'pagado';
        else estado = 'reservado';
      }

      asientos.push({
        numero: i,
        estado,
        pasajero: boleto?.pasajeroNombre || null,
        destino: boleto?.destino || null,
      });
    }

    return {
      placa: vehiculo.placa,
      capacidadTotal: vehiculo.capacidadTotal,
      asientos,
      disponibles: asientos.filter(a => a.estado === 'disponible').length,
      reservados: asientos.filter(a => a.estado === 'reservado').length,
      pagados: asientos.filter(a => a.estado === 'pagado').length,
      abordados: asientos.filter(a => a.estado === 'abordado').length,
    };
  }

  async ventaManual(choferId: string, data: {
    pasajeroNombre: string;
    asiento: number;
    origen: string;
    destino: string;
    monto: number;
    montoEncomienda?: number;
    contactoRecibo?: string;
  }) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const viaje = await this.viajeRepo.findOne({
      where: {
        placaVehiculo: usuario.placaAsignada,
      },
      order: { fechaCreacion: 'DESC' },
    });

    if (!viaje) {
      throw new BadRequestException('No hay viaje activo para vender pasajes');
    }

    const existente = await this.boletoRepo.findOne({
      where: {
        viajeId: viaje.id,
        asiento: data.asiento,
      },
    });

    if (existente) {
      throw new BadRequestException(`El asiento ${data.asiento} ya esta ocupado`);
    }

    const boleto = this.boletoRepo.create({
      pasajeroNombre: data.pasajeroNombre,
      pasajeroTelefono: data.contactoRecibo,
      placaVehiculo: usuario.placaAsignada,
      viajeId: viaje.id,
      asiento: data.asiento,
      origen: data.origen,
      destino: data.destino,
      monto: data.monto,
      estadoBoleto: 'abordado',
      estadoPago: 'pagado',
      escaneado: true,
      contactoRecibo: data.contactoRecibo,
    });

    await this.boletoRepo.save(boleto);

    const pasaje = this.pasajeRepo.create({
      pasajeroNombre: data.pasajeroNombre,
      placaVehiculo: usuario.placaAsignada,
      asientos: [data.asiento],
      montoAsientos: data.monto,
      montoEncomienda: data.montoEncomienda || 0,
      montoTotal: data.monto + (data.montoEncomienda || 0),
      tramo: `${data.origen} -> ${data.destino}`,
      contactoRecibo: data.contactoRecibo,
    });

    await this.pasajeRepo.save(pasaje);

    viaje.asientosOcupados = viaje.asientosOcupados + 1;
    viaje.totalGenerado = Number(viaje.totalGenerado) + data.monto + (data.montoEncomienda || 0);
    viaje.pasajerosTransportados = viaje.pasajerosTransportados + 1;
    await this.viajeRepo.save(viaje);

    if (usuario.placaAsignada) {
      const vehiculo = await this.vehiculoRepo.findOne({
        where: { placa: usuario.placaAsignada },
      });
      if (vehiculo) {
        const nuevos = Array.from(new Set([...vehiculo.asientosOcupados, data.asiento]));
        vehiculo.asientosOcupados = nuevos;
        await this.vehiculoRepo.save(vehiculo);
      }
    }

    return boleto;
  }


  // =============================================
  // 7. VALIDACION QR
  // =============================================

  async validarBoletoQR(choferId: string, codigoQR: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    let boleto = await this.boletoRepo.findOne({
      where: { codigoQR },
    });

    if (!boleto) {
      const boletos = await this.boletoRepo.find();
      const encontrado = boletos.find(b => b.id === codigoQR || b.id.substring(0, 8) === codigoQR);
      if (encontrado) boleto = encontrado;
    }

    if (!boleto) {
      throw new NotFoundException('Boleto no encontrado en el sistema');
    }

    if (boleto.escaneado) {
      throw new BadRequestException('Este boleto ya fue utilizado. No puede escanearse dos veces.');
    }

    if (boleto.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException(`Este boleto corresponde al vehiculo ${boleto.placaVehiculo}, no al suyo (${usuario.placaAsignada})`);
    }

    return {
      valido: true,
      boleto: {
        id: boleto.id,
        pasajeroNombre: boleto.pasajeroNombre,
        asiento: boleto.asiento,
        origen: boleto.origen,
        destino: boleto.destino,
        monto: boleto.monto,
        estadoPago: boleto.estadoPago,
        estadoBoleto: boleto.estadoBoleto,
      },
    };
  }

  async confirmarAbordajeQR(choferId: string, boletoId: string) {
    const boleto = await this.boletoRepo.findOne({
      where: { id: boletoId },
    });

    if (!boleto) {
      throw new NotFoundException('Boleto no encontrado');
    }

    if (boleto.escaneado) {
      throw new BadRequestException('Este boleto ya fue utilizado');
    }

    if (boleto.estadoPago !== 'pagado') {
      throw new BadRequestException('El boleto no esta pagado');
    }

    boleto.escaneado = true;
    boleto.estadoBoleto = 'abordado';
    await this.boletoRepo.save(boleto);

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: boleto.placaVehiculo },
    });
    if (vehiculo) {
      const nuevos = Array.from(new Set([...vehiculo.asientosOcupados, boleto.asiento]));
      vehiculo.asientosOcupados = nuevos;
      await this.vehiculoRepo.save(vehiculo);
    }

    return { success: true, mensaje: 'Abordaje confirmado correctamente' };
  }


  // =============================================
  // 7.1 VALIDACION DE BOLETO POR CODIGO DE BARRAS (boleteria / pasaje)
  // =============================================
  //
  // Valida un boleto de boleteria (entidad Pasaje) contra la base de datos
  // usando su codigo de barras unico. Devuelve un estado tipificado para que
  // el frontend muestre el color correcto:
  //   valido      -> verde
  //   utilizado   -> naranja
  //   reembolsado -> rojo
  //   cancelado   -> rojo
  //   inexistente -> rojo
  //   otro_vehiculo -> rojo
  //

  async validarBoletoPorBarras(choferId: string, codigoBarras: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const codigo = String(codigoBarras || '').trim();
    if (!codigo) {
      return { estado: 'inexistente', mensaje: 'Código de barras vacío.' };
    }

    let pasaje = await this.pasajeRepo.findOne({
      where: { codigoBarras: codigo },
    });

    if (!pasaje) {
      pasaje = await this.pasajeRepo.findOne({
        where: { codigo },
      });
    }

    if (!pasaje) {
      const todos = await this.pasajeRepo.find();
      const porId = todos.find(
        (p) =>
          p.id === codigo ||
          p.id.substring(0, 8).toUpperCase() === codigo.toUpperCase(),
      );
      if (porId) pasaje = porId;
    }

    if (!pasaje) {
      return {
        estado: 'inexistente',
        mensaje: 'Boleto no encontrado. Verifique el código de barras.',
      };
    }

    if (pasaje.placaVehiculo !== usuario.placaAsignada) {
      return {
        estado: 'otro_vehiculo',
        mensaje: `Este boleto corresponde al vehículo ${pasaje.placaVehiculo}, no al suyo (${usuario.placaAsignada}).`,
      };
    }

    if (
      pasaje.estadoBoleto === 'REEMBOLSADO' ||
      pasaje.estadoReembolso === 'REEMBOLSADO'
    ) {
      return {
        estado: 'reembolsado',
        mensaje: 'Este boleto fue cancelado o reembolsado. Ya no es válido.',
      };
    }

    if (pasaje.estadoBoleto === 'CANCELADO') {
      return {
        estado: 'cancelado',
        mensaje: 'Este boleto fue cancelado. Ya no es válido.',
      };
    }

    if (pasaje.estadoBoleto === 'UTILIZADO' || pasaje.fechaEscaneo) {
      return {
        estado: 'utilizado',
        mensaje: 'Este boleto ya fue utilizado. No puede usarse nuevamente.',
      };
    }

    return {
      estado: 'valido',
      mensaje: 'Boleto válido.',
      boleto: {
        id: pasaje.id,
        codigo: pasaje.codigo,
        pasajeroNombre: pasaje.pasajeroNombre,
        asientos: pasaje.asientos,
        origen: pasaje.origen,
        destino: pasaje.destino,
        estadoBoleto: pasaje.estadoBoleto,
      },
    };
  }

  async confirmarBoletoUtilizado(choferId: string, pasajeId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const pasaje = await this.pasajeRepo.findOne({
      where: { id: pasajeId },
    });

    if (!pasaje) {
      throw new NotFoundException('Boleto no encontrado');
    }

    if (pasaje.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException('Este boleto no corresponde a su vehículo.');
    }

    if (pasaje.estadoBoleto === 'UTILIZADO' || pasaje.fechaEscaneo) {
      throw new BadRequestException('Este boleto ya fue utilizado.');
    }

    if (
      pasaje.estadoBoleto === 'REEMBOLSADO' ||
      pasaje.estadoReembolso === 'REEMBOLSADO' ||
      pasaje.estadoBoleto === 'CANCELADO'
    ) {
      throw new BadRequestException(
        'Este boleto fue cancelado o reembolsado. No puede utilizarse.',
      );
    }

    pasaje.estadoBoleto = 'UTILIZADO';
    pasaje.fechaEscaneo = new Date();
    pasaje.escaneadoPor = usuario.nombreUsuario || usuario.id;

    await this.pasajeRepo.save(pasaje);
    this.flotaGateway.notificarCambioFlota();

    return {
      success: true,
      mensaje: 'Boleto marcado como utilizado correctamente.',
    };
  }


  // =============================================
  // 8. ESTADO DEL VEHICULO (trufi) Y DEL VIAJE
  // =============================================
  //
  // Estado del trufi  -> estadoVehiculo : RESERVADO PARA 'activo' | 'inactivo'
  // Estado del viaje  -> estadoViaje    : 'en_ruta' | 'fin_de_ruta' | 'mantenimiento'
  //
  // Ambos estados son independientes y NO deben mezclarse.

  // 8.1 ESTADO DEL TRUFI (operativo): ACTIVO / INACTIVO
  async cambiarEstadoVehiculo(choferId: string, nuevoEstado: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const estadosValidos = ['activo', 'inactivo'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new BadRequestException('Estado del trufi no valido');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    vehiculo.estadoVehiculo = nuevoEstado;

    if (nuevoEstado === 'inactivo') {
      await this.sacarDeFila(vehiculo);
    }

    // ACTIVO deja el vehiculo listo para operar: saca del estado de
    // mantenimiento y devuelve los asientos de pasajeros disponibles.
    if (nuevoEstado === 'activo') {
      vehiculo.estadoViaje = 'listo';
    }

    vehiculo.fechaEstado = new Date();
    await this.vehiculoRepo.save(vehiculo);

    this.flotaGateway.notificarCambioFlota();

    await this.crearNotificacion(
      choferId,
      'estado_vehiculo',
      'Estado del trufi actualizado',
      nuevoEstado === 'activo'
        ? 'Su trufi volvio a estar ACTIVO y queda disponible para operar.'
        : 'Su trufi quedo INACTIVO. No podra anotarse en ninguna fila mientras permanezca inactivo.',
    );

    return {
      estadoVehiculo: vehiculo.estadoVehiculo,
      estadoViaje: vehiculo.estadoViaje,
      paradaActual: vehiculo.paradaActual,
      fechaEstado: vehiculo.fechaEstado,
    };
  }

  // 8.2 ESTADO DEL VIAJE: EN RUTA / FIN DE LA RUTA / MANTENIMIENTO
  async cambiarEstadoViaje(choferId: string, nuevoEstado: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const estadosValidos = ['en_ruta', 'fin_de_ruta', 'mantenimiento'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new BadRequestException('Estado del viaje no valido');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    const viaje = await this.viajeRepo.findOne({
      where: { placaVehiculo: usuario.placaAsignada },
      order: { fechaCreacion: 'DESC' },
    });

    vehiculo.estadoViaje = nuevoEstado;

    if (nuevoEstado === 'en_ruta') {
      vehiculo.estadoVehiculo = 'activo';
      if (viaje) {
        viaje.estado = 'en_ruta';
        viaje.horaSalida = viaje.horaSalida || new Date().toTimeString().slice(0, 5);
        await this.viajeRepo.save(viaje);
      }
      // Al iniciar la ruta el vehiculo sale de la fila de la parada
      await this.sacarDeFila(vehiculo);
    } else if (nuevoEstado === 'fin_de_ruta') {
      vehiculo.estadoVehiculo = 'activo';
      if (viaje) {
        viaje.estado = 'finalizado';
        viaje.horaLlegada = viaje.horaLlegada || new Date().toTimeString().slice(0, 5);
        const boletos = await this.boletoRepo.find({
          where: { viajeId: viaje.id },
        });
        viaje.pasajerosTransportados = boletos.length;
        viaje.totalGenerado = boletos.reduce((acc, b) => acc + Number(b.monto), 0);
        viaje.asientosOcupados = boletos.length;
        await this.viajeRepo.save(viaje);
      }
      // Al finalizar la ruta se liberan todos los asientos de pasajeros para
      // el siguiente viaje. Los 2 asientos del chofer quedan reservados.
      // No se elimina el historial de viajes, pasajes ni pagos anteriores.
      vehiculo.asientosOcupados = [];
    } else if (nuevoEstado === 'mantenimiento') {
      await this.sacarDeFila(vehiculo);
    }

    vehiculo.fechaEstado = new Date();
    await this.vehiculoRepo.save(vehiculo);

    this.flotaGateway.notificarCambioFlota();

    const etiquetas: Record<string, string> = {
      en_ruta: 'En ruta',
      fin_de_ruta: 'Fin de la ruta',
      mantenimiento: 'Mantenimiento',
    };

    await this.crearNotificacion(
      choferId,
      'estado_viaje',
      'Estado del viaje actualizado',
      `Estado del viaje cambiado a: ${etiquetas[nuevoEstado]}`,
    );

    return {
      estadoVehiculo: vehiculo.estadoVehiculo,
      estadoViaje: vehiculo.estadoViaje,
      paradaActual: vehiculo.paradaActual,
      fechaEstado: vehiculo.fechaEstado,
    };
  }

  private async sacarDeFila(vehiculo: Vehiculo) {
    if (vehiculo.paradaActual === 'cochabamba' || vehiculo.paradaActual === 'eterazama') {
      const paradaAnterior = vehiculo.paradaActual;
      vehiculo.paradaActual = 'fuera_de_fila';
      vehiculo.puestoFila = 0;
      vehiculo.horaIngresoFila = null;
      await this.vehiculoRepo.save(vehiculo);
      await this.reindexarFila(paradaAnterior);
    }
    return vehiculo;
  }


  // =============================================
  // 9. LIQUIDACION
  // =============================================

  async obtenerLiquidacion(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const viajes = await this.viajeRepo.find({
      where: { placaVehiculo: usuario.placaAsignada || '' },
      order: { fechaCreacion: 'DESC' },
    });

    const liquidaciones = await this.liquidacionRepo.find({
      where: { choferId },
      order: { fechaCreacion: 'DESC' },
    });

    const totalViajes = viajes.length;
    const totalPasajeros = viajes.reduce((acc, v) => acc + v.pasajerosTransportados, 0);
    const totalPasajes = viajes.reduce((acc, v) => acc + Number(v.totalGenerado), 0);

    const pasajes = await this.pasajeRepo.find({
      where: { placaVehiculo: usuario.placaAsignada || '' },
    });
    const totalEncomiendas = pasajes.reduce((acc, p) => acc + Number(p.montoEncomienda || 0), 0);

    return {
      resumen: {
        totalViajes,
        totalPasajeros,
        totalPasajes,
        totalEncomiendas,
        totalGenerado: totalPasajes + totalEncomiendas,
        montoLiquidado: liquidaciones
          .filter(l => l.estado === 'liquidado')
          .reduce((acc, l) => acc + Number(l.montoLiquidado), 0),
        estadoLiquidacion: liquidaciones.length > 0 ? liquidaciones[0].estado : 'sin datos',
      },
      liquidacionesAnteriores: liquidaciones,
    };
  }


  // =============================================
  // 10. HISTORIAL DE VIAJES
  // =============================================

  async obtenerHistorialViajes(choferId: string, filtro?: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const viajes = await this.viajeRepo.find({
      where: { placaVehiculo: usuario.placaAsignada },
      order: { fechaCreacion: 'DESC' },
    });

    if (!filtro || filtro === 'todos') {
      return viajes;
    }

    const ahora = new Date();
    let fechaInicio: Date;

    if (filtro === 'dia') {
      fechaInicio = new Date(ahora);
      fechaInicio.setHours(0, 0, 0, 0);
    } else if (filtro === 'semana') {
      fechaInicio = new Date(ahora);
      fechaInicio.setDate(fechaInicio.getDate() - 7);
    } else if (filtro === 'mes') {
      fechaInicio = new Date(ahora);
      fechaInicio.setMonth(fechaInicio.getMonth() - 1);
    } else {
      return viajes;
    }

    return viajes.filter(v => new Date(v.fechaCreacion) >= fechaInicio);
  }


  // =============================================
  // 11. MIS CALIFICACIONES
  // =============================================

  async obtenerMisCalificaciones(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    const reviews = await this.reviewRepo.find({
      where: { vehiculoId: vehiculo.id },
      order: { fechaCreacion: 'DESC' },
    });

    const promedio = reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + r.estrellas, 0) / reviews.length).toFixed(2))
      : 0;

    return {
      promedioEstrellas: promedio,
      cantidadCalificaciones: reviews.length,
      calificaciones: reviews.map(r => ({
        id: r.id,
        estrellas: r.estrellas,
        comentario: r.comentario,
        fechaCreacion: r.fechaCreacion,
      })),
    };
  }


  // =============================================
  // 12. MIS ESTADISTICAS
  // =============================================

  async obtenerMisEstadisticas(choferId: string, periodo?: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const viajes = await this.viajeRepo.find({
      where: { placaVehiculo: usuario.placaAsignada },
      order: { fechaCreacion: 'DESC' },
    });

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    let viajesFiltrados = viajes;
    if (periodo && periodo !== 'todos') {
      const ahora = new Date();
      let fechaInicio: Date;

      if (periodo === 'dia') {
        fechaInicio = new Date(ahora);
        fechaInicio.setHours(0, 0, 0, 0);
      } else if (periodo === 'semana') {
        fechaInicio = new Date(ahora);
        fechaInicio.setDate(fechaInicio.getDate() - 7);
      } else if (periodo === 'mes') {
        fechaInicio = new Date(ahora);
        fechaInicio.setMonth(fechaInicio.getMonth() - 1);
      } else {
        fechaInicio = new Date(0);
      }

      viajesFiltrados = viajes.filter(v => new Date(v.fechaCreacion) >= fechaInicio);
    }

    const totalViajes = viajesFiltrados.length;
    const totalPasajeros = viajesFiltrados.reduce((acc, v) => acc + v.pasajerosTransportados, 0);
    const promedioPasajeros = totalViajes > 0 ? Number((totalPasajeros / totalViajes).toFixed(1)) : 0;

    const reviews = await this.reviewRepo.find({
      where: { vehiculoId: vehiculo?.id || 0 },
    });

    const promedioCalificacion = reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + r.estrellas, 0) / reviews.length).toFixed(2))
      : 0;

    const graficoViajes = viajesFiltrados.map(v => ({
      fecha: v.fecha,
      viajes: 1,
      pasajeros: v.pasajerosTransportados,
      generado: Number(v.totalGenerado),
    }));

    return {
      totalViajes,
      totalPasajeros,
      promedioPasajerosPorViaje: promedioPasajeros,
      promedioCalificacion,
      cantidadResenas: reviews.length,
      graficoViajes,
    };
  }


  // =============================================
  // 13. NOTIFICACIONES
  // =============================================

  async obtenerNotificaciones(choferId: string) {
    return this.notificacionRepo.find({
      where: { choferId },
      order: { fechaCreacion: 'DESC' },
    });
  }

  async marcarNotificacionLeida(choferId: string, notificacionId: string) {
    const notificacion = await this.notificacionRepo.findOne({
      where: { id: notificacionId, choferId },
    });

    if (!notificacion) {
      throw new NotFoundException('Notificacion no encontrada');
    }

    notificacion.leida = true;
    return this.notificacionRepo.save(notificacion);
  }

  async marcarTodasLeidas(choferId: string) {
    await this.notificacionRepo.update(
      { choferId, leida: false },
      { leida: true },
    );
    return { success: true };
  }

  private async crearNotificacion(choferId: string, tipo: string, titulo: string, mensaje: string) {
    const notificacion = this.notificacionRepo.create({
      choferId,
      tipo,
      titulo,
      mensaje,
    });
    return this.notificacionRepo.save(notificacion);
  }


  // =============================================
  // 14. PERFIL
  // =============================================

  async obtenerPerfil(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      gmail: usuario.gmail,
      telefono: usuario.telefono,
      rol: usuario.rol,
      placaAsignada: usuario.placaAsignada,
      fechaRegistro: usuario.fechaRegistro,
    };
  }

  async actualizarPerfil(choferId: string, data: {
    nombre?: string;
    apellidos?: string;
    telefono?: string;
  }) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (data.nombre !== undefined) usuario.nombre = data.nombre.trim();
    if (data.apellidos !== undefined) usuario.apellidos = data.apellidos.trim();
    if (data.telefono !== undefined) {
      const telefono = data.telefono.trim();
      if (telefono) {
        const existe = await this.usuarioRepo.findOne({
          where: { telefono },
        });
        if (existe && existe.id !== choferId) {
          throw new BadRequestException('El telefono ya esta registrado en otra cuenta');
        }
      }
      usuario.telefono = telefono || null;
    }

    await this.usuarioRepo.save(usuario);

    return {
      id: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      gmail: usuario.gmail,
      telefono: usuario.telefono,
      rol: usuario.rol,
      placaAsignada: usuario.placaAsignada,
    };
  }

}
