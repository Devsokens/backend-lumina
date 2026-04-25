import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import {
  appConfig,
  jwtConfig,
  supabaseConfig,
  redisConfig,
  openaiConfig,
  whatsappConfig,
  throttleConfig,
} from './config';

import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { FinanceModule } from './modules/finance/finance.module';
import { RestaurantModule } from './modules/restaurant/restaurant.module';
import { ShopModule } from './modules/shop/shop.module';
import { EventsModule } from './modules/events/events.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    // ─── Configuration globale ────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
        supabaseConfig,
        redisConfig,
        openaiConfig,
        whatsappConfig,
        throttleConfig,
      ],
      envFilePath: '.env',
    }),

    // ─── Rate Limiting (anti-DDoS par organisation) ──────────
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
          limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
        },
      ],
    }),

    // ─── Cron Jobs (Module IA) ────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Event Emitter (temps réel interne) ──────────────────
    EventEmitterModule.forRoot(),

    // ─── Modules Partagés ─────────────────────────────────────
    SharedModule,

    // ─── Modules Fonctionnels ─────────────────────────────────
    AuthModule,
    OrganizationsModule,
    UsersModule,
    ProductsModule,
    FinanceModule,

    // ─── Modules Métier (Secteurs) ────────────────────────────
    RestaurantModule,
    ShopModule,
    EventsModule,

    // ─── Module IA ────────────────────────────────────────────
    AiModule,
  ],
})
export class AppModule {}
