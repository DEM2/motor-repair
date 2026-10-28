/**
 * Migración inicial: crea la tabla de usuarios.
 *
 * Se usa SQL explícito (en lugar de `synchronize: true`) para que el esquema esté
 * versionado, sea reproducible y nunca se modifique de forma implícita en producción.
 */
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1730000000000 implements MigrationInterface {
  name = 'CreateUsersTable1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('ADMIN', 'OPERATOR')`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid         NOT NULL DEFAULT gen_random_uuid(),
        "email"         varchar(255) NOT NULL,
        "full_name"     varchar(120) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "role"          "user_role"  NOT NULL DEFAULT 'OPERATOR',
        "is_active"     boolean      NOT NULL DEFAULT true,
        "last_login_at" timestamptz  NULL,
        "created_at"    timestamptz  NOT NULL DEFAULT now(),
        "updated_at"    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
