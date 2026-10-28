/**
 * Construcción de la aplicación Express (sin levantar el servidor).
 *
 * Separar `createApp()` de `server.ts` permite que las pruebas usen la app
 * directamente con Supertest, sin abrir un puerto real.
 */
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env';
import { AppDataSource } from './database/data-source';
import { openApiDocument } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  // Documentación interactiva (se monta antes de helmet porque Swagger UI usa estilos en línea).
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // Encabezados de seguridad HTTP y CORS restringido a los orígenes configurados.
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await AppDataSource.query('SELECT 1');
      res.json({ status: 'ok', service: 'auth-service', database: 'up' });
    } catch {
      res.status(503).json({ status: 'error', service: 'auth-service', database: 'down' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
