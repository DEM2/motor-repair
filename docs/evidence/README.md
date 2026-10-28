# Evidencia de ejecución

Esta carpeta guarda la evidencia que se presenta en la entrega. Para generarla:

```bash
# 1. Pruebas de cada servicio (guardan la salida en esta carpeta)
cd auth-service     && npm run test:coverage 2>&1 | tee ../docs/evidence/auth-service-tests.txt;     cd ..
cd business-service && pytest -v              2>&1 | tee ../docs/evidence/business-service-tests.txt; cd ..
cd frontend         && npm test               2>&1 | tee ../docs/evidence/frontend-tests.txt;         cd ..

# 2. Prueba de punta a punta con la plataforma levantada
docker compose up -d --build --wait
node scripts/smoke-test.mjs 2>&1 | tee docs/evidence/smoke-test.txt
```

3. **Pipeline**: en GitHub, abra *Actions → CI/CD*, entre a una ejecución en verde y guarde una captura (`pipeline.png`) que muestre los 5 jobs.

4. **Demostración de seguridad** (útil en la sustentación): en `http://localhost:8000/docs`, llame `GET /api/clients` sin token (→ 401), luego con el token del login (→ 200) y por último con el token alterado en un carácter (→ 401).
