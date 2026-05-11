/**
 * tests/unit/asyncHandler.test.ts
 * Tests unitarios para el wrapper asyncHandler.
 * Sin dependencias de BD — se mockean Request/Response/NextFunction.
 * Verifica que errores async se propagan a next() (patrón de errorHandler).
 */

import { asyncHandler } from '../../src/utils/asyncHandler';
import { AppError } from '../../src/utils/AppError';
import type { Request, Response, NextFunction } from 'express';

function buildMocks() {
  const req = {} as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('asyncHandler', () => {
  it('llama next() con el error cuando el handler rechaza', async () => {
    const { req, res, next } = buildMocks();
    const err = new AppError('Algo falló', 500);

    const handler = asyncHandler(async (_req, _res, _next) => {
      throw err;
    });

    handler(req, res, next);

    // Dar tiempo al microtask queue
    await new Promise(setImmediate);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('no llama next() cuando el handler resuelve normalmente', async () => {
    const { req, res, next } = buildMocks();

    const handler = asyncHandler(async (_req, _res, _next) => {
      // handler exitoso
    });

    handler(req, res, next);
    await new Promise(setImmediate);

    expect(next).not.toHaveBeenCalled();
  });

  it('propaga AppError con el statusCode original intacto', async () => {
    const { req, res, next } = buildMocks();
    const appErr = new AppError('No encontrado', 404);

    const handler = asyncHandler(async () => {
      throw appErr;
    });

    handler(req, res, next);
    await new Promise(setImmediate);

    const received = (next as jest.Mock).mock.calls[0][0] as AppError;
    expect(received.statusCode).toBe(404);
    expect(received.isOperational).toBe(true);
  });

  it('propaga Error nativo (no-AppError)', async () => {
    const { req, res, next } = buildMocks();
    const rawErr = new Error('error nativo');

    const handler = asyncHandler(async () => {
      throw rawErr;
    });

    handler(req, res, next);
    await new Promise(setImmediate);

    expect((next as jest.Mock).mock.calls[0][0]).toBe(rawErr);
  });

  it('retorna una función (middleware factory pattern)', () => {
    const handler = asyncHandler(async () => {});
    expect(typeof handler).toBe('function');
    expect(handler.length).toBe(3); // (req, res, next)
  });
});
