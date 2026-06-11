import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 프로토타입 단계: Vite 개발 서버(5173)에서의 호출 허용
  app.enableCors({ origin: true });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[idle-rpg server] listening on http://localhost:${port}`);
}

void bootstrap();
