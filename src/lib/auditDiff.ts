import type { LibraryState } from './libraryCore';

/**
 * Pure diff between two library snapshots, producing one audit event per
 * changed entry. Used server-side (worker) on every save so the audit_log
 * records exactly what changed — and keeps the *previous* XML of any
 * overwritten/deleted file so old versions stay recoverable.
 *
 * Matched by entry id:
 *   - id only in `next`  → create
 *   - id only in `prev`  → delete (snapshot the old entry)
 *   - id in both, differs → update (record field changes + old XML)
 */

export interface AuditEvent {
  action: 'create' | 'update' | 'delete';
  entryId: string;
  group: string;
  fileName: string;
  mode: string;
  /** Structured payload; the worker JSON-stringifies it into audit_log.detail. */
  detail: Record<string, unknown>;
}

export function diffLibraries(prev: LibraryState, next: LibraryState): AuditEvent[] {
  const events: AuditEvent[] = [];
  const prevById = new Map(prev.entries.map((e) => [e.id, e]));
  const nextById = new Map(next.entries.map((e) => [e.id, e]));

  for (const e of next.entries) {
    const old = prevById.get(e.id);
    if (!old) {
      events.push({
        action: 'create',
        entryId: e.id,
        group: e.group,
        fileName: e.fileName,
        mode: e.mode,
        detail: { after: { group: e.group, fileName: e.fileName, mode: e.mode } },
      });
      continue;
    }
    const changed: string[] = [];
    if (old.group !== e.group) changed.push('group');
    if (old.fileName !== e.fileName) changed.push('fileName');
    if (old.mode !== e.mode) changed.push('mode');
    if (old.xml !== e.xml) changed.push('xml');
    if (changed.length > 0) {
      events.push({
        action: 'update',
        entryId: e.id,
        group: e.group,
        fileName: e.fileName,
        mode: e.mode,
        // Snapshot the previous version so an overwrite is reversible.
        detail: {
          changed,
          before: { group: old.group, fileName: old.fileName, mode: old.mode, xml: old.xml },
        },
      });
    }
  }

  for (const e of prev.entries) {
    if (!nextById.has(e.id)) {
      events.push({
        action: 'delete',
        entryId: e.id,
        group: e.group,
        fileName: e.fileName,
        mode: e.mode,
        detail: { before: { group: e.group, fileName: e.fileName, mode: e.mode, xml: e.xml } },
      });
    }
  }

  return events;
}
