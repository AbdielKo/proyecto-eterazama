import { Controller, Get, Post, UseGuards, Body, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PasajesService } from './pasajes.service';
import { RegistrarVentaDto } from './dto/registrar-venta.dto';
import { SolicitarCancelacionDto } from './dto/solicitar-cancelacion.dto';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES } from '../auth/roles';

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

  // El usuario solicita cancelar su pasaje (queda PENDIENTE). No libera asiento.
  @Post(':id/cancelar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.USUARIO)
  solicitarCancelacion(
    @Param('id') id: string,
    @Body() body: SolicitarCancelacionDto,
    @Req() _req: Request,
  ) {
    return this.pasajesService.solicitarCancelacion(id, body?.motivo);
  }

  @Get('hoy')
  obtenerVentasDelDia() {
    return this.pasajesService.obtenerVentasDelDia();
  }

  @Get('vehiculo/:placa')
  obtenerPorPlaca(@Param('placa') placa: string) {
    return this.pasajesService.obtenerPorPlaca(placa);
  }

  @Get('cierre-caja')
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