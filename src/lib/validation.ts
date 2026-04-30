import type { Layout } from './types';

/**
 * Mirrors `ProjectorLayoutConfiguration.Validate()` from the C# app.
 * The Windows app refuses to load any XML that fails these checks, so we
 * surface the same errors before the user can save.
 */

export interface ValidationIssue {
  field: string;
  message: string;
}

export function validateLayout(layout: Layout): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!layout.stationName.trim()) {
    issues.push({ field: 'stationName', message: 'İstasyon adı boş olamaz' });
  }
  if (layout.rowCount <= 0) {
    issues.push({ field: 'rowCount', message: 'Satır sayısı pozitif olmalı' });
  }
  if (!layout.columnsPerRow || layout.columnsPerRow.length === 0) {
    issues.push({ field: 'columnsPerRow', message: 'En az bir satır gerekli' });
  } else if (layout.columnsPerRow.length !== layout.rowCount) {
    issues.push({
      field: 'columnsPerRow',
      message: `ColumnsPerRow uzunluğu (${layout.columnsPerRow.length}) RowCount'a (${layout.rowCount}) eşit olmalı`,
    });
  } else {
    layout.columnsPerRow.forEach((c, i) => {
      if (c <= 0) {
        issues.push({
          field: 'columnsPerRow',
          message: `Satır ${i + 1} için sütun sayısı pozitif olmalı (şu an ${c})`,
        });
      }
    });
  }

  if (!layout.boundaryCorners || layout.boundaryCorners.length !== 4) {
    issues.push({
      field: 'boundaryCorners',
      message: 'Tam 4 boundary köşesi gerekli (TL, TR, BL, BR)',
    });
  }

  const expectedCellCount = layout.columnsPerRow.reduce((s, c) => s + c, 0);
  if (layout.cells.length !== expectedCellCount) {
    issues.push({
      field: 'cells',
      message: `Hücre sayısı uyuşmuyor: ${expectedCellCount} bekleniyor, ${layout.cells.length} bulundu`,
    });
  }

  const names = layout.cells.map((c) => c.name);
  const empty = names.filter((n) => !n.trim()).length;
  if (empty > 0) {
    issues.push({ field: 'cells', message: `${empty} hücrenin adı boş` });
  }

  const counts = new Map<string, number>();
  for (const n of names) {
    if (!n.trim()) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const dups = [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n);
  if (dups.length) {
    issues.push({
      field: 'cells',
      message: `Tekrar eden hücre adları: ${dups.join(', ')}`,
    });
  }

  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.length > 0;
}
