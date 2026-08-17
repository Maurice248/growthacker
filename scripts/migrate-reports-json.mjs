/**
 * Recreate reports_json on the new DB from OLD_DIRECT_URL, then copy rows.
 * Env: OLD_DIRECT_URL, DIRECT_URL (loads .env / .env.migrate)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const name of ['.env', '.env.migrate']) {
  const envPath = path.join(root, name);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const oldUrl = process.env.OLD_DIRECT_URL;
const newUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!oldUrl || !newUrl) {
  console.error('Set OLD_DIRECT_URL and DIRECT_URL');
  process.exit(1);
}

const { Client } = pg;

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function pgType(udt, dataType) {
  if (dataType === 'ARRAY') {
    // udt like _text → text[]
    const base = String(udt || '').replace(/^_/, '');
    return `${base}[]`;
  }
  if (udt === 'uuid') return 'uuid';
  if (udt === 'jsonb') return 'jsonb';
  if (udt === 'json') return 'json';
  if (udt === 'timestamptz') return 'timestamptz';
  if (udt === 'timestamp') return 'timestamp';
  if (udt === 'text') return 'text';
  if (udt === 'bool') return 'boolean';
  if (udt === 'int4') return 'integer';
  if (udt === 'int8') return 'bigint';
  if (udt === 'float8') return 'double precision';
  if (udt === 'numeric') return 'numeric';
  return udt || dataType;
}

async function main() {
  const oldDb = new Client({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newDb = new Client({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });
  await oldDb.connect();
  await newDb.connect();

  const table = 'reports_json';

  const { rows: existsOld } = await oldDb.query(
    `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
    [table]
  );
  if (!existsOld.length) {
    console.error('reports_json not found on OLD database');
    process.exit(1);
  }

  const { rows: cols } = await oldDb.query(
    `
    SELECT column_name, data_type, udt_name, is_nullable, column_default,
           character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
    `,
    [table]
  );

  console.log('Old reports_json columns:');
  for (const c of cols) {
    console.log(`  - ${c.column_name}: ${c.udt_name} default=${c.column_default}`);
  }

  // Ensure pgcrypto/uuid on new
  await newDb.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  const colDefs = cols.map((c) => {
    const typ = pgType(c.udt_name, c.data_type);
    let def = '';
    if (c.column_default) {
      // Keep defaults that don't reference old schemas oddly
      def = ` DEFAULT ${c.column_default}`;
    }
    const nullSql = c.is_nullable === 'NO' ? ' NOT NULL' : '';
    return `${quoteIdent(c.column_name)} ${typ}${def}${nullSql}`;
  });

  // Drop and recreate for a clean migrate of this one table
  await newDb.query(`DROP TABLE IF EXISTS public.${quoteIdent(table)} CASCADE`);
  const createSql = `CREATE TABLE public.${quoteIdent(table)} (\n  ${colDefs.join(',\n  ')}\n)`;
  console.log('\nCreating table on new DB...');
  await newDb.query(createSql);

  // Primary key if id exists and no PK yet
  const { rows: pkOld } = await oldDb.query(
    `
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'public.reports_json'::regclass AND i.indisprimary
    `
  );
  if (pkOld.length) {
    const pkCols = pkOld.map((r) => quoteIdent(r.attname)).join(', ');
    try {
      await newDb.query(
        `ALTER TABLE public.${quoteIdent(table)} ADD PRIMARY KEY (${pkCols})`
      );
    } catch (e) {
      // may already be in column def via unique; ignore
      console.warn('PK note:', e.message);
    }
  }

  await newDb.query(`
    CREATE INDEX IF NOT EXISTS reports_json_company_id_idx
    ON public.reports_json (company_id)
  `).catch(() => {});

  await newDb.query(`
    CREATE INDEX IF NOT EXISTS reports_json_created_at_idx
    ON public.reports_json (created_at DESC)
  `).catch(() => {});

  const columns = cols.map((c) => c.column_name);
  const selectList = columns.map(quoteIdent).join(', ');
  const { rows } = await oldDb.query(`SELECT ${selectList} FROM public.${quoteIdent(table)}`);
  console.log(`\nCopying ${rows.length} rows...`);

  const typeByCol = Object.fromEntries(
    cols.map((c) => [c.column_name, { dataType: c.data_type, udt: c.udt_name }])
  );

  const colList = columns.map(quoteIdent).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const insertSql = `INSERT INTO public.${quoteIdent(table)} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return null;
      if (v instanceof Date || Buffer.isBuffer(v)) return v;
      const meta = typeByCol[c];
      const isJson = meta && (meta.dataType === 'json' || meta.dataType === 'jsonb');
      const isArray = meta && (meta.dataType === 'ARRAY' || String(meta.udt || '').startsWith('_'));
      if (isJson && typeof v === 'object') return JSON.stringify(v);
      if (isArray) return v;
      if (typeof v === 'object' && !Array.isArray(v)) return JSON.stringify(v);
      return v;
    });
    await newDb.query(insertSql, values);
    inserted += 1;
  }

  const { rows: countRows } = await newDb.query(
    `SELECT COUNT(*)::int AS n FROM public.${quoteIdent(table)}`
  );
  console.log(`Done. Inserted ${inserted} rows; new table count=${countRows[0].n}`);

  await oldDb.end();
  await newDb.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
