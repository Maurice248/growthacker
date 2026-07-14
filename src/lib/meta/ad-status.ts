export async function pauseMetaAd(accessToken: string, metaAdId: string) {
  const url = `https://graph.facebook.com/v21.0/${metaAdId}?status=PAUSED&access_token=${accessToken}`;
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to pause ad');
}

export async function activateMetaAd(accessToken: string, metaAdId: string) {
  const url = `https://graph.facebook.com/v21.0/${metaAdId}?status=ACTIVE&access_token=${accessToken}`;
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to activate ad');
}

export async function deleteMetaAd(accessToken: string, metaAdId: string) {
  const url = `https://graph.facebook.com/v21.0/${metaAdId}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to delete ad');
}

export async function renameMetaAd(accessToken: string, metaAdId: string, name: string) {
  const url = `https://graph.facebook.com/v21.0/${metaAdId}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to rename ad');
}
