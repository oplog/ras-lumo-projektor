import { describe, expect, it } from 'vitest';
import * as core from './libraryCore';
import type { LibraryState } from './libraryCore';

// Deterministic id factory so tests don't depend on crypto/randomness.
function idGen() {
  let n = 0;
  return () => `id-${++n}`;
}

const base = (): LibraryState => ({ ...core.EMPTY_STATE });

function save(
  state: LibraryState,
  opts: Omit<core.SaveFileInput, 'mode' | 'xml'> &
    Partial<Pick<core.SaveFileInput, 'mode' | 'xml'>>,
  meta: { id: string; savedAt: number },
) {
  return core.saveFile(state, { mode: 'rebin', xml: '<xml/>', ...opts }, meta);
}

describe('consolidate', () => {
  it('maps legacy stationName to group + fileName', () => {
    const out = core.consolidate({ entries: [{ stationName: 'ras-1', xml: '<a/>' }] }, idGen());
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].group).toBe('ras-1');
    expect(out.entries[0].fileName).toBe('ras-1');
    expect(out.entries[0].mode).toBe('pod'); // default
  });

  it('accepts emptyStations as an alias for emptyGroups', () => {
    const out = core.consolidate({ entries: [], emptyStations: ['A', 'B'] }, idGen());
    expect(out.emptyGroups).toEqual(['A', 'B']);
  });

  it('drops an empty-group placeholder that already has real files', () => {
    const out = core.consolidate(
      {
        entries: [{ group: 'A', fileName: 'x', xml: '<a/>', mode: 'rebin' }],
        emptyGroups: ['A', 'B'],
      },
      idGen(),
    );
    expect(out.emptyGroups).toEqual(['B']);
  });

  it('mints ids for entries missing one and drops xml-less rows', () => {
    const out = core.consolidate(
      { entries: [{ group: 'A', fileName: 'x', xml: '<a/>' }, { group: 'B' }] },
      idGen(),
    );
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].id).toBe('id-1');
  });

  it('returns empty state for garbage input', () => {
    expect(core.consolidate(null, idGen())).toEqual(core.EMPTY_STATE);
    expect(core.consolidate('nope', idGen())).toEqual(core.EMPTY_STATE);
  });
});

describe('saveFile', () => {
  it('appends a new file and clears the group from emptyGroups', () => {
    const start = core.createEmptyGroup(base(), 'G');
    expect(start.emptyGroups).toEqual(['G']);
    const { state, entry } = save(
      start,
      { group: 'G', fileName: 'f1' },
      { id: 'id-1', savedAt: 100 },
    );
    expect(state.entries).toHaveLength(1);
    expect(state.emptyGroups).toEqual([]);
    expect(entry.id).toBe('id-1');
  });

  it('overwrites the same (group, fileName) instead of duplicating', () => {
    let s = base();
    s = save(s, { group: 'G', fileName: 'f', xml: '<v1/>' }, { id: 'id-1', savedAt: 100 }).state;
    const r = save(s, { group: 'G', fileName: 'f', xml: '<v2/>' }, { id: 'id-2', savedAt: 200 });
    expect(r.state.entries).toHaveLength(1);
    expect(r.state.entries[0].id).toBe('id-1'); // kept original id
    expect(r.state.entries[0].xml).toBe('<v2/>');
    expect(r.state.entries[0].savedAt).toBe(200);
  });

  it('keeps list position when overwriting (no jump to end)', () => {
    let s = base();
    s = save(s, { group: 'G', fileName: 'a' }, { id: 'id-1', savedAt: 1 }).state;
    s = save(s, { group: 'G', fileName: 'b' }, { id: 'id-2', savedAt: 2 }).state;
    s = save(s, { group: 'G', fileName: 'a', xml: '<new/>' }, { id: 'id-3', savedAt: 3 }).state;
    expect(s.entries.map((e) => e.fileName)).toEqual(['a', 'b']);
  });

  it('replaceId targets a specific row even if the name changed (a rename)', () => {
    let s = base();
    s = save(s, { group: 'G', fileName: 'old' }, { id: 'id-1', savedAt: 1 }).state;
    const r = save(
      s,
      { group: 'G', fileName: 'renamed', replaceId: 'id-1', xml: '<x/>' },
      { id: 'id-99', savedAt: 2 },
    );
    expect(r.state.entries).toHaveLength(1);
    expect(r.state.entries[0].id).toBe('id-1');
    expect(r.state.entries[0].fileName).toBe('renamed');
  });

  it('stores pod vs rebin mode verbatim', () => {
    let s = base();
    s = core.saveFile(
      s,
      { group: 'G', fileName: 'p', mode: 'pod', xml: '<a/>' },
      { id: 'id-1', savedAt: 1 },
    ).state;
    s = core.saveFile(
      s,
      { group: 'G', fileName: 'r', mode: 'rebin', xml: '<a/>' },
      { id: 'id-2', savedAt: 2 },
    ).state;
    expect(s.entries.find((e) => e.fileName === 'p')?.mode).toBe('pod');
    expect(s.entries.find((e) => e.fileName === 'r')?.mode).toBe('rebin');
  });

  it('trims names and rejects empty group/fileName', () => {
    expect(() =>
      save(base(), { group: '   ', fileName: 'f' }, { id: 'id-1', savedAt: 1 }),
    ).toThrow();
    expect(() =>
      save(base(), { group: 'G', fileName: '  ' }, { id: 'id-1', savedAt: 1 }),
    ).toThrow();
    const r = save(base(), { group: '  G  ', fileName: '  f  ' }, { id: 'id-1', savedAt: 1 });
    expect(r.entry.group).toBe('G');
    expect(r.entry.fileName).toBe('f');
  });
});

describe('per-file settings', () => {
  const settings = { gapFactor: 0.5, cellInset: 0.1, gridOffsetX: 10, gridOffsetY: -5 };

  it('saveFile stores settings', () => {
    const r = core.saveFile(
      base(),
      { group: 'G', fileName: 'f', mode: 'rebin', xml: '<a/>', settings },
      { id: 'id-1', savedAt: 1 },
    );
    expect(r.entry.settings).toEqual(settings);
  });

  it('preserves existing settings when a later save omits them', () => {
    let s = core.saveFile(
      base(),
      { group: 'G', fileName: 'f', mode: 'rebin', xml: '<v1/>', settings },
      { id: 'id-1', savedAt: 1 },
    ).state;
    // re-save same target without settings (e.g. a plain name edit path)
    s = core.saveFile(
      s,
      { group: 'G', fileName: 'f', mode: 'rebin', xml: '<v2/>' },
      { id: 'id-2', savedAt: 2 },
    ).state;
    expect(s.entries[0].settings).toEqual(settings);
  });

  it('consolidate parses settings and ignores garbage', () => {
    const out = core.consolidate(
      {
        entries: [
          { group: 'G', fileName: 'a', xml: '<a/>', settings },
          { group: 'G', fileName: 'b', xml: '<b/>', settings: 'nope' },
        ],
      },
      idGen(),
    );
    expect(out.entries[0].settings).toEqual(settings);
    expect(out.entries[1].settings).toBeUndefined();
  });
});

describe('deleteEntry', () => {
  it('removes the entry and keeps the now-empty group as a placeholder', () => {
    let s = base();
    s = save(s, { group: 'G', fileName: 'only' }, { id: 'id-1', savedAt: 1 }).state;
    s = core.deleteEntry(s, 'id-1');
    expect(s.entries).toHaveLength(0);
    expect(s.emptyGroups).toEqual(['G']);
  });

  it('does not add a placeholder when other files remain in the group', () => {
    let s = base();
    s = save(s, { group: 'G', fileName: 'a' }, { id: 'id-1', savedAt: 1 }).state;
    s = save(s, { group: 'G', fileName: 'b' }, { id: 'id-2', savedAt: 2 }).state;
    s = core.deleteEntry(s, 'id-1');
    expect(s.entries).toHaveLength(1);
    expect(s.emptyGroups).toEqual([]);
  });

  it('is a no-op for an unknown id', () => {
    const s = base();
    expect(core.deleteEntry(s, 'nope')).toBe(s);
  });
});

describe('updateEntry', () => {
  it('renames a file without bumping savedAt', () => {
    let s = base();
    s = save(s, { group: 'G', fileName: 'a' }, { id: 'id-1', savedAt: 100 }).state;
    s = core.updateEntry(s, 'id-1', { fileName: 'b' }, { savedAt: 999 });
    expect(s.entries[0].fileName).toBe('b');
    expect(s.entries[0].savedAt).toBe(100); // unchanged: no xml change
  });

  it('bumps savedAt only when xml changes', () => {
    let s = base();
    s = save(s, { group: 'G', fileName: 'a', xml: '<v1/>' }, { id: 'id-1', savedAt: 100 }).state;
    s = core.updateEntry(s, 'id-1', { xml: '<v2/>' }, { savedAt: 999 });
    expect(s.entries[0].xml).toBe('<v2/>');
    expect(s.entries[0].savedAt).toBe(999);
  });

  it('moves a file to a new group; old group becomes an empty placeholder', () => {
    let s = base();
    s = save(s, { group: 'OLD', fileName: 'a' }, { id: 'id-1', savedAt: 1 }).state;
    s = core.updateEntry(s, 'id-1', { group: 'NEW' }, { savedAt: 2 });
    expect(s.entries[0].group).toBe('NEW');
    expect(s.emptyGroups).toEqual(['OLD']);
  });

  it('can switch mode pod <-> rebin', () => {
    let s = base();
    s = core.saveFile(
      s,
      { group: 'G', fileName: 'a', mode: 'pod', xml: '<a/>' },
      { id: 'id-1', savedAt: 1 },
    ).state;
    s = core.updateEntry(s, 'id-1', { mode: 'rebin' }, { savedAt: 2 });
    expect(s.entries[0].mode).toBe('rebin');
  });

  it('is a no-op for an unknown id', () => {
    const s = base();
    expect(core.updateEntry(s, 'nope', { fileName: 'x' }, { savedAt: 1 })).toBe(s);
  });
});

describe('groups', () => {
  it('createEmptyGroup ignores duplicates and existing real groups', () => {
    let s = core.createEmptyGroup(base(), 'A');
    s = core.createEmptyGroup(s, 'A');
    expect(s.emptyGroups).toEqual(['A']);
    s = save(s, { group: 'A', fileName: 'f' }, { id: 'id-1', savedAt: 1 }).state;
    s = core.createEmptyGroup(s, 'A'); // A now has files → no placeholder
    expect(s.emptyGroups).toEqual([]);
  });

  it('renameGroup retags entries and placeholders', () => {
    let s = base();
    s = save(s, { group: 'OLD', fileName: 'f' }, { id: 'id-1', savedAt: 1 }).state;
    s = core.createEmptyGroup(s, 'EMPTY');
    s = core.renameGroup(s, 'OLD', 'NEW');
    expect(s.entries[0].group).toBe('NEW');
    s = core.renameGroup(s, 'EMPTY', 'EMPTY2');
    expect(s.emptyGroups).toEqual(['EMPTY2']);
  });

  it('removeGroup deletes files and placeholder', () => {
    let s = base();
    s = save(s, { group: 'G', fileName: 'f' }, { id: 'id-1', savedAt: 1 }).state;
    s = core.removeGroup(s, 'G');
    expect(s.entries).toHaveLength(0);
    expect(s.emptyGroups).toEqual([]);
  });
});

describe('reads', () => {
  it('listByGroup sorts groups (tr) and newest-first within a group', () => {
    let s = base();
    s = save(s, { group: 'Bravo', fileName: 'old' }, { id: 'id-1', savedAt: 100 }).state;
    s = save(s, { group: 'Bravo', fileName: 'new' }, { id: 'id-2', savedAt: 200 }).state;
    s = save(s, { group: 'Alfa', fileName: 'x' }, { id: 'id-3', savedAt: 50 }).state;
    s = core.createEmptyGroup(s, 'Çarli');
    const view = core.listByGroup(s);
    expect(view.map((g) => g.group)).toEqual(['Alfa', 'Bravo', 'Çarli']);
    expect(view[1].entries.map((e) => e.fileName)).toEqual(['new', 'old']);
    expect(view[2].entries).toEqual([]);
  });

  it('findByName finds the upsert target', () => {
    let s = base();
    s = save(s, { group: 'G', fileName: 'f' }, { id: 'id-1', savedAt: 1 }).state;
    expect(core.findByName(s, 'G', 'f')?.id).toBe('id-1');
    expect(core.findByName(s, 'G', 'missing')).toBeNull();
  });
});
