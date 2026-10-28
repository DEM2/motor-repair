#!/bin/bash
# Se ejecuta una sola vez, cuando el volumen de PostgreSQL está vacío.
# Crea una base de datos y un usuario dedicado por servicio.
# Cada usuario solo puede conectarse a SU base de datos: así se garantiza
# que ningún servicio lee las tablas internas del otro.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
  CREATE USER ${AUTH_DB_USER} WITH PASSWORD '${AUTH_DB_PASSWORD}';
  CREATE DATABASE ${AUTH_DB_NAME} OWNER ${AUTH_DB_USER};
  REVOKE ALL ON DATABASE ${AUTH_DB_NAME} FROM PUBLIC;

  CREATE USER ${BUSINESS_DB_USER} WITH PASSWORD '${BUSINESS_DB_PASSWORD}';
  CREATE DATABASE ${BUSINESS_DB_NAME} OWNER ${BUSINESS_DB_USER};
  REVOKE ALL ON DATABASE ${BUSINESS_DB_NAME} FROM PUBLIC;
EOSQL

echo "Bases de datos ${AUTH_DB_NAME} y ${BUSINESS_DB_NAME} creadas con usuarios aislados."
