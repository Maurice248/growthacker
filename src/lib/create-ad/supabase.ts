import { getSupabaseAdmin } from '@/lib/supabase-admin';

const AD_BUCKETS = ['AD1', 'AD2', 'AD3', 'AD4', 'AD5'] as const;

function projectUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

export function publicStorageUrl(bucket: string, path: string): string {
  return `${projectUrl()}/storage/v1/object/public/${bucket}/${path}`;
}

export async function uploadToStorage(
  bucket: string,
  path: string,
  data: Buffer | Blob | ArrayBuffer,
  contentType: string
): Promise<{ path: string; publicUrl: string }> {
  const supabase = getSupabaseAdmin();
  let body: Buffer;
  if (data instanceof Buffer) {
    body = data;
  } else if (data instanceof Blob) {
    body = Buffer.from(await data.arrayBuffer());
  } else {
    body = Buffer.from(new Uint8Array(data));
  }

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }

  return {
    path,
    publicUrl: publicStorageUrl(bucket, path),
  };
}

export async function downloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function pickAdBucket(companyId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase
    .from('your_name_table')
    .select('id')
    .eq('company_id', companyId)
    .order('time', { ascending: false })
    .limit(20);

  const usedIds = new Set((rows || []).map((r) => Number(r.id)));
  for (let i = 1; i <= 5; i++) {
    if (!usedIds.has(i)) return `AD${i}`;
  }
  return AD_BUCKETS[Math.floor(Math.random() * AD_BUCKETS.length)];
}

export function timestampedFilename(ext: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${date}_${time}.${ext}`;
}

export type AdTableInsert = {
  companyId: string;
  text: string;
  format: 'Image' | 'Video';
  jsonData?: Record<string, unknown>;
  story?: string;
  idCount?: number;
};

export async function insertAdTableRow(row: AdTableInsert) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('your_name_table')
    .insert({
      text: row.text,
      format: row.format,
      time: new Date().toISOString(),
      company_id: row.companyId,
      'json data': row.jsonData ? JSON.stringify(row.jsonData) : null,
      story: row.story || null,
      id_count: row.idCount ?? 2,
    })
    .select('id, text, time, format, Approved, "json data", company_id')
    .single();

  if (error) {
    throw new Error(`Failed to insert ad row: ${error.message}`);
  }

  return data;
}

export async function uploadImageAd(
  companyId: string,
  imageBuffer: Buffer,
  metadata: Record<string, unknown>
) {
  const bucket = await pickAdBucket(companyId);
  const filename = timestampedFilename('png');
  const { publicUrl } = await uploadToStorage(bucket, filename, imageBuffer, 'image/png');
  const row = await insertAdTableRow({
    companyId,
    text: publicUrl,
    format: 'Image',
    jsonData: metadata,
  });
  return { publicUrl, row, bucket, filename };
}

export async function uploadVideoAd(
  companyId: string,
  videoBuffer: Buffer,
  metadata: Record<string, unknown>,
  story?: string
) {
  const bucket = await pickAdBucket(companyId);
  const filename = timestampedFilename('mp4');
  const { publicUrl } = await uploadToStorage(bucket, filename, videoBuffer, 'video/mp4');
  const row = await insertAdTableRow({
    companyId,
    text: publicUrl,
    format: 'Video',
    jsonData: metadata,
    story,
    idCount: 1,
  });
  return { publicUrl, row, bucket, filename };
}

export async function uploadAudio(
  audioBuffer: Buffer
): Promise<{ publicUrl: string; key: string }> {
  const filename = timestampedFilename('mp3');
  const { publicUrl, path } = await uploadToStorage('audio', filename, audioBuffer, 'audio/mpeg');
  return { publicUrl, key: `audio/${path}` };
}
