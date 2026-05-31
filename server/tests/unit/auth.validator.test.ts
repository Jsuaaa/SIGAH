/**
 * tests/unit/auth.validator.test.ts
 * Tests unitarios de las reglas de validación del módulo Auth.
 * Sin dependencias de BD — se ejecuta la validation chain contra un mock de req.
 * Cubre: HU-03 CA3 (min 8 chars password), HU-01 CA1 (name requerido),
 *        RF-01 (roles válidos del PDF).
 */

import { validationResult } from 'express-validator';
import type { Request } from 'express';
import { ValidationChain } from 'express-validator';
import {
  loginRules,
  registerRules,
  changePasswordRules,
  resetPasswordRules,
  updateUserRules,
} from '../../src/validators/auth.validator';

// ---------------------------------------------------------------------------
// Helper: ejecuta la validation chain y retorna los errores
// ---------------------------------------------------------------------------

async function runValidation(
  rules: ValidationChain[],
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
): Promise<string[]> {
  // Construye un req mínimo que express-validator pueda procesar
  const req = {
    body,
    params,
    query: {},
    headers: {},
    cookies: {},
    get: (name: string) => {
      const headers: Record<string, string> = {};
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;

  for (const rule of rules) {
    await rule.run(req);
  }

  const errors = validationResult(req);
  return errors.array().map((e) => e.msg as string);
}

// ---------------------------------------------------------------------------
// loginRules
// ---------------------------------------------------------------------------

describe('loginRules', () => {
  it('sin errores con email + password válidos', async () => {
    const errors = await runValidation(loginRules, {
      email: 'admin@sigah.gov.co',
      password: 'miPassword123',
    });
    expect(errors).toHaveLength(0);
  });

  it('falla con email inválido', async () => {
    const errors = await runValidation(loginRules, {
      email: 'no-es-email',
      password: 'abc123',
    });
    expect(errors.some((e) => e.toLowerCase().includes('email'))).toBe(true);
  });

  it('falla con password vacío', async () => {
    const errors = await runValidation(loginRules, {
      email: 'test@example.com',
      password: '',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('falla sin campos', async () => {
    const errors = await runValidation(loginRules, {});
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// registerRules
// ---------------------------------------------------------------------------

describe('registerRules', () => {
  it('sin errores con datos completos y válidos (HU-01 CA1)', async () => {
    const errors = await runValidation(registerRules, {
      email: 'nuevo@sigah.gov.co',
      name: 'Nuevo Usuario',
      password: 'Abcdef12',
      role: 'CENSADOR',
    });
    expect(errors).toHaveLength(0);
  });

  it('falla con password menor a 8 caracteres (HU-03 CA3)', async () => {
    const errors = await runValidation(registerRules, {
      email: 'test@sigah.gov.co',
      name: 'Test',
      password: 'abc12',
      role: 'CENSADOR',
    });
    expect(errors.some((e) => e.toLowerCase().includes('8'))).toBe(true);
  });

  it('falla con name vacío (HU-01 CA1)', async () => {
    const errors = await runValidation(registerRules, {
      email: 'test@sigah.gov.co',
      name: '',
      password: 'Abcdef12',
      role: 'CENSADOR',
    });
    expect(errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
  });

  it('falla con role inválido (RF-01)', async () => {
    const errors = await runValidation(registerRules, {
      email: 'test@sigah.gov.co',
      name: 'Test',
      password: 'Abcdef12',
      role: 'SUPERADMIN',
    });
    expect(errors.some((e) => e.toLowerCase().includes('role'))).toBe(true);
  });

  it('acepta todos los roles válidos del sistema', async () => {
    const validRoles = [
      'ADMIN',
      'CENSADOR',
      'OPERADOR_ENTREGAS',
      'COORDINADOR_LOGISTICA',
      'FUNCIONARIO_CONTROL',
      'REGISTRADOR_DONACIONES',
    ];
    for (const role of validRoles) {
      const errors = await runValidation(registerRules, {
        email: 'test@sigah.gov.co',
        name: 'Test',
        password: 'Abcdef12',
        role,
      });
      expect(errors).toHaveLength(0);
    }
  });

  it('falla con email inválido', async () => {
    const errors = await runValidation(registerRules, {
      email: 'invalido',
      name: 'Test',
      password: 'Abcdef12',
      role: 'CENSADOR',
    });
    expect(errors.some((e) => e.toLowerCase().includes('email'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// changePasswordRules
// ---------------------------------------------------------------------------

describe('changePasswordRules', () => {
  it('sin errores con oldPassword + newPassword >= 8 chars', async () => {
    const errors = await runValidation(changePasswordRules, {
      oldPassword: 'oldPass123',
      newPassword: 'newPass456',
    });
    expect(errors).toHaveLength(0);
  });

  it('falla con oldPassword vacío', async () => {
    const errors = await runValidation(changePasswordRules, {
      oldPassword: '',
      newPassword: 'newPass456',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('falla con newPassword menor a 8 caracteres (HU-03 CA3)', async () => {
    const errors = await runValidation(changePasswordRules, {
      oldPassword: 'oldPass123',
      newPassword: 'abc',
    });
    expect(errors.some((e) => e.includes('8'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetPasswordRules
// ---------------------------------------------------------------------------

describe('resetPasswordRules', () => {
  it('sin errores con userId numérico positivo', async () => {
    const errors = await runValidation(resetPasswordRules, {}, { userId: '42' });
    expect(errors).toHaveLength(0);
  });

  it('falla con userId no numérico', async () => {
    const errors = await runValidation(resetPasswordRules, {}, { userId: 'abc' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('falla con userId = 0', async () => {
    const errors = await runValidation(resetPasswordRules, {}, { userId: '0' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('falla con userId negativo', async () => {
    const errors = await runValidation(resetPasswordRules, {}, { userId: '-1' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// updateUserRules (HU-01 CA1)
// ---------------------------------------------------------------------------

describe('updateUserRules', () => {
  // Casos válidos — al menos un campo presente
  it('sin errores con solo is_active', async () => {
    const errors = await runValidation(
      updateUserRules,
      { is_active: true },
      { id: '5' },
    );
    expect(errors).toHaveLength(0);
  });

  it('sin errores con solo role válido', async () => {
    const errors = await runValidation(
      updateUserRules,
      { role: 'CENSADOR' },
      { id: '5' },
    );
    expect(errors).toHaveLength(0);
  });

  it('sin errores con solo name válido', async () => {
    const errors = await runValidation(
      updateUserRules,
      { name: 'Nuevo Nombre' },
      { id: '5' },
    );
    expect(errors).toHaveLength(0);
  });

  it('sin errores con los tres campos presentes', async () => {
    const errors = await runValidation(
      updateUserRules,
      { role: 'COORDINADOR_LOGISTICA', name: 'Otro Nombre', is_active: false },
      { id: '10' },
    );
    expect(errors).toHaveLength(0);
  });

  // Casos de fallo — body vacío → 422
  it('falla si el body no trae ningún campo editable', async () => {
    const errors = await runValidation(
      updateUserRules,
      {},
      { id: '5' },
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.toLowerCase().includes('at least one'))).toBe(true);
  });

  it('falla con is_active no booleano', async () => {
    const errors = await runValidation(
      updateUserRules,
      { is_active: 'maybe' },
      { id: '5' },
    );
    expect(errors.some((e) => e.toLowerCase().includes('boolean'))).toBe(true);
  });

  it('falla con role inválido (RF-01)', async () => {
    const errors = await runValidation(
      updateUserRules,
      { role: 'SUPERADMIN' },
      { id: '5' },
    );
    expect(errors.some((e) => e.toLowerCase().includes('role'))).toBe(true);
  });

  it('falla con name demasiado corto (< 2 caracteres)', async () => {
    const errors = await runValidation(
      updateUserRules,
      { name: 'X' },
      { id: '5' },
    );
    expect(errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
  });

  it('falla con name demasiado largo (> 120 caracteres)', async () => {
    const errors = await runValidation(
      updateUserRules,
      { name: 'A'.repeat(121) },
      { id: '5' },
    );
    expect(errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
  });

  it('falla con id = 0 (no positivo)', async () => {
    const errors = await runValidation(
      updateUserRules,
      { is_active: false },
      { id: '0' },
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
