import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as zlib from 'node:zlib';
import * as crypto from 'node:crypto';
import { getDb, getCurrentDbPath } from './database.ts';

let syncQueue: Promise<void> = Promise.resolve();

export function isCloudSyncConfigured(): boolean {
  return Boolean(
    process.env.TURSO_DATABASE_URL?.trim() &&
    process.env.TURSO_AUTH_TOKEN?.trim()
  );
}

export function getTursoPipelineUrl(rawUrl: string): string {
  let clean = rawUrl.trim().replace(/\/+$/, '');
  if (clean.startsWith('libsql://')) {
    clean = 'https://' + clean.slice('libsql://'.length);
  } else if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  return clean.endsWith('/v2/pipeline') ? clean : `${clean}/v2/pipeline`;
}

async function executeTursoPipeline(requests: any[]): Promise<any[]> {
  const rawUrl = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!rawUrl || !authToken) {
    throw new Error('Turso cloud credentials are not configured.');
  }

  const pipelineUrl = getTursoPipelineUrl(rawUrl);
  let lastError: any;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(pipelineUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [...requests, { type: 'close' }]
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Turso HTTP ${res.status}: ${errText || res.statusText}`);
      }

      const json = (await res.json()) as { results?: any[] };
      const results = json.results || [];
      for (const r of results) {
        if (r?.type === 'error') {
          throw new Error(`Turso SQL error: ${r.error?.message || JSON.stringify(r.error)}`);
        }
      }
      return results;
    } catch (err: any) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      }
    }
  }

  throw lastError;
}

export async function restoreDatabaseFromCloudIfConfigured(
  targetDbPath?: string
): Promise<{ configured: boolean; restored: boolean; updatedAt?: string }> {
  if (!isCloudSyncConfigured()) {
    return { configured: false, restored: false };
  }

  const defaultDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  const dbPath = targetDbPath || path.join(defaultDir, 'pharmacy.db');

  const results = await executeTursoPipeline([
    {
      type: 'execute',
      stmt: {
        sql: `CREATE TABLE IF NOT EXISTS pharmacy_cloud_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload_b64 TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`
      }
    },
    {
      type: 'execute',
      stmt: {
        sql: 'SELECT payload_b64, sha256, updated_at FROM pharmacy_cloud_state WHERE id = 1'
      }
    }
  ]);

  const selectResult = results[1]?.response?.result;
  const rows = selectResult?.rows || [];
  if (rows.length === 0) {
    return { configured: true, restored: false };
  }

  const row = rows[0];
  const payloadB64: string | undefined = row?.[0]?.value;
  const expectedSha256: string | undefined = row?.[1]?.value;
  const updatedAt: string | undefined = row?.[2]?.value;

  if (!payloadB64 || !expectedSha256) {
    return { configured: true, restored: false };
  }

  const gzBuffer = Buffer.from(payloadB64, 'base64');
  const dbBuffer = zlib.gunzipSync(gzBuffer);

  const actualSha = crypto.createHash('sha256').update(dbBuffer).digest('hex');
  if (actualSha !== expectedSha256) {
    throw new Error('Cloud database integrity check failed (SHA-256 mismatch).');
  }

  if (!dbBuffer.subarray(0, 16).toString('utf8').startsWith('SQLite format 3')) {
    throw new Error('Cloud database payload is not a valid SQLite file.');
  }

  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(dbPath + ext)) {
      fs.unlinkSync(dbPath + ext);
    }
  }

  const tempWritePath = `${dbPath}.cloud-tmp-${Date.now()}`;
  fs.writeFileSync(tempWritePath, dbBuffer);
  fs.renameSync(tempWritePath, dbPath);

  console.log(`[Cloud Sync] Restored persistent database from Turso (last saved: ${updatedAt || 'unknown'})`);
  return { configured: true, restored: true, updatedAt };
}

export function syncDatabaseToCloud(): Promise<void> {
  if (!isCloudSyncConfigured()) {
    return Promise.resolve();
  }

  const runTask = async () => {
    const db = getDb();
    const dbPath = getCurrentDbPath();
    if (!dbPath) return;

    const tmpSnapshot = path.join(
      os.tmpdir(),
      `niramoy-cloud-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`
    );

    try {
      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        // Ignore checkpoint error if DB is not in WAL mode
      }
      db.exec(`VACUUM INTO '${tmpSnapshot.replace(/'/g, "''")}';`);
      const dbBuffer = fs.readFileSync(tmpSnapshot);
      const sha256 = crypto.createHash('sha256').update(dbBuffer).digest('hex');
      const gzBuffer = zlib.gzipSync(dbBuffer);
      const payloadB64 = gzBuffer.toString('base64');
      const now = new Date().toISOString();

      await executeTursoPipeline([
        {
          type: 'execute',
          stmt: {
            sql: `CREATE TABLE IF NOT EXISTS pharmacy_cloud_state (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              payload_b64 TEXT NOT NULL,
              sha256 TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )`
          }
        },
        {
          type: 'execute',
          stmt: {
            sql: `INSERT OR REPLACE INTO pharmacy_cloud_state (id, payload_b64, sha256, updated_at)
                  VALUES (1, ?, ?, ?)`,
            args: [
              { type: 'text', value: payloadB64 },
              { type: 'text', value: sha256 },
              { type: 'text', value: now }
            ]
          }
        }
      ]);
    } finally {
      if (fs.existsSync(tmpSnapshot)) {
        fs.unlinkSync(tmpSnapshot);
      }
    }
  };

  syncQueue = syncQueue.then(runTask, runTask);
  return syncQueue;
}
