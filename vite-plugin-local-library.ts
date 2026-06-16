import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Local dev shim for the `/api/library` endpoint.
 *
 * In production this route is served by the Cloudflare Worker (`src/worker.ts`)
 * backed by an R2 bucket. During `vite dev` there's no Worker, so this plugin
 * mirrors the *exact same contract* against a local JSON file — meaning dev
 * never touches the live R2 data. The file is git-ignored and starts absent,
 * so a fresh checkout boots with an empty library ("0'dan başla").
 *
 * Keep this byte-compatible with `src/worker.ts`'s handleLibrary().
 */

const EMPTY_LIBRARY = JSON.stringify({ entries: [], emptyGroups: [] });

export function localLibrary(file = '.dev-library.json'): Plugin {
  const path = resolve(process.cwd(), file);

  return {
    name: 'local-library-api',
    configureServer(server) {
      server.middlewares.use('/api/library', async (req, res) => {
        res.setHeader('content-type', 'application/json');

        if (req.method === 'GET') {
          try {
            const body = existsSync(path) ? await readFile(path, 'utf8') : EMPTY_LIBRARY;
            res.statusCode = 200;
            res.end(body || EMPTY_LIBRARY);
          } catch {
            res.statusCode = 200;
            res.end(EMPTY_LIBRARY);
          }
          return;
        }

        if (req.method === 'PUT') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = Buffer.concat(chunks).toString('utf8');
          // Same shape-guard the Worker enforces so the file stays well-formed.
          try {
            const parsed = JSON.parse(body);
            if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
              res.statusCode = 400;
              res.end('Invalid shape');
              return;
            }
          } catch {
            res.statusCode = 400;
            res.end('Invalid JSON');
            return;
          }
          await writeFile(path, body, 'utf8');
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
