import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const vercelSlug = process.env.CORS_VERCEL_SLUG;
  app.enableCors({
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        origin === 'http://localhost:5173' ||
        (vercelSlug
          ? origin.includes(`${vercelSlug}.vercel.app`)  // specific team when configured
          : origin.endsWith('.vercel.app'));               // permissive fallback
      callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
    },
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
