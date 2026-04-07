import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpErrorLoggingInterceptor } from './common/interceptors/http-error-logging.interceptor';

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[UncaughtException]', error);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new HttpErrorLoggingInterceptor());
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on port ${port}`);
}
bootstrap();
