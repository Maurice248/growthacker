/**
 * Copy all public tables from OLD_DIRECT_URL → DIRECT_URL (or DATABASE_URL).
 * Requires: npm install pg
 * Env: OLD_DIRECT_URL, DIRECT_URL (preferred) or DATABASE_URL
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
  console.error('Set OLD_DIRECT_URL and DIRECT_URL (or DATABASE_URL) in the environment.');
  process.exit(1);
}

const { Client } = pg;

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function main() {
  const oldDb = new Client({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newDb = new Client({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  await oldDb.connect();
  await newDb.connect();
  console.log('Connected to old and new databases.');

  const { rows: tables } = await oldDb.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma%'
    ORDER BY tablename
  `);

  if (tables.length === 0) {
    console.error('No public tables found on the old database.');
    process.exit(1);
  }

  console.log(`Found ${tables.length} tables.`);

  // Disable FK checks while loading
  await newDb.query('SET session_replication_role = replica');

  let totalRows = 0;

  for (const { tablename } of tables) {
    const qTable = quoteIdent(tablename);

    // Ensure table exists on new DB
    const exists = await newDb.query(
      `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
      [tablename]
    );
    if (exists.rowCount === 0) {
      console.warn(`  skip ${tablename} (missing on new DB — run prisma db push first)`);
      continue;
    }

    const { rows: oldCols } = await oldDb.query(
      `
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      `,
      [tablename]
    );
    const { rows: newCols } = await newDb.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      `,
      [tablename]
    );
    const newColSet = new Set(newCols.map((c) => c.column_name));
    const sharedMeta = oldCols.filter((c) => newColSet.has(c.column_name));
    if (sharedMeta.length === 0) {
      console.warn(`  skip ${tablename} (no shared columns)`);
      continue;
    }
    const typeByCol = Object.fromEntries(
      sharedMeta.map((c) => [c.column_name, { dataType: c.data_type, udt: c.udt_name }])
    );
    const columns = sharedMeta.map((c) => c.column_name);
    const skippedCols = oldCols
      .map((c) => c.column_name)
      .filter((c) => !newColSet.has(c));
    if (skippedCols.length) {
      console.warn(`  ${tablename}: skipping columns not on new DB: ${skippedCols.join(', ')}`);
    }

    const selectList = columns.map(quoteIdent).join(', ');
    const { rows } = await oldDb.query(`SELECT ${selectList} FROM ${qTable}`);
    if (rows.length === 0) {
      console.log(`  ${tablename}: 0 rows`);
      continue;
    }

    const colList = columns.map(quoteIdent).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const insertSql = `INSERT INTO ${qTable} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

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
      try {
        await newDb.query(insertSql, values);
        inserted += 1;
      } catch (err) {
        console.error(`  ${tablename}: insert failed:`, err.message);
        throw err;
      }
    }

    totalRows += inserted;
    console.log(`  ${tablename}: ${inserted}/${rows.length} rows`);
  }

  await newDb.query('SET session_replication_role = DEFAULT');

  // Reset sequences for serial/identity columns
  const { rows: seqs } = await newDb.query(`
    SELECT
      quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS seq,
      quote_ident(t.relname) AS tbl,
      quote_ident(a.attname) AS col
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'a'
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE c.relkind = 'S' AND n.nspname = 'public'
  `);

  for (const s of seqs) {
    await newDb.query(
      `SELECT setval('${s.seq}'::regclass, COALESCE((SELECT MAX(${s.col}) FROM ${s.tbl}), 1))`
    );
  }

  console.log(`Done. Copied ~${totalRows} rows across ${tables.length} tables.`);
  await oldDb.end();
  await newDb.end();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
