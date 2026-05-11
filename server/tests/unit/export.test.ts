/**
 * tests/unit/export.test.ts
 * Tests unitarios para toExcel y toPdf (sin BD).
 * Verifica que las utilidades de exportación retornen Buffers válidos.
 * Cubre: HU-28 CA4 / HU-29 CA5 — export support.
 */

import { toExcel, toPdf } from '../../src/utils/export';
import type { ColumnDef } from '../../src/utils/export';

const COLUMNS: ColumnDef[] = [
  { key: 'id', header: 'ID', width: 10 },
  { key: 'name', header: 'Nombre', width: 30 },
  { key: 'score', header: 'Puntaje', width: 15 },
];

const ROWS = [
  { id: 1, name: 'Familia Pérez', score: 42.5 },
  { id: 2, name: 'Familia Gómez', score: 31.0 },
  { id: 3, name: 'Familia López', score: 55.8 },
];

// ---------------------------------------------------------------------------
// toExcel
// ---------------------------------------------------------------------------

describe('toExcel', () => {
  it('retorna un Buffer no vacío', async () => {
    const buf = await toExcel(ROWS, 'Familias', COLUMNS);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('genera un archivo .xlsx válido (magic bytes PK = ZIP)', async () => {
    const buf = await toExcel(ROWS, 'Test Sheet', COLUMNS);
    // XLSX es un ZIP: empieza con PK (0x50 0x4B)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('funciona con array vacío de filas', async () => {
    const buf = await toExcel([], 'Sin Datos', COLUMNS);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('funciona con una sola fila', async () => {
    const buf = await toExcel([ROWS[0]], 'Una Fila', COLUMNS);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it('funciona con una sola columna', async () => {
    const singleCol: ColumnDef[] = [{ key: 'id', header: 'ID' }];
    const buf = await toExcel(ROWS, 'Solo ID', singleCol);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it('maneja valores undefined/null en las filas', async () => {
    const rowsWithNulls = [
      { id: 1, name: null, score: undefined },
    ] as unknown as Record<string, unknown>[];
    const buf = await toExcel(rowsWithNulls, 'Nulls', COLUMNS);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it('retorna un Buffer diferente para distintos datasets', async () => {
    const buf1 = await toExcel(ROWS, 'Sheet1', COLUMNS);
    const buf2 = await toExcel([ROWS[0]], 'Sheet2', COLUMNS);
    // Los buffers tienen distinto tamaño (menos datos → menor archivo)
    expect(buf1.length).not.toBe(buf2.length);
  });
});

// ---------------------------------------------------------------------------
// toPdf
// ---------------------------------------------------------------------------

describe('toPdf', () => {
  it('retorna un Buffer no vacío', async () => {
    const buf = await toPdf('Reporte de Familias', ROWS, COLUMNS);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('genera un archivo PDF válido (magic bytes %PDF)', async () => {
    const buf = await toPdf('Informe', ROWS, COLUMNS);
    const header = buf.slice(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('funciona con array vacío de filas', async () => {
    const buf = await toPdf('Sin Datos', [], COLUMNS);
    expect(buf).toBeInstanceOf(Buffer);
    const header = buf.slice(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('funciona con muchas filas (paginación interna)', async () => {
    const manyRows = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Familia ${i + 1}`,
      score: Math.random() * 100,
    }));
    const buf = await toPdf('100 Familias', manyRows, COLUMNS);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(5000);
  });

  it('el buffer PDF tiene tamaño razonable (> 1KB)', async () => {
    const titulo = 'Reporte SIGAH Montería';
    const buf = await toPdf(titulo, ROWS, COLUMNS);
    // Un PDF válido con 3 filas debe pesar más de 1KB
    expect(buf.length).toBeGreaterThan(1024);
  });

  it('funciona con columnas sin width (usa default)', async () => {
    const colsSinWidth: ColumnDef[] = [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Nombre' },
    ];
    const buf = await toPdf('Test', ROWS, colsSinWidth);
    expect(buf).toBeInstanceOf(Buffer);
  });
});
