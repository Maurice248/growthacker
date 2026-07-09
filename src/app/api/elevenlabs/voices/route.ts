import { NextResponse } from 'next/server';
import { getRequestCompanyId } from '@/lib/auth';
import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import { getRequestCompanyIntegrations } from '@/lib/company-integrations';

const FALLBACK_VOICES = [
  { voice_id: "pNInz6obpgq5pOtz5g1L", name: "Adam", gender: "male", accent: "American", language: "English", description: "Deep, crisp narrator voice - ideal for medical documentaries", preview_url: "" },
  { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "male", accent: "American", language: "English", description: "Well-rounded, warm, professional voice - great for commercials", preview_url: "" },
  { voice_id: "VR6A4UBq45PFod5iaaTO", name: "Arnold", gender: "male", accent: "American", language: "English", description: "High-energy, direct, standard voice - perfect for calls to action", preview_url: "" },
  { voice_id: "N2lVSClvYuuCQMC9bCoY", name: "Callum", gender: "male", accent: "American", language: "English", description: "Intense, professional, high-energy narrator", preview_url: "" },
  { voice_id: "KLoLpdGWK7agg0O2TJYg", name: "Charlie", gender: "male", accent: "Australian", language: "English", description: "Conversational, casual, friendly voice", preview_url: "" },
  { voice_id: "Xb7hH1LZJIfL3HHvffqe", name: "Alice", gender: "female", accent: "British", language: "English", description: "Confident, crisp, professional British female narrator", preview_url: "" },
  { voice_id: "XB0fDUncoYZZp8Rt8Rt8", name: "Charlotte", gender: "female", accent: "British", language: "English", description: "Sweet, soft storybook British female narrator", preview_url: "" },
  { voice_id: "XrExMAJxa2e7A53Ve1Zk", name: "Matilda", gender: "female", accent: "American", language: "English", description: "Smooth, warm, conversational storyteller style", preview_url: "" },
  { voice_id: "piTKgcLEGmPEe242Cchg", name: "Nicole", gender: "female", accent: "American", language: "English", description: "Calm, slow-paced standard narrator", preview_url: "" },
];

export async function GET() {
  const companyId = await getRequestCompanyId();
  const [secrets, creds] = await Promise.all([
    companyId ? getCompanyApiTokenSecrets(companyId) : Promise.resolve(null),
    getRequestCompanyIntegrations(),
  ]);
  const apiKey = secrets?.elevenLabs?.trim() || creds.elevenLabsApiKey?.trim();

  if (!apiKey) {
    console.log("[ElevenLabs] No API key found, using fallback list.");
    return NextResponse.json({ voices: FALLBACK_VOICES });
  }

  try {
    const allVoices: any[] = [];
    const pageSize = 100;
    const maxPages = 3; // 3 × 100 = up to 300 voices

    for (let page = 1; page <= maxPages; page++) {
      const url = new URL("https://api.elevenlabs.io/v1/shared-voices");
      url.searchParams.set("page_size", String(pageSize));
      url.searchParams.set("page", String(page));
      url.searchParams.set("sort", "trending");

      const response = await fetch(url.toString(), {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        next: { revalidate: 300 },
      });

      if (!response.ok) {
        console.warn(`[ElevenLabs] /v1/shared-voices page ${page} returned ${response.status}`);
        break;
      }

      const data = await response.json();
      const voices = data.voices || [];
      if (voices.length === 0) break;
      allVoices.push(...voices);
      if (voices.length < pageSize) break;
    }

    // Fallback to own library if shared-voices returned nothing
    if (allVoices.length === 0) {
      console.log("[ElevenLabs] shared-voices empty, trying /v1/voices as fallback...");
      const ownRes = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
        next: { revalidate: 300 },
      });
      if (ownRes.ok) {
        const ownData = await ownRes.json();
        allVoices.push(...(ownData.voices || []));
      }
    }

    const formattedVoices = allVoices.map((v: any) => {
      const gender =
        (v.labels?.gender || v.labels?.Gender || v.gender || "").toLowerCase() === "female"
          ? "female"
          : "male";

      const accent =
        v.labels?.accent || v.labels?.Accent || v.accent || "Global";

      const language =
        v.labels?.language || v.labels?.Language || v.language || "English";

      const description =
        v.description || v.labels?.description || v.labels?.use_case || `${accent} ${gender} voice`;

      return {
        voice_id: v.voice_id,
        name: v.name,
        gender,
        accent,
        language,
        description,
        preview_url: v.preview_url || "",
      };
    });

    console.log(`[ElevenLabs] Returning ${formattedVoices.length} voices from shared library.`);
    return NextResponse.json({ voices: formattedVoices });
  } catch (error: any) {
    console.error("[ElevenLabs] Error fetching voices:", error.message);
    return NextResponse.json({ voices: FALLBACK_VOICES });
  }
}
