import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Pasaje } from './pasaje.entity';
import { Configuracion } from '../secretaria/entities/configuracion.entity';
import { FlotaService } from '../flota/flota.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bwipjs = require('bwip-js');

// pdfmake 0.3.x en Node usa la API de singleton (createPdf + getBuffer).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');

pdfmake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

// Se usan solo fuentes integradas (Helvetica); no se descargan recursos externos.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => false);

const bs = (valor: string | number | null | undefined): string =>
  `Bs ${Number(valor || 0).toFixed(2)}`;

@Injectable()
export class PdfService {
  constructor(
    @InjectRepository(Configuracion)
    private readonly configRepo: Repository<Configuracion>,
    private readonly flotaService: FlotaService,
  ) {}

  async generarComprobantePasaje(pasaje: Pasaje): Promise<Buffer> {
    const cfg = await this.configRepo.findOneBy({ id: 1 });
    const empresa = cfg?.nombreSindicato || 'Sindicato Mixto Trans Eterazama';

    let vehiculoTexto = 'Vehículo';
    if (pasaje.vehiculoId) {
      try {
        const vehiculo = await this.flotaService.obtenerPorId(pasaje.vehiculoId);
        const tipo = (vehiculo.tipoVehiculo || '').trim();
        const color = (vehiculo.color || '').trim();
        vehiculoTexto = [tipo, color].filter(Boolean).join(' ') || 'Vehículo';
      } catch {
        // Si el vehículo ya no existe, se muestra solo la placa.
      }
    }

    const asientos = Array.isArray(pasaje.asientos) ? pasaje.asientos : [];
    const asientosTexto = asientos.length > 0 ? asientos.join(', ') : '-';
    const precioUnitario =
      asientos.length > 0
        ? Number(pasaje.montoAsientos || 0) / asientos.length
        : Number(pasaje.montoAsientos || 0);

    const pasajeros = Array.isArray(pasaje.pasajeros) ? pasaje.pasajeros : [];

    const filasPasajeros =
      pasajeros.length > 0
        ? pasajeros.map((p) => [
            { text: `Asiento ${p.asiento}`, alignment: 'left' } as any,
            { text: p.nombre || '-', alignment: 'left' } as any,
          ])
        : [
            [
              { text: 'Asiento', alignment: 'left' } as any,
              { text: pasaje.pasajeroNombre || '-', alignment: 'left' } as any,
            ],
          ];

    const fecha = new Date(pasaje.fechaCreacion || Date.now());

    const codigoBarras =
      pasaje.codigoBarras ||
      pasaje.codigo ||
      pasaje.id.substring(0, 8).toUpperCase();

    // Genera la imagen del codigo de barras (Code128) embebida como base64.
    // Solo codifica el codigo del boleto (sin datos personales del chofer).
    let barcodeImage: string | null = null;
    try {
      const png: Buffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: codigoBarras,
        scale: 2,
        height: 14,
        includetext: false,
      });
      barcodeImage = `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      barcodeImage = null;
    }

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [36, 36, 36, 36],
      info: {
        title: `Comprobante ${pasaje.codigo || pasaje.id}`,
        author: empresa,
        subject: 'Comprobante de Viaje y Boletería',
      },
      defaultStyle: { font: 'Helvetica', fontSize: 10, color: '#1e293b' },
      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: empresa.toUpperCase(), style: 'empresa' },
                { text: 'Comprobante de Viaje y Boletería Digital', style: 'subtitulo', margin: [0, 2, 0, 0] },
                ...((cfg?.telefono || cfg?.direccion || cfg?.email
                  ? [
                      {
                        text: [
                          ...(cfg?.telefono ? [`Tel: ${cfg.telefono}`] : []),
                          ...(cfg?.direccion ? [`Dir: ${cfg.direccion}`] : []),
                          ...(cfg?.email ? [`Email: ${cfg.email}`] : []),
                        ].join('   ·   '),
                        style: 'datoEmpresa',
                        margin: [0, 3, 0, 0],
                      },
                    ]
                  : []) as any[]),
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'COMPROBANTE', style: 'etiquetaComprobante' },
                { text: pasaje.codigo || pasaje.id.substring(0, 8).toUpperCase(), style: 'codigo', alignment: 'right' },
              ],
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 523, y2: 4, lineWidth: 2, lineColor: '#0369a1' }], margin: [0, 6, 0, 8] },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'FECHA', style: 'label' },
                { text: fecha.toLocaleDateString('es-BO'), style: 'valor', margin: [0, 1, 0, 4] },
                { text: 'HORA', style: 'label' },
                { text: fecha.toLocaleTimeString('es-BO'), style: 'valor', margin: [0, 1, 0, 0] },
              ],
            },
            {
              width: '*',
              stack: [
                { text: 'RUTA', style: 'label' },
                {
                  text: `${pasaje.origen || 'Cochabamba'}  →  ${pasaje.destino || 'Eterazama'}`,
                  style: 'valor',
                  bold: true,
                  margin: [0, 1, 0, 0],
                },
              ],
            },
            {
              width: '*',
              stack: [
                { text: 'VEHÍCULO', style: 'label' },
                { text: vehiculoTexto, style: 'valor', margin: [0, 1, 0, 2] },
                { text: 'PLACA', style: 'label' },
                { text: pasaje.placaVehiculo || '-', style: 'valor', margin: [0, 1, 0, 0] },
              ],
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 523, y2: 4, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 8, 0, 8] },
        {
          table: {
            widths: ['auto', '*'],
            body: [
              [
                { text: 'PASAJERO(S)', style: 'labelTabla' },
                { text: '', style: 'labelTabla' },
              ],
              ...filasPasajeros,
              [
                { text: 'CI (recibo)', style: 'labelFila' },
                { text: pasaje.ciRecibo || '-', style: 'valorFila' },
              ],
              [
                { text: 'Teléfono (recibo)', style: 'labelFila' },
                { text: pasaje.telefonoRecibo || '-', style: 'valorFila' },
              ],
              [
                { text: 'Asiento(s)', style: 'labelFila' },
                { text: asientosTexto, style: 'valorFila' },
              ],
              [
                { text: 'Método de pago', style: 'labelFila' },
                { text: (pasaje.metodoPago || 'EFECTIVO').toUpperCase(), style: 'valorFila' },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
        },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 523, y2: 4, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 8, 0, 8] },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Descripción', style: 'labelTabla' },
                { text: 'Monto', style: 'labelTabla', alignment: 'right' },
              ],
              [
                { text: `Pasaje(s) · ${asientos.length} asiento${asientos.length !== 1 ? 's' : ''} (Bs ${Number(precioUnitario).toFixed(2)} c/u)` },
                { text: bs(pasaje.montoAsientos), alignment: 'right' },
              ],
              [
                { text: 'Encomienda / Carga extra' },
                { text: bs(pasaje.montoEncomienda), alignment: 'right' },
              ],
              [
                { text: 'TOTAL CANCELADO', style: 'totalFila', color: '#059669' },
                { text: bs(pasaje.montoTotal), style: 'totalFila', color: '#059669', alignment: 'right' },
              ],
            ],
          },
          layout: {
            hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.5 : 0.5),
            hLineColor: () => '#cbd5e1',
            vLineWidth: () => 0,
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 5,
            paddingBottom: () => 5,
          },
        },
        { text: '\n' },
        ...(barcodeImage
          ? ([
              {
                image: barcodeImage,
                width: 360,
                height: 72,
                alignment: 'center',
                margin: [0, 6, 0, 0],
              } as any,
              {
                text: codigoBarras,
                alignment: 'center',
                fontSize: 9,
                color: '#0f172a',
                characterSpacing: 1,
                margin: [0, 2, 0, 0],
              } as any,
            ] as any[])
          : []),
        { text: `Este comprobante acredita el pago de ${bs(pasaje.montoTotal)} en ${(pasaje.metodoPago || 'EFECTIVO').toUpperCase()} por el servicio de pasaje indicado.`, style: 'nota', margin: [0, 6, 0, 0] },
        { text: `¡Gracias por viajar con ${empresa}!`, style: 'gracias', alignment: 'center', margin: [0, 12, 0, 0] },
      ],
      styles: {
        empresa: { fontSize: 14, bold: true, color: '#0369a1' },
        subtitulo: { fontSize: 10, color: '#475569' },
        datoEmpresa: { fontSize: 8, color: '#64748b' },
        etiquetaComprobante: { fontSize: 8, bold: true, color: '#64748b', characterSpacing: 1 },
        codigo: { fontSize: 14, bold: true, color: '#0f172a' },
        label: { fontSize: 8, bold: true, color: '#64748b', characterSpacing: 0.5 },
        valor: { fontSize: 10, color: '#1e293b' },
        labelTabla: { fontSize: 8, bold: true, color: '#475569', characterSpacing: 0.5 },
        labelFila: { fontSize: 9, color: '#64748b' },
        valorFila: { fontSize: 9, color: '#1e293b' },
        totalFila: { fontSize: 11, bold: true },
        nota: { fontSize: 8.5, color: '#64748b' },
        gracias: { fontSize: 10, bold: true, color: '#0369a1', italics: true },
      },
    };

    const doc = pdfmake.createPdf(docDefinition);
    return doc.getBuffer();
  }
}