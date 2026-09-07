import { Controller, Get, Post, UseGuards, Body, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PasajesService } from './pasajes.service';
import { RegistrarVentaDto } from './dto/registrar-venta.dto';
import { SolicitarCancelacionDto } from './dto/solicitar-cancelacion.dto';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES } from '../auth/roles';

@Controller('pasajes')
export class PasajesController {
  constructor(
    private readonly pasajesService: PasajesService,
    private readonly pdfService: PdfService,
  ) {}

  // Venta pública. Si el comprador está autenticado (JWT opcional), el pasaje
  // se vincula a su cuenta (req.user.userId) y se le notifica la compra.
  // El precio SIEMPRE lo calcula el backend: los montos del body se ignoran.
  @Post('venta')
  @UseGuards(OptionalJwtAuthGuard)
  registrarVenta(@Body() body: RegistrarVentaDto, @Req() req: Request) {
    return this.pasajesService.registrarVenta(
      body,
      (req.user as { userId?: string } | undefined)?.userId,
    );
  }

  // Historial protegido: los pasajeros solo ven sus propios pasajes.
  @Get('historial')
  @UseGuards(JwtAuthGuard)
  obtenerHistorial(@Req() req: Request) {
    return this.pasajesService.obtenerHistorial(
      req.user as { userId?: string; rol?: string },
    );
  }

  // Precios oficiales vigentes para mostrar el total real antes de comprar.
  @Get('precios')
  @UseGuards(JwtAuthGuard)
  obtenerPreciosOficiales() {
    return this.pasajesService.obtenerPreciosOficiales();
  }

  // El usuario solicita cancelar su pasaje (queda PENDIENTE). No libera asiento.
  @Post(':id/cancelar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.USUARIO)
  solicitarCancelacion(
    @Param('id') id: string,
    @Body() body: SolicitarCancelacionDto,
    @Req() req: Request,
  ) {
    return this.pasajesService.solicitarCancelacion(
      id,
      body?.motivo,
      (req.user as { userId?: string } | undefined)?.userId,
    );
  }

  @Get('hoy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.SECRETARIA)
  obtenerVentasDelDia(@Req() req: Request) {
    return this.pasajesService.obtenerVentasDelDia(
      req.user as { userId?: string; rol?: string },
    );
  }

  @Get('vehiculo/:placa')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.SECRETARIA, ROLES.CHOFER)
  obtenerPorPlaca(
    @Param('placa') placa: string,
    @Req() req: Request,
  ) {
    return this.pasajesService.obtenerPorPlaca(
      placa,
      req.user as { userId?: string; rol?: string },
    );
  }

  @Get('cierre-caja')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.SECRETARIA)
  obtenerCierreCaja(@Req() req: Request) {
    return this.pasajesService.obtenerCierreCaja(
      req.user as { userId?: string; rol?: string },
    );
  }

  // Comprobante PDF protegido: solo el dueño del pasaje o la Secretaría.
  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard)
  async descargarPdf(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const pasaje = await this.pasajesService.obtenerPasajeAutorizado(
      id,
      req.user as { userId?: string; rol?: string },
    );
    const pdfBuffer = await this.pdfService.generarComprobantePasaje(pasaje);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=comprobante_${pasaje.id.substring(0, 8)}.pdf`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    res.end(pdfBuffer);
  }
}