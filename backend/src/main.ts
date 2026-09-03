import {
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import {
  ConfigService,
} from '@nestjs/config';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from './app.module';

import {
  AllExceptionsFilter,
} from './common/http-exception.filter';


async function bootstrap() {

  const app =
    await NestFactory.create(
      AppModule,
    );


  const configService =
    app.get(ConfigService);


  app.useGlobalFilters(
    new AllExceptionsFilter(),
  );


  app.useGlobalPipes(
    new ValidationPipe({

      whitelist: true,

      forbidNonWhitelisted: true,

      transform: true,

      transformOptions: {
        enableImplicitConversion: true,
      },

    }),
  );


  // CORS PARA DESARROLLO FRONTEND + BACKEND
  app.enableCors({

    origin: true,

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],

  });



  const swaggerConfig =
    new DocumentBuilder()

      .setTitle(
        'API Trans Eterazama',
      )

      .setDescription(
        'Sistema de Gestión de Flota, Boletería y Caja del Sindicato Trans Eterazama',
      )

      .setVersion(
        '1.0',
      )

      .addBearerAuth()

      .build();



  const document =
    SwaggerModule.createDocument(
      app,
      swaggerConfig,
    );


  SwaggerModule.setup(
    'api',
    app,
    document,
  );



  const port =
    configService.get<number>(
      'PORT',
    ) || 3000;



  await app.listen(
    port,
  );


  console.log(
    `🚀 Backend Trans Eterazama: http://localhost:${port}`,
  );


  console.log(
    `📄 Swagger: http://localhost:${port}/api`,
  );

}


bootstrap();