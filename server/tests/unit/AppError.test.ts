/**
 * tests/unit/AppError.test.ts
 * Tests unitarios para la clase AppError.
 * Sin dependencias de BD — puro JS/TS.
 * Cubre: HU-03 CA1 (errores operacionales vs programáticos),
 *        convenciones de manejo de errores del proyecto.
 */

import { AppError } from '../../src/utils/AppError';

describe('AppError', () => {
  it('extiende Error', () => {
    const err = new AppError('test', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('almacena el mensaje correctamente', () => {
    const err = new AppError('Recurso no encontrado', 404);
    expect(err.message).toBe('Recurso no encontrado');
  });

  it('almacena el statusCode correctamente', () => {
    const err = new AppError('Forbidden', 403);
    expect(err.statusCode).toBe(403);
  });

  it('marca isOperational = true (error esperado de negocio)', () => {
    const err = new AppError('Entidad duplicada', 409);
    expect(err.isOperational).toBe(true);
  });

  it('captura el stack trace', () => {
    const err = new AppError('Error con stack', 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AppError');
  });

  it('funciona con statusCode 400 Bad Request', () => {
    const err = new AppError('Validación fallida', 400);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Validación fallida');
  });

  it('funciona con statusCode 422 Unprocessable Entity', () => {
    const err = new AppError('Stock insuficiente (RN-03)', 422);
    expect(err.statusCode).toBe(422);
  });

  it('funciona con statusCode 409 Conflict', () => {
    const err = new AppError('Familia ya tiene cobertura vigente (RN-02)', 409);
    expect(err.statusCode).toBe(409);
  });

  it('funciona con statusCode 401 Unauthorized', () => {
    const err = new AppError('Token inválido', 401);
    expect(err.statusCode).toBe(401);
  });

  it('funciona con statusCode 403 Forbidden', () => {
    const err = new AppError('Rol insuficiente', 403);
    expect(err.statusCode).toBe(403);
  });

  it('es instancia de AppError e instanceof funciona correctamente', () => {
    const err = new AppError('test', 500);
    // La clase extiende Error; instanceof debe reconocer ambas jerarquías
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});
