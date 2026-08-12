import { Injectable } from '@nestjs/common';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { Pasaje } from './pasaje.entity';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');

@Injectable()
export class PdfService {
  generarComprobantePasaje(pasaje: Pasaje): Promise<Buffer> {
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    const printer = new PdfPrinter(fonts);

    const docDefinition: TDocumentDefinitions = {
      defaultStyle: { font: 'Helvetica' },
      content: [
        { text: 'SINDICATO MIXTO TRANS ETERAZAMA', style: 'header', alignment: 'center' },
        { text: 'Comprobante de Viaje y Boletería Digital', style: 'subheader', alignment: 'center' },
        { text: '----------------------------------------------------------------------------------------------------', margin: [0, 10] },
        {
          columns: [
            [
              { text: `Código de Boleto: ${pasaje.id}`, bold: true },
              { text: `Pasajero: ${pasaje.pasajeroNombre}` },
              { text: `Vehículo Placa: ${pasaje.placaVehiculo}` },
              { text: `Ruta / Tramo: ${pasaje.tramo}` },
            ],
            [
              { text: `Fecha: ${new Date(pasaje.fechaCreacion).toLocaleDateString()}` },
              { text: `Hora: ${new Date(pasaje.fechaCreacion).toLocaleTimeString()}` },
              { text: `Contacto: ${pasaje.contactoRecibo || 'N/A'}` },
            ],
          ],
        },
        { text: '----------------------------------------------------------------------------------------------------', margin: [0, 10] },
        {
          table: {
            widths: ['*', 'auto', 'auto'],
            body: [
              [{ text: 'Concepto', bold: true }, { text: 'Detalle', bold: true }, { text: 'Subtotal', bold: true }],
              ['Asientos Seleccionados', `[ ${pasaje.asientos.join(', ')} ]`, `${Number(pasaje.montoAsientos).toFixed(2)} Bs`],
              ['Cargo Encomienda Extra', 'Paquete / Carga', `${Number(pasaje.montoEncomienda).toFixed(2)} Bs`],
            ],
          },
        },
        { text: '\n' },
        { text: `TOTAL CANCELADO: ${Number(pasaje.montoTotal).toFixed(2)} Bs`, style: 'total', alignment: 'right' },
        { text: '\n\n¡Gracias por viajar con Trans Eterazama!', alignment: 'center', italics: true },
      ],
      styles: {
        header: { fontSize: 16, bold: true, color: '#0369a1' },
        subheader: { fontSize: 11, color: '#475569' },
        total: { fontSize: 14, bold: true, color: '#059669' },
      },
    };

    return new Promise((resolve) => {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];

      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.end();
    });
  }
}