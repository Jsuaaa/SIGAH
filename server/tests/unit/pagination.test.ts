/**
 * tests/unit/pagination.test.ts
 * Tests unitarios para parsePagination (sin BD).
 * Cubre: HU-28 CA5 / HU-29 CA5 — paginación de listados.
 * Valores límite: page mínimo 1, limit entre 1 y 100.
 */

import { parsePagination } from '../../src/utils/pagination';

describe('parsePagination', () => {
  it('usa defaults cuando no se pasan parámetros', () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it('parsea page y limit válidos', () => {
    const result = parsePagination({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.skip).toBe(20); // (3-1) * 10
    expect(result.take).toBe(10);
  });

  it('page mínimo es 1 aunque se pase 0 o negativo', () => {
    // parseInt('0') || DEFAULT_PAGE → DEFAULT_PAGE (1); luego Math.max(1, 1) = 1
    expect(parsePagination({ page: '0' }).page).toBe(1);
    // parseInt('-5') es -5 (truthy!); Math.max(1, -5) = 1
    expect(parsePagination({ page: '-5' }).page).toBe(1);
  });

  it('limit negativo resulta en el valor mínimo (1)', () => {
    // parseInt('-1') = -1 (truthy); Math.max(1, Math.min(100, -1)) = 1
    expect(parsePagination({ limit: '-1' }).limit).toBe(1);
  });

  it('limit = 0 usa el default porque parseInt("0") es falsy en JS', () => {
    // parseInt('0') || DEFAULT_LIMIT (20) → DEFAULT_LIMIT
    // Esto es el comportamiento real de la implementación con el patrón `|| DEFAULT`
    expect(parsePagination({ limit: '0' }).limit).toBe(20);
  });

  it('limit máximo es 100 aunque se pase valor mayor', () => {
    expect(parsePagination({ limit: '500' }).limit).toBe(100);
    expect(parsePagination({ limit: '101' }).limit).toBe(100);
  });

  it('limit = 100 es permitido (borde superior)', () => {
    expect(parsePagination({ limit: '100' }).limit).toBe(100);
  });

  it('calcula skip correctamente para varias páginas', () => {
    expect(parsePagination({ page: '1', limit: '20' }).skip).toBe(0);
    expect(parsePagination({ page: '2', limit: '20' }).skip).toBe(20);
    expect(parsePagination({ page: '5', limit: '10' }).skip).toBe(40);
    expect(parsePagination({ page: '10', limit: '5' }).skip).toBe(45);
  });

  it('maneja strings no numéricos usando el default', () => {
    const result = parsePagination({ page: 'abc', limit: 'xyz' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('maneja strings vacíos usando el default', () => {
    const result = parsePagination({ page: '', limit: '' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('take == limit (alias de conveniencia para Prisma/pg)', () => {
    const result = parsePagination({ page: '2', limit: '15' });
    expect(result.take).toBe(result.limit);
  });
});
