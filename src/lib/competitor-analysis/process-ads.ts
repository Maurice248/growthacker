import { formatCtaLabel } from '@/lib/ads-library/view-ads';
import type { ProcessedAdsResult } from './types';

export type ProcessScrapedAdsOptions = {
  /** Ads Library ingest: keep more rows; relax hook template filtering. */
  libraryMode?: boolean;
};

// Ported from legacy ad processor workflow — Ad Processor node
export function processScrapedAds(
  raw: unknown,
  relevanceTerms: string[] = [],
  options?: ProcessScrapedAdsOptions
): ProcessedAdsResult {
  const ads: Record<string, unknown>[] = [];

  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    const b = item as Record<string, unknown>;
    if (Array.isArray(b)) ads.push(...(b as Record<string, unknown>[]));
    else if (Array.isArray(b?.results)) ads.push(...(b.results as Record<string, unknown>[]));
    else if (Array.isArray(b?.data)) ads.push(...(b.data as Record<string, unknown>[]));
    else if (b) ads.push(b);
  }

  const RELEVANT = relevanceTerms.length
    ? new RegExp(
        relevanceTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
        'i'
      )
    : null;
  const SKIP_HOOK = /\{\{|\[object Object\]|^instagram\.?com?$/i;

  function extractText(val: unknown): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    const obj = val as Record<string, unknown>;
    const markup = obj?.markup as Record<string, unknown> | undefined;
    if (markup?.['__html']) return String(markup['__html']);
    if (obj?.text) return String(obj.text);
    if (obj?.paragraph_text) return String(obj.paragraph_text);
    for (const k of ['content', 'message', 'description', 'copy']) {
      if (typeof obj[k] === 'string') return obj[k] as string;
    }
    return '';
  }

  function clean(val: unknown): string {
    return extractText(val)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  const safe = (v: unknown) => (!v ? '' : typeof v === 'string' ? v.trim() : String(v));

  const topN = (arr: string[], n = 5) => {
    const f: Record<string, number> = {};
    arr.forEach((v) => v && (f[v] = (f[v] || 0) + 1));
    return Object.entries(f)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([val, count]) => ({ val, count }));
  };

  function getType(ad: Record<string, unknown>) {
    const s = (ad.snapshot || {}) as Record<string, unknown>;
    const cards = (s.cards || []) as unknown[];
    const videos = (s.videos || []) as unknown[];
    const images = (s.images || []) as unknown[];
    if (cards.length > 1) return 'carousel';
    if (videos.length > 0) return 'video';
    if (images.length > 0) return 'image';
    return 'text';
  }

  function getCopy(ad: Record<string, unknown>) {
    const s = (ad.snapshot || {}) as Record<string, unknown>;
    const cards = (s.cards || []) as Record<string, unknown>[];
    const body = clean(s.body || s.message || s.description || '');
    const headline = clean(s.title || s.headline || cards[0]?.title || cards[0]?.body || '');
    const cta = formatCtaLabel(
      safe(s.cta_text || s.cta_type || cards[0]?.cta_text || cards[0]?.cta_type || '')
    );
    const caption = clean(s.caption || s.link_description || '');
    const source = headline || body || caption;
    const hook = source.split(/[.!?\n]/)[0].substring(0, 150).trim();
    const full = [headline, body, caption].filter(Boolean).join(' ').trim();
    return { body, headline, cta, caption, hook, full };
  }

  function getFramework(text: string) {
    const t = text.toLowerCase();
    const h = (r: RegExp) => r.test(t);
    const problem = h(/bad tenant|eviction|late rent|missed payment|damage|vacancy|empty unit|nightmare|risk|default|skip/);
    const solution = h(/solution|screen|verify|check|report|protect|we handle|get started|sign up|start screening/);
    const proof = h(/trusted|verified|certified|landlords|reviews|★|stars|rated|award|thousands|proven/);
    const urgency = h(/limited|only|today|now|hurry|last|few spots|this month|slots|filling fast|vacant/);
    const savings = h(/save|saving|affordable|only \$\d+|\$\d+|fraction|vs eviction|cost of eviction/);
    const cta = h(/sign up|start|get report|register|apply|click|visit|try|free trial|get started/);
    if (savings && cta) return 'Cost-Savings';
    if (problem && solution && cta) return 'PAS';
    if (proof && cta) return 'HSC';
    if (urgency && cta) return 'HUC';
    if (cta) return 'Direct';
    return 'Awareness';
  }

  function getAngles(text: string) {
    const t = text.toLowerCase();
    const out: string[] = [];
    if (/save|saving|affordable|only \$\d+|\$\d+|fraction|vs eviction|cost of eviction/i.test(t)) out.push('cost-savings');
    if (/trusted|verified|certified|proven|landlords|reviews|★|4\.\d|5\.0/i.test(t)) out.push('trust/proof');
    if (/limited|only|today|now|hurry|last chance|few slots|this month|filling fast|vacant/i.test(t)) out.push('urgency');
    if (/safe|secure|protect|reduce risk|peace of mind|reliable income/i.test(t)) out.push('safety');
    if (/find|select|best tenant|reliable tenant|peace of mind|stress.free|confident/i.test(t)) out.push('transformation');
    if (/before|after|horror story|nightmare|success story|result/i.test(t)) out.push('before/after');
    if (/full package|protection|rent promise|guarantee|coverage|all.inclusive|we handle/i.test(t)) out.push('protection/package');
    if (/canada|ontario|bc|alberta|toronto|vancouver|calgary|canadian|landlord/i.test(t)) out.push('local/canada');
    if (/worried|afraid|scared|nightmare|what if|bad tenant|eviction fear/i.test(t)) out.push('fear-removal');
    if (/credit|credit report|credit check|credit score/i.test(t)) out.push('credit-check');
    if (/background|criminal|eviction history|screening|tenant check/i.test(t)) out.push('background-screening');
    return out.length ? out : ['general'];
  }

  function scoreAd(copy: ReturnType<typeof getCopy>, type: string) {
    let s = 0;
    if (copy.headline.length > 5) s += 2;
    if (copy.body.length > 30) s += 2;
    if (copy.cta.length > 0) s += 2;
    if (type === 'video') s += 3;
    if (type === 'carousel') s += 2;
    if (copy.body.length > 100) s += 1;
    if (/\$\d+|\d+%/.test(copy.full)) s += 1;
    if (/trusted|verified|certified|landlords/i.test(copy.full)) s += 1;
    if (/free trial|get started|sign up|start screening/i.test(copy.full)) s += 1;
    if (/canada|ontario|bc|alberta|landlord/i.test(copy.full)) s += 1;
    return { score: s, label: s >= 11 ? 'strong' : s >= 7 ? 'moderate' : 'weak' };
  }

  function fmtDate(ts: unknown) {
    if (!ts) return 'unknown';
    try {
      return new Date(typeof ts === 'number' ? (ts as number) * 1000 : String(ts)).toISOString().split('T')[0];
    } catch {
      return 'unknown';
    }
  }

  function getMedia(ad: Record<string, unknown>) {
    const s = (ad.snapshot || {}) as Record<string, unknown>;
    const imgs = ((s.images || []) as Record<string, unknown>[])
      .map((i) => i.original_image_url || i.resized_image_url || i.url)
      .filter(Boolean) as string[];
    const thumbs = ((s.videos || []) as Record<string, unknown>[])
      .map((v) => v.video_preview_image_url || v.thumbnail)
      .filter(Boolean) as string[];
    return { image_url: imgs[0] || thumbs[0] || '', has_video: ((s.videos || []) as unknown[]).length > 0 };
  }

  function parseImpressionToken(token: string): number | null {
    const t = token.trim().replace(/,/g, '');
    if (!t) return null;
    const m = t.match(/^([\d.]+)\s*([KkMm])?$/);
    if (!m) return null;
    let n = parseFloat(m[1]);
    if (Number.isNaN(n)) return null;
    const suffix = (m[2] || '').toUpperCase();
    if (suffix === 'K') n *= 1000;
    else if (suffix === 'M') n *= 1_000_000;
    return Math.round(n);
  }

  function getImpressions(ad: Record<string, unknown>): {
    text: string | null;
    min: number | null;
    max: number | null;
  } {
    const withIndex = ad.impressions_with_index as Record<string, unknown> | undefined;
    const textFromIndex = withIndex?.impressions_text;
    if (typeof textFromIndex === 'string' && textFromIndex.trim()) {
      const text = textFromIndex.trim();
      const range = text.split(/\s*[-–—]\s*/);
      if (range.length >= 2) {
        const lo = parseImpressionToken(range[0]);
        const hi = parseImpressionToken(range[1]);
        if (lo != null && hi != null) return { text, min: lo, max: hi };
        if (lo != null) return { text, min: lo, max: lo };
      }
      const single = parseImpressionToken(text);
      if (single != null) return { text, min: single, max: single };
      return { text, min: null, max: null };
    }

    const imp = ad.impressions as Record<string, unknown> | undefined;
    if (imp) {
      const lo = imp.lower_bound != null ? parseInt(String(imp.lower_bound), 10) : null;
      const hi = imp.upper_bound != null ? parseInt(String(imp.upper_bound), 10) : null;
      const loOk = lo != null && !Number.isNaN(lo);
      const hiOk = hi != null && !Number.isNaN(hi);
      if (loOk || hiOk) {
        const min = loOk ? lo : hi;
        const max = hiOk ? hi : lo;
        const text =
          loOk && hiOk && lo !== hi ? `${lo} - ${hi}` : String(max ?? min ?? '');
        return { text, min: min ?? null, max: max ?? null };
      }
    }

    const total = ad.total_impressions;
    if (total != null && total !== '') {
      const n = typeof total === 'number' ? total : parseInt(String(total), 10);
      if (!Number.isNaN(n)) {
        return { text: String(n), min: n, max: n };
      }
    }

    return { text: null, min: null, max: null };
  }

  const processed: Record<string, unknown>[] = [];
  const pages: Record<string, Record<string, unknown>> = {};
  const skipped = { deleted: 0, irrelevant: 0, template: 0 };

  for (const ad of ads) {
    if (ad.page_is_deleted || ad.page_is_restricted) {
      skipped.deleted++;
      continue;
    }

    const snapshot = (ad.snapshot || {}) as Record<string, unknown>;
    const pageName = safe(ad.page_name || ad.advertiser_name || 'Unknown');
    const adText = [safe(snapshot.body || ''), safe(snapshot.title || ''), safe(snapshot.description || ''), pageName].join(' ');
    if (RELEVANT && !RELEVANT.test(adText)) {
      skipped.irrelevant++;
      continue;
    }

    const copy = getCopy(ad);
    if (options?.libraryMode) {
      if (SKIP_HOOK.test(copy.hook) || copy.hook.length < 3) {
        const fallback = copy.headline || copy.body.slice(0, 150).trim() || pageName;
        if (fallback.length >= 3) copy.hook = fallback;
      }
    }
    if (SKIP_HOOK.test(copy.hook) || copy.hook.length < 3) {
      skipped.template++;
      continue;
    }

    const type = getType(ad);
    const fw = getFramework(copy.full);
    const angles = getAngles(copy.full);
    const str = scoreAd(copy, type);
    const media = getMedia(ad);
    const impressions = getImpressions(ad);

    const item = {
      ad_id: safe(ad.ad_archive_id || ad.id),
      page_name: pageName,
      page_url: safe(ad.page_profile_uri || ''),
      ad_type: type,
      start_date: fmtDate(ad.start_date || ad.ad_creation_time),
      platforms: Array.isArray(ad.publisher_platforms)
        ? (ad.publisher_platforms as string[]).join(', ')
        : safe(ad.publisher_platforms || 'facebook'),
      copy: {
        hook: copy.hook,
        headline: copy.headline,
        body: copy.body.substring(0, 500),
        cta: copy.cta,
        caption: copy.caption,
      },
      script: {
        framework: fw,
        est_read_time: `~${Math.round((copy.full.split(/\s+/).length / 130) * 60)}s`,
        has_urgency: /limited|only|today|now|hurry|this month|slots|vacant/i.test(copy.full),
        has_proof: /trusted|verified|certified|landlords|reviews|★/i.test(copy.full),
        has_savings: /save|saving|\d+%|affordable|\$\d+|only \$/i.test(copy.full),
        has_cta: /sign up|start|get report|register|apply|get started|free trial/i.test(copy.full),
        has_local: /canada|ontario|bc|alberta|toronto|vancouver|calgary|landlord/i.test(copy.full),
      },
      angles,
      hashtags: (copy.full.match(/#\w+/g) || []).slice(0, 5),
      strength: str.label,
      score: str.score,
      image_url: media.image_url,
      has_video: media.has_video,
      impressions_text: impressions.text,
      impressions_min: impressions.min,
      impressions_max: impressions.max,
      raw: (ad.actor_payload as Record<string, unknown> | undefined) ?? ad,
    };

    processed.push(item);

    if (!pages[pageName]) {
      pages[pageName] = {
        name: pageName,
        url: safe(ad.page_profile_uri || ''),
        ads: [] as Record<string, unknown>[],
        hooks: [] as string[],
        ctas: [] as string[],
        angles: [] as string[],
        fws: [] as string[],
        tags: [] as string[],
      };
    }
    const p = pages[pageName];
    (p.ads as Record<string, unknown>[]).push(item);
    if (copy.hook) (p.hooks as string[]).push(copy.hook);
    if (copy.cta) (p.ctas as string[]).push(copy.cta);
    (p.angles as string[]).push(...angles);
    (p.fws as string[]).push(fw);
    (p.tags as string[]).push(...(item.hashtags as string[]));
  }

  const competitors = Object.values(pages)
    .map((p) => {
      const pAds = [...(p.ads as Record<string, unknown>[])].sort(
        (a, b) => (b.score as number) - (a.score as number)
      );
      const best = pAds[0] as Record<string, unknown> | undefined;
      const bestCopy = (best?.copy || {}) as Record<string, unknown>;
      const bestScript = (best?.script || {}) as Record<string, unknown>;
      return {
        page_name: p.name,
        page_url: p.url,
        total_ads: (p.ads as unknown[]).length,
        video_ads: (p.ads as Record<string, unknown>[]).filter((a) => a.ad_type === 'video').length,
        image_ads: (p.ads as Record<string, unknown>[]).filter((a) => a.ad_type === 'image').length,
        carousel_ads: (p.ads as Record<string, unknown>[]).filter((a) => a.ad_type === 'carousel').length,
        dominant_angle: topN(p.angles as string[], 1)[0]?.val || 'general',
        top_framework: topN(p.fws as string[], 1)[0]?.val || 'Awareness',
        top_hooks: [...new Set(p.hooks as string[])].slice(0, 3),
        top_ctas: [...new Set(p.ctas as string[])].slice(0, 3),
        top_hashtags: [...new Set(p.tags as string[])].slice(0, 6),
        uses_savings: (p.ads as Record<string, unknown>[]).some((a) => (a.script as Record<string, unknown>)?.has_savings),
        uses_proof: (p.ads as Record<string, unknown>[]).some((a) => (a.script as Record<string, unknown>)?.has_proof),
        uses_local: (p.ads as Record<string, unknown>[]).some((a) => (a.script as Record<string, unknown>)?.has_local),
        uses_urgency: (p.ads as Record<string, unknown>[]).some((a) => (a.script as Record<string, unknown>)?.has_urgency),
        best_ad: best
          ? {
              hook: bestCopy.hook,
              headline: bestCopy.headline,
              body: bestCopy.body,
              cta: bestCopy.cta,
              framework: bestScript.framework,
              duration: bestScript.est_read_time,
              angles: best.angles,
              score: best.score,
              image_url: best.image_url,
            }
          : null,
      };
    })
    .sort((a, b) => b.total_ads - a.total_ads);

  const total = processed.length;
  const videos = processed.filter((a) => a.ad_type === 'video').length;
  const images = processed.filter((a) => a.ad_type === 'image').length;
  const carousels = processed.filter((a) => a.ad_type === 'carousel').length;

  const allAngles = processed.flatMap((a) => a.angles as string[]);
  const allFWs = processed.map((a) => (a.script as Record<string, unknown>).framework as string);
  const allCTAs = processed.map((a) => (a.copy as Record<string, unknown>).cta as string).filter(Boolean);
  const allTags = processed.flatMap((a) => a.hashtags as string[]);

  const gaps = {
    low_video_usage: total > 0 && videos / total < 0.3,
    no_urgency_ads: !processed.some((a) => (a.script as Record<string, unknown>).has_urgency),
    no_proof_signals: !processed.some((a) => (a.script as Record<string, unknown>).has_proof),
    no_before_after: !processed.some((a) => (a.angles as string[]).includes('before/after')),
    no_trust_proof: !processed.some((a) => (a.angles as string[]).includes('trust/proof')),
    no_savings_messaging: !processed.some((a) => (a.script as Record<string, unknown>).has_savings),
    no_fear_removal: !processed.some((a) => (a.angles as string[]).includes('fear-removal')),
    no_carousel: carousels === 0,
    no_transformation_story: !processed.some((a) => (a.angles as string[]).includes('transformation')),
  };

  return {
    meta: {
      generated_at: new Date().toISOString(),
      total_scraped: ads.length,
      total_relevant: total,
      total_competitors: competitors.length,
      skipped,
    },
    summary: {
      formats: {
        video: videos,
        image: images,
        carousel: carousels,
        text: total - videos - images - carousels,
        video_pct: total > 0 ? `${Math.round((videos / total) * 100)}%` : '0%',
        carousel_pct: total > 0 ? `${Math.round((carousels / total) * 100)}%` : '0%',
      },
      top_angles: topN(allAngles),
      top_frameworks: topN(allFWs),
      top_ctas: topN(allCTAs),
      top_hashtags: topN(allTags, 8),
      gaps,
    },
    competitors,
    top_ads: [...processed]
      .sort((a, b) => (b.score as number) - (a.score as number))
      .slice(0, 5)
      .map((a) => {
        const copy = a.copy as Record<string, unknown>;
        const script = a.script as Record<string, unknown>;
        return {
          page: a.page_name,
          type: a.ad_type,
          hook: copy.hook,
          headline: copy.headline,
          body: copy.body,
          cta: copy.cta,
          framework: script.framework,
          duration: script.est_read_time,
          angles: a.angles,
          score: a.score,
          image_url: a.image_url,
        };
      }),
    all_ads: processed as ProcessedAdsResult['all_ads'],
  };
}

export function trimForGptInput(d: ProcessedAdsResult) {
  return {
    meta: d.meta,
    summary: {
      formats: d.summary.formats,
      top_angles: d.summary.top_angles,
      top_frameworks: d.summary.top_frameworks,
      top_ctas: d.summary.top_ctas,
      top_hashtags: d.summary.top_hashtags,
      gaps: d.summary.gaps,
    },
    competitors: (d.competitors || []).slice(0, 10).map((c) => {
      const comp = c as Record<string, unknown>;
      const bestAd = comp.best_ad as Record<string, unknown> | null;
      return {
        page_name: comp.page_name,
        total_ads: comp.total_ads,
        video_ads: comp.video_ads,
        image_ads: comp.image_ads,
        carousel_ads: comp.carousel_ads,
        dominant_angle: comp.dominant_angle,
        top_framework: comp.top_framework,
        top_hooks: comp.top_hooks,
        top_ctas: comp.top_ctas,
        uses_savings: comp.uses_savings,
        uses_proof: comp.uses_proof,
        uses_local: comp.uses_local,
        uses_urgency: comp.uses_urgency,
        best_ad: bestAd
          ? {
              hook: bestAd.hook,
              headline: bestAd.headline,
              body: typeof bestAd.body === 'string' ? bestAd.body.substring(0, 300) : bestAd.body,
              cta: bestAd.cta,
              framework: bestAd.framework,
              angles: bestAd.angles,
              score: bestAd.score,
            }
          : null,
      };
    }),
    top_ads: (d.top_ads || []).slice(0, 5).map((a) => {
      const ad = a as Record<string, unknown>;
      return {
        page: ad.page,
        type: ad.type,
        hook: ad.hook,
        headline: ad.headline,
        body: typeof ad.body === 'string' ? ad.body.substring(0, 300) : ad.body,
        cta: ad.cta,
        framework: ad.framework,
        angles: ad.angles,
        score: ad.score,
      };
    }),
    gaps: d.summary?.gaps || {},
  };
}
