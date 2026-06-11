import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SavesModule } from './saves/saves.module';

@Module({
  imports: [SavesModule],
  controllers: [HealthController],
})
export class AppModule {}
