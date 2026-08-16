/**
 * A minimal, dependency-free XLSX writer.
 *
 * An .xlsx file is a ZIP of XML parts, so the whole format is reachable without
 * a library. That matters here for two reasons: the maintained SheetJS build is
 * no longer on npm (the registry copy is stale and carries advisories), and the
 * alternatives are 400 kB+ for what this dashboard actually needs — a handful of
 * typed columns, a header row and a currency format.
 *
 * The ZIP is written with the "store" method (no compression). Deflate would
 * need a compressor; the workbooks here are tens of kilobytes of XML, and Excel
 * reads stored entries exactly the same way.
 *
 * Scope: numbers, strings and booleans, four number formats, a frozen and
 * filtered header row, and per-column widths. No formulas, charts or merges —
 * if this ever needs those, that is the point to reach for a real library.
 */

export type CellValue = string | number | boolean | null | undefined;

export type CellFormat = 'text' | 'currency' | 'integer' | 'decimal' | 'percent';

export interface Column {
  /** Header text for row 1. */
  header: string;
  /** Approximate width in characters. */
  width?: number;
  format?: CellFormat;
}

export interface Sheet {
  name: string;
  columns: Column[];
  rows: CellValue[][];
}

/* ------------------------------------------------------------------ */
/* XML helpers                                                         */
/* ------------------------------------------------------------------ */

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Control characters are illegal in XML 1.0 and make Excel reject the file
    // outright rather than skip the cell.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** 0 → A, 25 → Z, 26 → AA. */
function columnLetter(index: number): string {
  let letters = '';
  let n = index;
  while (n >= 0) {
    letters = String.fromCharCode((n % 26) + 65) + letters;
    n = Math.floor(n / 26) - 1;
  }
  return letters;
}

/**
 * Excel rejects a workbook outright if two sheets collide or a name holds a
 * reserved character, so names are sanitised rather than trusted.
 */
function sheetName(raw: string, taken: Set<string>): string {
  let name = raw.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
  if (taken.has(name.toLowerCase())) {
    let suffix = 2;
    let candidate = `${name.slice(0, 28)} ${suffix}`;
    while (taken.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${name.slice(0, 28)} ${suffix}`;
    }
    name = candidate;
  }
  taken.add(name.toLowerCase());
  return name;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

/*
 * cellXfs indices, referenced by the `s` attribute on each cell. The order here
 * is the contract between STYLES_XML and FORMAT_STYLE below — keep them together.
 */
const STYLE_DEFAULT = 0;
const STYLE_HEADER = 1;
const STYLE_CURRENCY = 2;
const STYLE_INTEGER = 3;
const STYLE_DECIMAL = 4;
const STYLE_PERCENT = 5;

const FORMAT_STYLE: Record<CellFormat, number> = {
  text: STYLE_DEFAULT,
  currency: STYLE_CURRENCY,
  integer: STYLE_INTEGER,
  decimal: STYLE_DECIMAL,
  percent: STYLE_PERCENT,
};

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4">
<numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/>
<numFmt numFmtId="165" formatCode="#,##0"/>
<numFmt numFmtId="166" formatCode="#,##0.00"/>
<numFmt numFmtId="167" formatCode="0.0%"/>
</numFmts>
<fonts count="2">
<font><sz val="11"/><color rgb="FF0E2138"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F5090"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFC9D4DE"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<!-- The named "Normal" style is optional by the schema but expected in practice;
     without it readers report a workbook with no default style. -->
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="0"/>
<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

/* ------------------------------------------------------------------ */
/* Worksheet                                                           */
/* ------------------------------------------------------------------ */

function cellXml(ref: string, value: CellValue, style: number): string {
  const s = style === STYLE_DEFAULT ? '' : ` s="${style}"`;

  if (value == null || value === '') return '';

  if (typeof value === 'number') {
    // NaN/Infinity have no numeric representation in the format; writing them
    // raw produces a file Excel refuses to open, so they degrade to text.
    if (!Number.isFinite(value)) {
      return `<c r="${ref}" t="inlineStr"><is><t>${esc(String(value))}</t></is></c>`;
    }
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }

  if (typeof value === 'boolean') {
    return `<c r="${ref}"${s} t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const { columns, rows } = sheet;
  const lastColumn = columnLetter(Math.max(0, columns.length - 1));
  const lastRow = rows.length + 1;

  const cols = columns
    .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 16}" customWidth="1"/>`)
    .join('');

  const headerCells = columns
    .map((column, index) => cellXml(`${columnLetter(index)}1`, column.header, STYLE_HEADER))
    .join('');

  const bodyRows = rows
    .map((row, rowIndex) => {
      const number = rowIndex + 2;
      const cells = columns
        .map((column, columnIndex) =>
          cellXml(
            `${columnLetter(columnIndex)}${number}`,
            row[columnIndex],
            typeof row[columnIndex] === 'number' ? FORMAT_STYLE[column.format ?? 'decimal'] : STYLE_DEFAULT
          )
        )
        .join('');
      return `<row r="${number}">${cells}</row>`;
    })
    .join('');

  // The header is frozen and filtered so a 200-row account sheet is usable the
  // moment it opens, rather than after the reader sets that up themselves.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData><row r="1" ht="20" customHeight="1">${headerCells}</row>${bodyRows}</sheetData>
${rows.length > 0 ? `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` : ''}
</worksheet>`;
}

/* ------------------------------------------------------------------ */
/* ZIP container                                                       */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
  crc: number;
  offset: number;
}

/** MS-DOS packed date/time — the only timestamp format the ZIP header carries. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: (((date.getFullYear() - 1980) & 0x7f) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  length = 0;

  push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  u16(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]));
  }

  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

function zip(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(new Date());
  const out = new ByteWriter();
  const entries: ZipEntry[] = [];

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const bytes = encoder.encode(file.content);
    const entry: ZipEntry = { name: file.name, bytes, crc: crc32(bytes), offset: out.length };
    entries.push(entry);

    out.u32(0x04034b50); // local file header
    out.u16(20); // version needed
    out.u16(0x0800); // UTF-8 filenames
    out.u16(0); // method: store
    out.u16(stamp.time);
    out.u16(stamp.date);
    out.u32(entry.crc);
    out.u32(bytes.length); // compressed == uncompressed when stored
    out.u32(bytes.length);
    out.u16(nameBytes.length);
    out.u16(0); // extra field length
    out.push(nameBytes);
    out.push(bytes);
  }

  const centralStart = out.length;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    out.u32(0x02014b50); // central directory header
    out.u16(20); // version made by
    out.u16(20); // version needed
    out.u16(0x0800);
    out.u16(0);
    out.u16(stamp.time);
    out.u16(stamp.date);
    out.u32(entry.crc);
    out.u32(entry.bytes.length);
    out.u32(entry.bytes.length);
    out.u16(nameBytes.length);
    out.u16(0); // extra
    out.u16(0); // comment
    out.u16(0); // disk number
    out.u16(0); // internal attrs
    out.u32(0); // external attrs
    out.u32(entry.offset);
    out.push(nameBytes);
  }
  const centralSize = out.length - centralStart;

  out.u32(0x06054b50); // end of central directory
  out.u16(0);
  out.u16(0);
  out.u16(entries.length);
  out.u16(entries.length);
  out.u32(centralSize);
  out.u32(centralStart);
  out.u16(0); // comment length

  return out.toUint8Array();
}

/* ------------------------------------------------------------------ */
/* Workbook                                                            */
/* ------------------------------------------------------------------ */

export function buildWorkbook(sheets: Sheet[]): Blob {
  if (sheets.length === 0) throw new Error('A workbook needs at least one sheet.');

  const taken = new Set<string>();
  const named = sheets.map((sheet) => ({ ...sheet, name: sheetName(sheet.name, taken) }));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${named
  .map(
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )
  .join('\n')}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${named.map((sheet, index) => `<sheet name="${esc(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('\n')}
</sheets>
</workbook>`;

  // Styles take the relationship id after the last sheet.
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${named
  .map(
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )
  .join('\n')}
<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const files = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/styles.xml', content: STYLES_XML },
    ...named.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheetXml(sheet),
    })),
  ];

  return new Blob([zip(files) as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Safari drops the download if the object URL is revoked in the same tick.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
