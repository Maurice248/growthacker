const API = '/api/social-studio';

export async function fetchSocialConfig() {
  const res = await fetch(`${API}/config`);
  if (!res.ok) throw new Error('Failed to load social config');
  return res.json();
}

export async function fetchLatestJob(kind?: 'image' | 'video') {
  const qs = kind ? `?kind=${kind}` : '';
  const res = await fetch(`${API}/job${qs}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.job || null;
}

export async function fetchJobStatus() {
  const res = await fetch(`${API}/job?latest=status`);
  if (!res.ok) return 'Status unavailable';
  const data = await res.json();
  return data.status || 'Waiting for data...';
}

export async function generateImage(topic: string, ratio: string) {
  const res = await fetch(`${API}/image/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: topic, text: topic, ratio, aspect_ratio: ratio }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Image generation failed');
  return data as { jobId: string; taskId: string; imagePrompt: string };
}

export async function pollImage(jobId: string, taskId: string, topic: string) {
  const res = await fetch(`${API}/image/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, taskId, topic }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Image poll failed');
  return data;
}

export async function postImage(jobId: string, imageUrl: string, descriptions: Record<string, string>) {
  const res = await fetch(`${API}/image/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, image_url: imageUrl, descriptions }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Image post failed');
  return data;
}

export async function generateStory(input: Record<string, unknown>) {
  const res = await fetch(`${API}/video/story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Story generation failed');
  return data;
}

export async function retryStory(input: Record<string, unknown>) {
  const res = await fetch(`${API}/video/story/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Story retry failed');
  return data;
}

export async function acceptStory(input: Record<string, unknown>) {
  const res = await fetch(`${API}/video/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Scene generation failed');
  return data;
}

export async function startVideoRender(payload: Record<string, unknown>) {
  const res = await fetch(`${API}/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Video render failed');
  return data;
}

export async function pollVideoPhase(payload: Record<string, unknown>) {
  const res = await fetch(`${API}/video/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Video poll failed');
  return data;
}

export async function postVideo(jobId: string, videoUrl: string, descriptions: Record<string, string>, title?: string) {
  const res = await fetch(`${API}/video/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, video_url: videoUrl, descriptions, title }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Video post failed');
  return data;
}

export async function pollImageUntilDone(
  jobId: string,
  taskId: string,
  topic: string,
  maxAttempts = 30,
  intervalMs = 5000
) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await pollImage(jobId, taskId, topic);
    if (result.state === 'success') return result;
    if (result.state === 'fail' || result.state === 'failed') {
      throw new Error('Image generation failed');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Image generation timed out');
}

export async function pollKiePhase(
  pollFn: () => Promise<{ complete?: boolean; failures?: Array<{ failMsg?: string }>; failed?: boolean; error?: string }>,
  maxAttempts = 60,
  intervalMs = 5000
) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await pollFn();
    if (result.failed) {
      throw new Error(result.error || result.failures?.[0]?.failMsg || 'Generation failed');
    }
    if (result.failures?.length) {
      throw new Error(result.failures[0]?.failMsg || 'Generation failed');
    }
    if (result.complete) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Generation timed out');
}

/** Poll Upload Post FFmpeg stitch with longer defaults for multi-scene videos. */
export async function pollStitchPhase(
  pollFn: () => Promise<{ complete?: boolean; failed?: boolean; error?: string }>,
  maxAttempts = 120,
  intervalMs = 10_000
) {
  return pollKiePhase(pollFn, maxAttempts, intervalMs);
}
