import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('CodeScopeBootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend interactions
  app.enableCors();
  
  // Global Prefix for SaaS REST APIs
  app.setGlobalPrefix('api');
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  logger.log(`CodeScope AI Backend Server started on port: ${port}`);
}
bootstrap();
