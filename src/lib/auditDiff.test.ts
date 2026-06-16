import { describe, expect, it } from 'vitest';
import { type AuditEvent, diffLibraries } from './auditDiff';
import type { LibraryEntry, LibraryState } from './libraryCore';

function entry(p: Partial<LibraryEntry> & { id: string }): LibraryEntry {
  return {
    id: p.id,
    group: p.group ?? 'G',
    fileName: p.fileName ?? 'f',
    mode: p.mode ?? 'rebin',
    xml: p.xml ?? '<a/>',
    savedAt: p.savedAt ?? 1,
  };
}
const state = (entries: LibraryEntry[]): LibraryState => ({ entries, emptyGroups: [] });
const byAction = (evs: AuditEvent[], a: string) => evs.filter((e) => e.action === a);

describe('diffLibraries', () => {
  it('flags a brand-new entry as create', () => {
    const evs = diffLibraries(state([]), state([entry({ id: '1' })]));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ action: 'create', entryId: '1' });
  });

  it('flags a removed entry as delete and snapshots its xml', () => {
    const evs = diffLibraries(state([entry({ id: '1', xml: '<keep/>' })]), state([]));
    expect(byAction(evs, 'delete')).toHaveLength(1);
    expect((evs[0].detail.before as { xml: string }).xml).toBe('<keep/>');
  });

  it('flags an xml change as update and keeps the previous xml', () => {
    const prev = state([entry({ id: '1', xml: '<v1/>' })]);
    const next = state([entry({ id: '1', xml: '<v2/>' })]);
    const evs = diffLibraries(prev, next);
    expect(evs).toHaveLength(1);
    expect(evs[0].action).toBe('update');
    expect(evs[0].detail.changed).toEqual(['xml']);
    expect((evs[0].detail.before as { xml: string }).xml).toBe('<v1/>');
  });

  it('records rename + mode change in the changed list', () => {
    const prev = state([entry({ id: '1', fileName: 'old', mode: 'pod' })]);
    const next = state([entry({ id: '1', fileName: 'new', mode: 'rebin' })]);
    const evs = diffLibraries(prev, next);
    expect(evs[0].detail.changed).toEqual(['fileName', 'mode']);
  });

  it('emits nothing when nothing changed', () => {
    const s = state([entry({ id: '1' }), entry({ id: '2', fileName: 'g' })]);
    expect(diffLibraries(s, s)).toEqual([]);
  });

  it('handles a mixed batch (create + update + delete)', () => {
    const prev = state([entry({ id: '1', xml: '<a/>' }), entry({ id: '2', xml: '<b/>' })]);
    const next = state([entry({ id: '1', xml: '<a2/>' }), entry({ id: '3', xml: '<c/>' })]);
    const evs = diffLibraries(prev, next);
    expect(byAction(evs, 'create').map((e) => e.entryId)).toEqual(['3']);
    expect(byAction(evs, 'update').map((e) => e.entryId)).toEqual(['1']);
    expect(byAction(evs, 'delete').map((e) => e.entryId)).toEqual(['2']);
  });
});
