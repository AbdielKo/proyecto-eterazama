import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasajesController } from './pasajes.controller';
import { PasajesService } from './pasajes.service';
import { Pasaje } from './pasaje.entity';
import { FlotaModule } from '../flota/flota.module';
import { PdfService } from './pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pasaje]),
    FlotaModule,
  ],
  controllers: [PasajesController],
  providers: [PasajesService, PdfService],
})
export class PasajesModule {}