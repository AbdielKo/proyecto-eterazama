import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { AuthService } from './auth/auth.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('API Trans Eterazama')
    .setDescription('Sistema de Gestión de Flota, Boletería y Caja para el Sindicato Trans Eterazama')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Crear usuarios por defecto si no existen
  const authService = app.get(AuthService);
  try {
    await authService.registrar({ nombreUsuario: 'pasajero1', password: '123', rol: 'pasajero' });
  } catch (e) {}
  try {
    await authService.registrar({ nombreUsuario: 'secretaria1', password: '123', rol: 'secretaria' });
  } catch (e) {}
  try {
    await authService.registrar({ nombreUsuario: 'chofer1', password: '123', rol: 'chofer', placaAsignada: '2045-XYZ' });
  } catch (e) {}

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend de Trans Eterazama listo en http://localhost:${port}`);
  console.log(`📄 Documentación Swagger interactiva lista en http://localhost:${port}/api`);
}
bootstrap();