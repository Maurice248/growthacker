/**
 * Create public tables that exist on OLD_DIRECT_URL but not on DIRECT_URL,
 * then copy their rows. Also backfills empty existing tables.
 *
 * Env: OLD_DIRECT_URL, DIRECT_URL (loads .env / .env.migrate)
 * Usage: node scripts/migrate-missing-tables.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

for (const name of ['.env', '.env.migrate']) {
  const envPath = path.join(root, name);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const uncommented = trimmed.startsWith('#')
      ? trimmed.replace(/^#\s*/, '')
      : trimmed;
    const eq = uncommented.indexOf('=');
    if (eq === -1) continue;
    const key = uncommented.slice(0, eq).trim();
    if (trimmed.startsWith('#') && key !== 'OLD_DIRECT_URL') continue;
    let val = uncommented.slice(eq + 1).trim();
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
  console.error('Set OLD_DIRECT_URL and DIRECT_URL (or DATABASE_URL).');
  process.exit(1);
}

const SKIP_TABLES = new Set(['_prisma_migrations']);
const { Client } = pg;

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function pgType(c) {
  if (c.data_type === 'ARRAY') {
    const base = String(c.udt_name || '').replace(/^_/, '');
    return `${base}[]`;
  }
  if (c.udt_name === 'varchar' && c.character_maximum_length) {
    return `character varying(${c.character_maximum_length})`;
  }
  if (c.udt_name === 'numeric' && c.numeric_precision) {
    return c.numeric_scale != null
      ? `numeric(${c.numeric_precision},${c.numeric_scale})`
      : `numeric(${c.numeric_precision})`;
  }
  const map = {
    uuid: 'uuid',
    jsonb: 'jsonb',
    json: 'json',
    timestamptz: 'timestamptz',
    timestamp: 'timestamp',
    text: 'text',
    bool: 'boolean',
    int2: 'smallint',
    int4: 'integer',
    int8: 'bigint',
    float4: 'real',
    float8: 'double precision',
    numeric: 'numeric',
    date: 'date',
    bytea: 'bytea',
    citext: 'citext',
  };
  return map[c.udt_name] || c.udt_name || c.data_type;
}

function sequenceFromDefault(def) {
  if (!def) return null;
  const match = String(def).match(/nextval\('(?:public\.)?([^']+)'::regclass\)/i);
  return match ? match[1].replace(/"/g, '') : null;
}

function asJsonParameter(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    try {
      JSON.parse(v);
      return v;
    } catch {
      return JSON.stringify(v);
    }
  }
  return JSON.stringify(v);
}

function rowValues(row, columns, typeByCol) {
  return columns.map((c) => {
    const v = row[c];
    if (v === null || v === undefined) return null;
    if (v instanceof Date || Buffer.isBuffer(v)) return v;
    const meta = typeByCol[c];
    const isJson = meta && (meta.dataType === 'json' || meta.dataType === 'jsonb');
    const isArray = meta && (meta.dataType === 'ARRAY' || String(meta.udt || '').startsWith('_'));
    if (isJson) return asJsonParameter(v);
    if (isArray) return v;
    if (typeof v === 'object' && !Array.isArray(v)) return JSON.stringify(v);
    return v;
  });
}

async function listTables(client) {
  const { rows } = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return rows.map((r) => r.tablename).filter((t) => !SKIP_TABLES.has(t));
}

async function tableCount(client, table) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM public.${quoteIdent(table)}`
  );
  return rows[0].n;
}

async function getColumns(client, table) {
  const { rows } = await client.query(
    `
    SELECT column_name, data_type, udt_name, is_nullable, column_default,
           character_maximum_length, numeric_precision, numeric_scale,
           is_identity, identity_generation
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
    `,
    [table]
  );
  return rows;
}

async function ensureEnums(oldDb, newDb, tables) {
  const { rows: enums } = await oldDb.query(
    `
    SELECT DISTINCT t.typname
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_attribute a ON a.atttypid = t.oid
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace nc ON nc.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND nc.nspname = 'public'
      AND c.relname = ANY($1::text[])
    `,
    [tables]
  );

  for (const { typname } of enums) {
    const exists = await newDb.query(`SELECT 1 FROM pg_type WHERE typname = $1`, [typname]);
    if (exists.rowCount) continue;
    const { rows: labels } = await oldDb.query(
      `
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = $1
      ORDER BY e.enumsortorder
      `,
      [typname]
    );
    const list = labels.map((r) => `'${String(r.enumlabel).replace(/'/g, "''")}'`).join(', ');
    console.log(`  create enum ${typname}`);
    if (!dryRun) {
      await newDb.query(`CREATE TYPE ${quoteIdent(typname)} AS ENUM (${list})`);
    }
  }
}

async function createTable(oldDb, newDb, table, cols) {
  await newDb.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await newDb.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  for (const c of cols) {
    const seq = sequenceFromDefault(c.column_default);
    if (!seq) continue;
    if (!dryRun) {
      await newDb.query(`CREATE SEQUENCE IF NOT EXISTS public.${quoteIdent(seq)}`);
    }
  }

  const colDefs = cols.map((c) => {
    const typ = pgType(c);
    let identity = '';
    if (c.is_identity === 'YES') {
      identity =
        c.identity_generation === 'ALWAYS'
          ? ' GENERATED ALWAYS AS IDENTITY'
          : ' GENERATED BY DEFAULT AS IDENTITY';
    }
    let def = '';
    if (!identity && c.column_default) def = ` DEFAULT ${c.column_default}`;
    const nullSql = c.is_nullable === 'NO' && !identity ? ' NOT NULL' : '';
    return `${quoteIdent(c.column_name)} ${typ}${identity}${def}${nullSql}`;
  });

  const createSql = `CREATE TABLE IF NOT EXISTS public.${quoteIdent(table)} (\n  ${colDefs.join(',\n  ')}\n)`;
  if (!dryRun) await newDb.query(createSql);

  const { rows: pkOld } = await oldDb.query(
    `
    SELECT a.attname
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = 'public' AND c.relname = $1 AND i.indisprimary
    ORDER BY array_position(i.indkey, a.attnum)
    `,
    [table]
  );
  if (pkOld.length && !dryRun) {
    const pkCols = pkOld.map((r) => quoteIdent(r.attname)).join(', ');
    try {
      await newDb.query(
        `ALTER TABLE public.${quoteIdent(table)} ADD PRIMARY KEY (${pkCols})`
      );
    } catch (e) {
      if (!/already exists|multiple primary/i.test(e.message)) {
        console.warn(`  ${table} PK: ${e.message}`);
      }
    }
  }

  const { rows: indexes } = await oldDb.query(
    `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
    `,
    [table]
  );
  for (const idx of indexes) {
    if (/CREATE UNIQUE INDEX .*_pkey ON /i.test(idx.indexdef)) continue;
    const sql = idx.indexdef.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ');
    if (!dryRun) {
      try {
        await newDb.query(sql);
      } catch (e) {
        console.warn(`  ${table} index ${idx.indexname}: ${e.message}`);
      }
    }
  }
}

async function copyRows(oldDb, newDb, table, cols) {
  const columns = cols.map((c) => c.column_name);
  const selectList = columns.map(quoteIdent).join(', ');
  const { rows } = await oldDb.query(
    `SELECT ${selectList} FROM public.${quoteIdent(table)}`
  );
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows`);
    return 0;
  }
  if (dryRun) {
    console.log(`  ${table}: would copy ${rows.length} rows`);
    return rows.length;
  }

  const typeByCol = Object.fromEntries(
    cols.map((c) => [c.column_name, { dataType: c.data_type, udt: c.udt_name }])
  );
  const hasIdentity = cols.some((c) => c.is_identity === 'YES');
  const colList = columns.map(quoteIdent).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const overriding = hasIdentity ? ' OVERRIDING SYSTEM VALUE' : '';
  const insertSql = `INSERT INTO public.${quoteIdent(table)} (${colList})${overriding} VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let inserted = 0;
  for (const row of rows) {
    try {
      const result = await newDb.query(insertSql, rowValues(row, columns, typeByCol));
      inserted += result.rowCount || 0;
    } catch (err) {
      console.error(`  ${table}: insert failed for id=${row.id ?? row.time ?? '?'}: ${err.message}`);
      throw err;
    }
  }
  console.log(`  ${table}: copied ${inserted}/${rows.length} rows`);
  return inserted;
}

async function grantAndPublish(newDb, table) {
  await newDb.query(
    `GRANT ALL ON TABLE public.${quoteIdent(table)} TO postgres, anon, authenticated, service_role`
  );
  await newDb.query(
    `ALTER TABLE public.${quoteIdent(table)} DISABLE ROW LEVEL SECURITY`
  ).catch(() => {});
  await newDb.query(
    `ALTER PUBLICATION supabase_realtime ADD TABLE public.${quoteIdent(table)}`
  ).catch(() => {});
}

async function addForeignKeys(oldDb, newDb, tables) {
  for (const table of tables) {
    const { rows } = await oldDb.query(
      `
      SELECT con.conname, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND con.contype = 'f'
      `,
      [table]
    );
    for (const fk of rows) {
      try {
        if (!dryRun) {
          await newDb.query(
            `ALTER TABLE public.${quoteIdent(table)} ADD CONSTRAINT ${quoteIdent(fk.conname)} ${fk.def}`
          );
        }
      } catch (e) {
        if (!/already exists/i.test(e.message)) {
          console.warn(`  ${table} FK ${fk.conname}: ${e.message}`);
        }
      }
    }
  }
}

async function resetSequences(newDb) {
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
}

async function main() {
  const oldDb = new Client({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newDb = new Client({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });
  await oldDb.connect();
  await newDb.connect();
  console.log(dryRun ? 'Dry run — no writes.' : 'Connected to old and new databases.');

  const oldTables = await listTables(oldDb);
  const newTables = await listTables(newDb);
  const newSet = new Set(newTables);
  const missing = oldTables.filter((t) => !newSet.has(t));
  const existing = oldTables.filter((t) => newSet.has(t));

  console.log(`Old tables: ${oldTables.length}`);
  console.log(`New tables: ${newTables.length}`);
  console.log(`Missing on new: ${missing.length}${missing.length ? `\n  ${missing.join('\n  ')}` : ''}`);

  const emptyExisting = [];
  for (const table of existing) {
    const [oldCount, newCount] = await Promise.all([
      tableCount(oldDb, table),
      tableCount(newDb, table),
    ]);
    if (newCount === 0 && oldCount > 0) {
      emptyExisting.push({ table, oldCount });
    }
  }
  if (emptyExisting.length) {
    console.log('Existing but empty on new (will backfill):');
    for (const row of emptyExisting) {
      console.log(`  ${row.table} (${row.oldCount} rows on old)`);
    }
  }

  await ensureEnums(oldDb, newDb, missing);

  let total = 0;
  for (const table of missing) {
    const cols = await getColumns(oldDb, table);
    console.log(`\nCreate ${table} (${cols.length} columns)`);
    await createTable(oldDb, newDb, table, cols);
    total += await copyRows(oldDb, newDb, table, cols);
    if (!dryRun) await grantAndPublish(newDb, table);
  }

  for (const { table } of emptyExisting) {
    const cols = await getColumns(oldDb, table);
    const newCols = await getColumns(newDb, table);
    const newColSet = new Set(newCols.map((c) => c.column_name));
    const shared = cols.filter((c) => newColSet.has(c.column_name));
    if (!shared.length) {
      console.warn(`  skip backfill ${table} (no shared columns)`);
      continue;
    }
    console.log(`\nBackfill ${table}`);
    total += await copyRows(oldDb, newDb, table, shared);
    if (!dryRun) await grantAndPublish(newDb, table);
  }

  if (!dryRun) {
    await addForeignKeys(oldDb, newDb, missing);
    await resetSequences(newDb);
    await newDb.query(`NOTIFY pgrst, 'reload schema'`).catch(() => {});
  }

  console.log(`\nDone. ${dryRun ? 'Would copy' : 'Copied'} ~${total} rows across ${missing.length} new tables.`);
  await oldDb.end();
  await newDb.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
