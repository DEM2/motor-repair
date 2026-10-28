/**
 * Entidad User (tabla "users" en la base de datos auth_db).
 *
 * Es la ÚNICA tabla que contiene credenciales en todo el sistema. El servicio de negocio
 * nunca accede a ella: solo conoce al usuario a través de los claims del JWT.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  /** Administra usuarios y tiene acceso completo. */
  ADMIN = 'ADMIN',
  /** Personal operativo del taller: gestiona clientes, motores y órdenes. */
  OPERATOR = 'OPERATOR',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Siempre se guarda en minúsculas para que la unicidad no dependa de mayúsculas. */
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string;

  /** Hash bcrypt. `select: false` evita que se cargue por accidente en las consultas. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role', default: UserRole.OPERATOR })
  role!: UserRole;

  /** Desactivación lógica: el usuario se conserva pero no puede iniciar sesión. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/** Representación pública del usuario: nunca expone el hash de la contraseña. */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
