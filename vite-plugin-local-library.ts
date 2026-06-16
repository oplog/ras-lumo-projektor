import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { diffLibraries } from './src/lib/auditDiff';
import type { LibraryState } from './src/lib/libraryCore';

/**
 * Local dev shim for the `/api/library` + `/api/library/audit` endpoints.
 *
 * Production serves these from the Cloudflare Worker backed by D1. During
 * `vite dev` there's no Worker, so this plugin mirrors the *same contract*
 * against a local JSON file — including the diff-based audit log — so dev has
 * full parity and never touches live data. The file is git-ignored and starts
 * absent, so a fresh checkout boots with an empty library.
 */

interface AuditRow {
  id: number;
  ts: number;
  action: string;
  entryId: string;
  group: string;
  fileName: string;
  mode: string;
  detail: Record<string, unknown>;
}
interface LocalStore extends LibraryState {
  audit: AuditRow[];
}

const EMPTY: LocalStore = { entries: [], emptyGroups: [], audit: [] };

export function localLibrary(file = '.dev-library.json'): Plugin {
  const path = resolve(process.cwd(), file);

  const read = async (): Promise<LocalStore> => {
    if (!existsSync(path)) return { ...EMPTY };
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8'));
      return {
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        emptyGroups: Array.isArray(parsed.emptyGroups) ? parsed.emptyGroups : [],
        audit: Array.isArray(parsed.audit) ? parsed.audit : [],
      };
    } catch {
      return { ...EMPTY };
    }
  };

  return {
    name: 'local-library-api',
    configureServer(server) {
      server.middlewares.use('/api/library', async (req, res) => {
        res.setHeader('content-type', 'application/json');
        const isAudit = (req.originalUrl ?? req.url ?? '').includes('/api/library/audit');

        if (req.method === 'GET' && isAudit) {
          const store = await read();
          res.statusCode = 200;
          res.end(JSON.stringify({ events: [...store.audit].reverse().slice(0, 200) }));
          return;
        }

        if (req.method === 'GET') {
          const store = await read();
          res.statusCode = 200;
          res.end(JSON.stringify({ entries: store.entries, emptyGroups: store.emptyGroups }));
          return;
        }

        if (req.method === 'PUT') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          let body: { entries?: unknown; emptyGroups?: unknown };
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            res.statusCode = 400;
            res.end('Invalid JSON');
            return;
          }
          if (!body || typeof body !== 'object' || !Array.isArray(body.entries)) {
            res.statusCode = 400;
            res.end('Invalid shape');
            return;
          }
          const prev = await read();
          const next: LibraryState = {
            entries: body.entries as LibraryState['entries'],
            emptyGroups: Array.isArray(body.emptyGroups)
              ? (body.emptyGroups as string[])
              : [],
          };
          const ts = Date.now();
          let id = prev.audit.length;
          const newRows: AuditRow[] = diffLibraries(prev, next).map((ev) => ({
            id: ++id,
            ts,
            action: ev.action,
            entryId: ev.entryId,
            group: ev.group,
            fileName: ev.fileName,
            mode: ev.mode,
            detail: ev.detail,
          }));
          const store: LocalStore = {
            entries: next.entries,
            emptyGroups: next.emptyGroups,
            audit: [...prev.audit, ...newRows],
          };
          await writeFile(path, JSON.stringify(store, null, 2), 'utf8');
          res.statusCode = 200;
          res.end('OK');
          return;
        }

        res.statusCode = 405;
        res.setHeader('allow', 'GET, PUT');
        res.end('Method not allowed');
      });
    },
  };
}
