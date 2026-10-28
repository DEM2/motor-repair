import { durationToSeconds } from '../../src/utils/duration';
import { hashPassword, verifyPassword } from '../../src/utils/password';

describe('hash de contraseñas (bcrypt)', () => {
  it('nunca guarda la contraseña en texto plano y verifica correctamente', async () => {
    const hash = await hashPassword('Secreta123');
    expect(hash).not.toContain('Secreta123');
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword('Secreta123', hash)).resolves.toBe(true);
    await expect(verifyPassword('secreta123', hash)).resolves.toBe(false);
  });

  it('genera hashes distintos para la misma contraseña (sal aleatoria)', async () => {
    const [a, b] = await Promise.all([hashPassword('Secreta123'), hashPassword('Secreta123')]);
    expect(a).not.toBe(b);
  });
});

describe('durationToSeconds', () => {
  it.each<[string, number]>([
    ['30s', 30],
    ['15m', 900],
    ['1h', 3600],
    ['7d', 604800],
  ])('%s -> %i segundos', (input, expected) => {
    expect(durationToSeconds(input)).toBe(expected);
  });

  it('rechaza formatos inválidos', () => {
    expect(() => durationToSeconds('1 hora')).toThrow();
  });
});
