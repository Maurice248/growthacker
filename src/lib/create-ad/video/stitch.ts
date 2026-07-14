import { uploadVideoAd, publicStorageUrl } from '../supabase';
import { generateAdMetadata } from '../metadata';
import { requireToken } from '../tokens';
import type { CreateAdTokens, ReportData, VideoScene } from '../types';

const FALLBACK_BG_MUSIC =
  'https://coherent-rose-lecdwbodzs.edgeone.app/kontraa-attitude-hiphop-music-109789_lKRui2a6.mp3';

/** Upload Post FFmpeg API always uses `Authorization: Apikey <token>` (API key or JWT). */
function formatUploadPostAuth(token: string): string {
  const trimmed = token.trim();
  if (/^Apikey\s+/i.test(trimmed)) return trimmed.replace(/^ApiKey\s+/i, 'Apikey ');
  if (/^Bearer\s+/i.test(trimmed)) return `Apikey ${trimmed.replace(/^Bearer\s+/i, '')}`;
  return `Apikey ${trimmed}`;
}

const CLIP_DURATION = 4;
const SAFETY_BUFFER = 0.3;

export function buildFfmpegConcatBody(
  scenes: VideoScene[],
  audioUrl?: string,
  audioDuration?: number | null
) {
  const videoUrls = [...scenes]
    .sort((a, b) => a.scene - b.scene)
    .map((s) => s.video_url)
    .filter(Boolean) as string[];

  if (!videoUrls.length) {
    throw new Error('No video URLs found for stitching');
  }

  const resolvedAudio = audioUrl || FALLBACK_BG_MUSIC;
  const hasAudio = Boolean(resolvedAudio);
  const totalVideoDuration = videoUrls.length * CLIP_DURATION;

  let outputDuration: number;
  let padDuration = 0;

  if (audioDuration) {
    outputDuration = audioDuration + SAFETY_BUFFER;
    if (outputDuration > totalVideoDuration) {
      padDuration = outputDuration - totalVideoDuration;
    }
  } else {
    outputDuration = totalVideoDuration;
  }

  const videoInputFlags = videoUrls.map((_, i) => `-i {input${i}}`).join(' ');
  const audioInputFlag = hasAudio ? ` -i {input${videoUrls.length}}` : '';
  const inputs = `${videoInputFlags}${audioInputFlag}`;

  const filterParts: string[] = [];
  videoUrls.forEach((_, i) => {
    filterParts.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v${i}]`
    );
  });

  const concatInputs = videoUrls.map((_, i) => `[v${i}]`).join('');
  let concatPart = `${concatInputs}concat=n=${videoUrls.length}:v=1:a=0`;
  if (padDuration > 0) {
    concatPart += `,tpad=stop_mode=clone:stop_duration=${padDuration.toFixed(2)}`;
  }
  concatPart += `,format=yuv420p[v]`;
  filterParts.push(concatPart);

  const filterComplex = filterParts.join(',');
  const audioMap = hasAudio ? `-map ${videoUrls.length}:a ` : '';
  const audioEncode = hasAudio ? `-c:a aac -b:a 192k -ar 44100 -ac 2 ` : `-an `;

  const fullCommand =
    `ffmpeg -y ${inputs} ` +
    `-filter_complex "${filterComplex}" ` +
    `-map "[v]" ${audioMap}` +
    `-t ${outputDuration.toFixed(2)} ` +
    `-c:v libx264 -preset superfast -crf 23 ` +
    `${audioEncode}` +
    `-avoid_negative_ts make_zero ` +
    `-movflags +faststart {output}`;

  return {
    files: hasAudio ? [...videoUrls, resolvedAudio] : [...videoUrls],
    full_command: fullCommand,
    output_extension: 'mp4',
    meta: {
      clips_count: videoUrls.length,
      total_video_duration: totalVideoDuration,
      audio_duration: audioDuration,
      output_duration: outputDuration,
      pad_duration: padDuration,
    },
  };
}

async function submitUploadPostJob(
  uploadPostToken: string,
  concatBody: ReturnType<typeof buildFfmpegConcatBody>
): Promise<string> {
  const res = await fetch('https://api.upload-post.com/api/uploadposts/ffmpeg/jobs/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: formatUploadPostAuth(uploadPostToken),
    },
    body: JSON.stringify(concatBody),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`upload-post submit HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as { job_id?: string };
  if (!data.job_id) throw new Error('upload-post missing job_id');
  return data.job_id;
}

async function pollUploadPostJob(
  uploadPostToken: string,
  jobId: string,
  maxAttempts = 60,
  intervalMs = 15_000
): Promise<Buffer> {
  const auth = formatUploadPostAuth(uploadPostToken);

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`https://api.upload-post.com/api/uploadposts/ffmpeg/jobs/${jobId}`, {
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      throw new Error(`upload-post poll HTTP ${res.status}`);
    }

    const data = (await res.json()) as { status?: string };
    if ((data.status || '').toUpperCase() === 'FINISHED') {
      const dlRes = await fetch(
        `https://api.upload-post.com/api/uploadposts/ffmpeg/jobs/${jobId}/download`,
        {
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(120_000),
        }
      );
      if (!dlRes.ok) {
        throw new Error(`upload-post download HTTP ${dlRes.status}`);
      }
      return Buffer.from(await dlRes.arrayBuffer());
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('upload-post stitch timed out');
}

export async function stitchAndUploadVideo(
  companyId: string,
  tokens: CreateAdTokens,
  scenes: VideoScene[],
  reportData: ReportData,
  adsConfig: unknown,
  options: {
    audioUrl?: string;
    audioKey?: string;
    audioDuration?: number | null;
    fullScript?: string;
    itemId?: number;
  } = {}
) {
  const uploadPostToken = requireToken(tokens, 'uploadPost', 'Upload Post API token');
  const resolvedAudioUrl =
    options.audioUrl ||
    (options.audioKey
      ? publicStorageUrl('audio', options.audioKey.replace(/^audio\//, ''))
      : undefined);
  const concatBody = buildFfmpegConcatBody(scenes, resolvedAudioUrl, options.audioDuration);
  const jobId = await submitUploadPostJob(uploadPostToken, concatBody);
  const videoBuffer = await pollUploadPostJob(uploadPostToken, jobId);

  const metadataList = await generateAdMetadata(companyId, tokens, reportData, adsConfig);
  const meta = metadataList.find((m) => m.ad_id === options.itemId) || metadataList[0];

  const uploaded = await uploadVideoAd(
    companyId,
    videoBuffer,
    meta
      ? {
          ad_id: meta.ad_id,
          ad_type: meta.ad_type,
          ad_name: meta.ad_name,
          primary_text: meta.primary_text,
          headline: meta.headline,
          ad_description: meta.ad_description,
          destination_url: meta.destination_url,
        }
      : {},
    options.fullScript
  );

  return { ...uploaded, metadata: meta, jobId };
}
