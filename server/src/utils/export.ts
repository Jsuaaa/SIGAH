import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface ColumnDef {
  key: string;
  header: string;
  width?: number;
}

/**
 * Converts an array of plain objects into an Excel (.xlsx) buffer.
 * HU-28 CA4 / HU-29 CA5 — export support.
 */
export async function toExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  columns: ColumnDef[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIGAH';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 20,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  rows.forEach((row) => {
    const rowData: Record<string, unknown> = {};
    columns.forEach((c) => {
      rowData[c.key] = row[c.key] ?? '';
    });
    sheet.addRow(rowData);
  });

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Converts an array of plain objects into a PDF buffer with a simple table layout.
 * HU-28 CA4 / HU-29 CA5 — export support.
 */
export function toPdf(
  title: string,
  rows: Record<string, unknown>[],
  columns: ColumnDef[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(title, { align: 'center' });
    doc.moveDown(0.5);

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`, {
        align: 'right',
      });
    doc.moveDown(1);

    if (rows.length === 0) {
      doc.fontSize(11).text('Sin datos para el período seleccionado.', { align: 'center' });
      doc.end();
      return;
    }

    // Table setup
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colCount = columns.length;
    const colWidth = pageWidth / colCount;
    const rowHeight = 20;
    const headerHeight = 22;

    let x = doc.page.margins.left;
    let y = doc.y;

    // Draw header
    doc.fillColor('#1E40AF').rect(x, y, pageWidth, headerHeight).fill();
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
    columns.forEach((col, i) => {
      doc.text(col.header, x + i * colWidth + 4, y + 6, {
        width: colWidth - 8,
        ellipsis: true,
        lineBreak: false,
      });
    });
    y += headerHeight;

    doc.fillColor('#000000').font('Helvetica').fontSize(8);

    // Draw data rows
    rows.forEach((row, rowIdx) => {
      // Page break check
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ layout: 'landscape' });
        y = doc.page.margins.top;
      }

      // Alternating row background
      if (rowIdx % 2 === 0) {
        doc.fillColor('#F3F4F6').rect(x, y, pageWidth, rowHeight).fill();
      }
      doc.fillColor('#111827');

      columns.forEach((col, i) => {
        const value = row[col.key];
        const text =
          value === null || value === undefined
            ? ''
            : typeof value === 'number'
              ? value.toLocaleString('es-CO')
              : String(value);
        doc.text(text, x + i * colWidth + 4, y + 5, {
          width: colWidth - 8,
          ellipsis: true,
          lineBreak: false,
        });
      });

      // Row border
      doc.strokeColor('#D1D5DB').moveTo(x, y + rowHeight).lineTo(x + pageWidth, y + rowHeight).stroke();
      y += rowHeight;
    });

    // Table outer border
    doc
      .strokeColor('#6B7280')
      .rect(x, doc.y - rows.length * rowHeight - headerHeight, pageWidth, rows.length * rowHeight + headerHeight)
      .stroke();

    doc.end();
  });
}
