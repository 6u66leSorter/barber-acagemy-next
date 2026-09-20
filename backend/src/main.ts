import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.setGlobalPrefix('api')
  app.enableCors({ origin: allowedOrigins, credentials: false })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const swagger = new DocumentBuilder()
    .setTitle('MADCAP Barber Academy API')
    .setDescription('Учебный дневник MADCAP Barber Academy')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger))

  const port = Number(process.env.PORT || 8787)
  await app.listen(port, process.env.API_HOST || '0.0.0.0')
  console.log(`MADCAP API listening on http://localhost:${port}`)
}

void bootstrap()
