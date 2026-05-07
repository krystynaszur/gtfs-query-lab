import { Module } from '@nestjs/common';
import { FeedsModule } from './feeds/feeds.module';

@Module({ imports: [FeedsModule] })
export class AppModule {}
