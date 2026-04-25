import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // ─── Préfixe global de l'API ─────────────────────────────
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'api';
  app.setGlobalPrefix(apiPrefix);

  // ─── Versioning (prépare pour /api/v1/...) ───────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ─── CORS ────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://your-frontend.com'] // À configurer en production
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ─── Guards globaux (dans l'ordre d'exécution) ───────────
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new RolesGuard(reflector),
  );

  // ─── Pipe de validation global ────────────────────────────
  // Règle .antigravityrules : Aucune donnée non validée ne doit atteindre le service.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Supprime les champs non déclarés dans le DTO
      forbidNonWhitelisted: true, // Erreur si champ inconnu envoyé
      transform: true,           // Transforme automatiquement les types (string → number)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─── Filtre d'exceptions global ──────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── Intercepteur de transformation des réponses ─────────
  app.useGlobalInterceptors(new TransformInterceptor());

  // ─── Documentation Swagger ────────────────────────────────
  if (configService.get<string>('app.nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('🌟 Lumina API')
      .setDescription(
        'API du SaaS Lumina — Digitalisation des PME africaines. ' +
        'Multi-tenant | Restaurant · Magasin · Événementiel',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-Auth',
      )
      .addTag('Auth', 'Authentification et gestion des sessions')
      .addTag('Organizations', 'Gestion des organisations (tenants)')
      .addTag('Users', 'Gestion des utilisateurs et rôles')
      .addTag('Products', 'Catalogue produits et stocks')
      .addTag('Finance', 'Transactions et audit financier')
      .addTag('Restaurant - Tables', 'Gestion des tables et QR codes')
      .addTag('Restaurant - Orders', 'Commandes et cycle de vie')
      .addTag('Restaurant - Kitchen', 'Interface cuisine temps réel')
      .addTag('Shop - POS', 'Point de vente et caisse')
      .addTag('Shop - Inventory', 'Stocks et mouvements')
      .addTag('Shop - Suppliers', 'Gestion des fournisseurs')
      .addTag('Shop - Customers', 'CRM clients et fidélité')
      .addTag('Events', 'Gestion des événements')
      .addTag('Tickets', 'Billetterie et scan')
      .addTag('AI', 'Rapports IA et notifications WhatsApp')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
      },
    });
  }

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);

  console.log(`\n🚀 Lumina API démarrée sur : http://localhost:${port}/${apiPrefix}`);
  console.log(`📚 Documentation Swagger   : http://localhost:${port}/${apiPrefix}/docs\n`);
}

bootstrap();
