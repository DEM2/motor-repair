/**
 * Conexión a PostgreSQL mediante TypeORM.
 *
 * El servicio se conecta SOLO a su propia base de datos (auth_db) con su propio usuario
 * (auth_user), que no tiene permisos sobre la base de datos del servicio de negocio.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from '../config/env';
import { User } from '../entities/User';
import { CreateUsersTable1730000000000 } from './migrations/1730000000000-CreateUsersTable';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  username: config.db.user,
  password: config.db.password,
  entities: [User],
  migrations: [CreateUsersTable1730000000000],
  // El esquema se gestiona solo con migraciones versionadas, nunca automáticamente.
  synchronize: false,
  logging: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
});
