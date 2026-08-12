import { Controller, Get, Post, Body, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PasajesService } from './pasajes.service';
import { RegistrarVentaDto } from './dto/registrar-venta.dto';
import { PdfService } from './pdf.service';

@Controller('pasajes')
export class PasajesController {
  constructor(
    private readonly pasajesService: PasajesService,
    private readonly pdfService: PdfService,
  ) {}

  @Post('venta')
  registrarVenta(@Body() body: RegistrarVentaDto) {
    return this.pasajesService.registrarVenta(body);
  }

  @Get('historial')
  obtenerHistorial() {
    return this.pasajesService.obtenerHistorial();
  }

  @Get('hoy')
  obtenerVentasDelDia() {
    return this.pasajesService.obtenerVentasDelDia();
  }

  @Get('vehiculo/:placa')
  obtenerPorPlaca(@Param('placa') placa: string) {
    return this.pasajesService.obtenerPorPlaca(placa);
  }

  @Get('caja')
  obtenerCierreCaja() {
    return this.pasajesService.obtenerCierreCaja();
  }

  @Get(':id/pdf')
  async descargarPdf(@Param('id') id: string, @Res() res: Response) {
    const pasaje = await this.pasajesService.obtenerPorId(id);
    const pdfBuffer = await this.pdfService.generarComprobantePasaje(pasaje);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=comprobante_${pasaje.id.substring(0, 8)}.pdf`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    res.end(pdfBuffer);
  }
}