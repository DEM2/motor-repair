// Genera el par de llaves RSA (2048 bits) que se usa para firmar y verificar los JWT.
//
//   keys/jwt_private.pem -> SOLO auth-service (firma los tokens)
//   keys/jwt_public.pem  -> business-service (verifica los tokens)
//
// La carpeta keys/ está en .gitignore: las llaves nunca se suben al repositorio.
// Se escribe en Node (y no en bash/openssl) para que funcione igual en Windows, macOS y Linux.
//
// Uso:  node scripts/generate-keys.mjs [--force]
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const keysDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'keys');
const privatePath = join(keysDir, 'jwt_private.pem');
const publicPath = join(keysDir, 'jwt_public.pem');

if (existsSync(privatePath) && !process.argv.includes('--force')) {
  console.log(`Las llaves ya existen en ${keysDir} (usa --force para regenerarlas).`);
  process.exit(0);
}

mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// 0o600: solo el propietario puede leer la llave privada (se ignora en Windows).
writeFileSync(privatePath, privateKey, { mode: 0o600 });
writeFileSync(publicPath, publicKey, { mode: 0o644 });

console.log(`Llaves generadas en ${keysDir}`);
