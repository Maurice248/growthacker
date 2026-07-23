"use client";

import React, { useState, useEffect, useRef } from 'react';
import CustomSelect from './CustomSelect';
import { createPortal } from 'react-dom';
import {
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Activity,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';

import {
  Spinner,
  EditorialPage,
  EditorialPageHeader,
  EditorialSectionHeader,
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
  EditorialPillButton,
  EditorialTextLink,
  EditorialTabBar,
  EditorialStatusPill,
} from './components';
import {
  acceptStory,
  fetchJobStatus,
  fetchLatestJob,
  fetchSocialConfig,
  generateImage,
  generateStory,
  pollImageUntilDone,
  pollKiePhase,
  pollStitchPhase,
  pollVideoPhase,
  postImage,
  postVideo,
  retryStory,
  startVideoRender,
} from '@/lib/social-studio/client-api';
import GeneratorModal from './GeneratorModal';
import RetryModal from './RetryModal';
import ImagePromptModal from './ImagePromptModal';
import VoiceExplorerModal from './VoiceExplorerModal';

const VOICE_OPTIONS = {
  male: [
    { id: "KLoLpdGWK7agg0O2TJYg", label: "Charlie - Men" },
    { id: "eqz5FuihuZwmJPuvZ65E", label: "Jess - Men" }
  ],
  female: [
    { id: "wrxvN1LZJIfL3HHvffqe", label: "Bella - Lady" },
    { id: "odyUrTN5HMVKujvVAgWW", label: "Emily - Lady" },
    { id: "aD6riP1btT197c6dACmy", label: "Rachel - Lady" },
    { id: "KClAuq9Hs0wFY7oJmaGN", label: "Maayan - Lady" }
  ]
};

const medicalBlue = "#003049";
const medicalTeal = "#669BBC";

const DEFAULT_BRAND_HANDLE = "brand";
const DEFAULT_BRAND_NAME = "Your Brand";
const DEFAULT_BRAND_LOGO = "/tenant-report-logo.png";
const DEFAULT_BRAND_DOMAIN = "yourbrand.com";

const SAMPLE_SOCIAL_FALLBACK = {
  instagram:
    "What Landlords Wish They Knew Before Their Next Tenant Move-In 🏠\n\nChoosing the wrong tenant can cost thousands in missed rent and legal headaches. Tenant Report AI changed how I screen applicants — AI-powered reliability scoring, comprehensive background and credit reports, and rent protection guarantees, all in one affordable platform. No more guesswork. No more sleepless nights wondering if the next applicant will pay on time. Tenant Report AI helped me screen smarter, reduce risk, and protect my rental income with confidence. Visit Tenant Report AI to learn more\n\n.\n.\n.\n#TenantScreening #LandlordLife #PropertyManagement #RentalIncome #CanadianLandlords #TenantReportAI #BackgroundCheck #RentProtection #RealEstateInvesting",
  facebook:
    "What Landlords Wish They Knew Before Their Next Tenant Move-In 🏠\n\nChoosing the wrong tenant can cost thousands in missed rent and legal headaches. Tenant Report AI changed how I screen applicants — AI-powered reliability scoring, comprehensive background and credit reports, and rent protection guarantees, all in one affordable platform. No more guesswork. No more sleepless nights wondering if the next applicant will pay on time. Tenant Report AI helped me screen smarter, reduce risk, and protect my rental income with confidence. Visit Tenant Report AI to learn more\n\n#TenantScreening #LandlordLife #PropertyManagement #RentalIncome #CanadianLandlords #TenantReportAI #BackgroundCheck #RentProtection #RealEstateInvesting",
  tiktok:
    "What Landlords Wish They Knew Before Their Next Tenant Move-In 🏠\n\n#TenantScreening #LandlordTips #RentalProperty",
  linkedin:
    "What Landlords Wish They Knew Before Their Next Tenant Move-In 🏠\n\nChoosing the wrong tenant can cost thousands in missed rent and legal headaches. Tenant Report AI changed how I screen applicants — AI-powered reliability scoring, comprehensive background and credit reports, and rent protection guarantees, all in one affordable platform. Tenant Report AI helped me screen smarter, reduce risk, and protect my rental income with confidence.\n\n#TenantScreening #LandlordLife #PropertyManagement #CanadianLandlords #TenantReportAI #BackgroundCheck #RentProtection",
  twitter:
    "What Landlords Wish They Knew Before Their Next Tenant Move-In 🏠\n\nStop guessing on applicants — Tenant Report AI screens smarter! #TenantScreening #CanadianLandlords",
};

const SAMPLE_VIDEO_FALLBACK = {
  title: "Screen Tenants Smarter with Tenant Report AI 🏠",
  caption:
    "Stop risking missed rent — screen applicants with AI-powered reliability scoring, background checks, and rent protection. #TenantScreening #LandlordTips #TenantReportAI",
  description:
    "Welcome to Tenant Report AI! Discover affordable AI-powered tenant screening with background checks, credit reports, and rent protection for Canadian landlords.",
};

const LANDLORD_HASHTAGS = [
  "#TenantReportAI",
  "#TenantScreening",
  "#LandlordTips",
  "#RentalIncome",
  "#CanadianLandlords",
];

const VIDEO_PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X (Twitter)",
};

const IMAGE_PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  twitter: "X (Twitter)",
};

const editorialDurationInputStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 20,
  fontWeight: 700,
  padding: "4px 0",
  border: "none",
  borderBottom: "1px solid #C2B79A",
  background: "transparent",
  color: "#003049",
  outline: "none",
  width: 64,
};

function brandInitials(handle: string, name: string): string {
  const src = (handle || name || "BR").replace(/^@/, "");
  return src.slice(0, 2).toUpperCase() || "BR";
}

function formatDurationBadge(duration: string | number): string {
  const sec = typeof duration === "number" ? duration : parseInt(String(duration), 10) || 30;
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `0:${String(sec).padStart(2, "0")}`;
}

function extractHashtags(text: string): string {
  const tags = text.match(/#[\w]+/g);
  return tags ? tags.join(" ") : "";
}

function parseDescriptions(rawDescriptions: any) {
  try {
    const desc = typeof rawDescriptions === 'string'
      ? JSON.parse(rawDescriptions)
      : rawDescriptions;

    let instagram = "", facebook = "", tiktok = "", linkedin = "", twitter = "", supabaseTitle = "";

    const hasNested = desc.instagram || desc.facebook || desc.tiktok || desc.linkedin || desc.twitter ||
                      desc.Instagram || desc.Facebook || desc.Tiktok || desc.Linkedin || desc.Twitter;

    if (hasNested) {
      const instaObj = desc.instagram || desc.Instagram || {};
      const fbObj = desc.facebook || desc.Facebook || {};
      const ttObj = desc.tiktok || desc.Tiktok || {};
      const liObj = desc.linkedin || desc.Linkedin || {};
      const twObj = desc.twitter || desc.Twitter || {};
      instagram = instaObj.content || instaObj.caption || instaObj.title || "";
      facebook = fbObj.content || fbObj.caption || fbObj.title || "";
      tiktok = ttObj.caption || ttObj.content || ttObj.title || "";
      linkedin = liObj.content || liObj.caption || liObj.title || "";
      twitter = twObj.content || twObj.caption || twObj.title || "";
      supabaseTitle = fbObj.title || instaObj.title || desc.video_title || "";
    } else {
      const caption = desc.caption || '';
      const post = desc.post || '';
      const tags = desc.tags || '';
      const title = desc.video_title || '';
      supabaseTitle = title || caption;
      instagram = [caption, tags].filter(Boolean).join('\n\n');
      facebook = [post, tags].filter(Boolean).join('\n\n');
      tiktok = caption;
      linkedin = [post, tags].filter(Boolean).join('\n\n');
      twitter = caption;
    }

    return { supabaseTitle, socialDescriptions: { instagram, facebook, tiktok, linkedin, twitter } };
  } catch {
    const descStr = typeof rawDescriptions === 'object' ? JSON.stringify(rawDescriptions) : String(rawDescriptions);
    return {
      supabaseTitle: descStr,
      socialDescriptions: { instagram: descStr, facebook: descStr, tiktok: descStr, linkedin: descStr, twitter: descStr }
    };
  }
}

const findScenesRecursively = (obj: any): any[] => {
  if (!obj) return [];
  let allScenes: any[] = [];
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      allScenes = allScenes.concat(findScenesRecursively(item));
    }
  } else if (typeof obj === 'object') {
    if (obj.scenes && Array.isArray(obj.scenes)) {
      allScenes = allScenes.concat(obj.scenes);
    }
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && key !== 'scenes') {
        allScenes = allScenes.concat(findScenesRecursively(obj[key]));
      }
    }
  }
  return allScenes;
};

interface ToastState {
  message: string;
  type: string;
}

export default function SocialDash() {
  const [brandHandle, setBrandHandle] = useState(DEFAULT_BRAND_HANDLE);
  const [brandName, setBrandName] = useState(DEFAULT_BRAND_NAME);
  const [brandLogo] = useState(DEFAULT_BRAND_LOGO);
  const [brandDomain, setBrandDomain] = useState(DEFAULT_BRAND_DOMAIN);
  const [currentImageJobId, setCurrentImageJobId] = useState<string | null>(null);
  const [currentVideoJobId, setCurrentVideoJobId] = useState<string | null>(null);
  const [videoAudioUrl, setVideoAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [supabaseVideoUrl, setSupabaseVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [isVideoPosting, setIsVideoPosting] = useState<boolean>(false);
  const [isImagePosting, setIsImagePosting] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<string>("Loading...");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showRetryModal, setShowRetryModal] = useState<boolean>(false);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [generatedStory, setGeneratedStory] = useState<string | null>(null);
  const [generatedScenes, setGeneratedScenes] = useState<any[]>([]);
  const [sceneFailures, setSceneFailures] = useState<Record<number, { msg: string; column: 'image' | 'video' }>>({}); // 0-based idx → { msg, column }
  const [acceptedStory, setAcceptedStory] = useState<string | null>(null);
  const [lastInputs, setLastInputs] = useState<any>(null);
  const [videoFormData, setVideoFormData] = useState<{
    character: string;
    category: string;
    description: string;
    videoStyle: string;
    language: string;
    voice: string;
    backgroundSong: string;
    duration: string | number;
  }>({
    character: "male",
    category: "Tenant Screening",
    description: "",
    videoStyle: "Highly Realistic 4k, real life",
    language: "English",
    voice: "KLoLpdGWK7agg0O2TJYg",
    backgroundSong: "Inspirational - Sunrise Bloom",
    duration: 30
  });
  const [imagePrompt, setImagePrompt] = useState<string>("");
  const [imageRatio, setImageRatio] = useState<'16:9' | '9:16'>('16:9');
  const [progress, setProgress] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationType, setGenerationType] = useState<'video' | 'images' | null>(null);
  const prevStatusRef = useRef<string | undefined>(undefined); // tracks previous status to detect transitions
  const hasTriggeredInSession = useRef<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [voiceLabel, setVoiceLabel] = useState<string>("Charlie - Men");

  // ── Social Image Workspace States ──
  const [showImageWorkspace, setShowImageWorkspace] = useState<boolean>(true);
  const [creatorStudioView, setCreatorStudioView] = useState<'video' | 'image'>('video');
  const [isImageGenerating, setIsImageGenerating] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [generatedSocialImage, setGeneratedSocialImage] = useState<string | null>(null);
  const [supabaseImageUrl, setSupabaseImageUrl] = useState<string | null>(null);
  const [supabaseDescription, setSupabaseDescription] = useState<string>('');
  const [socialDescriptions, setSocialDescriptions] = useState<{
    instagram: string;
    facebook: string;
    tiktok: string;
    linkedin: string;
    twitter: string;
  }>({
    instagram: "",
    facebook: "",
    tiktok: "",
    linkedin: "",
    twitter: ""
  });
  const [activePlatform, setActivePlatform] = useState<'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'twitter'>('instagram');
  const [showSocialRetryModal, setShowSocialRetryModal] = useState<boolean>(false);

  const [videoMetadata, setVideoMetadata] = useState<{
    instagram?: { title?: string; content?: string; char_count?: number };
    facebook?: { title?: string; content?: string; char_count?: number };
    linkedin?: { title?: string; content?: string; char_count?: number };
    tiktok?: { title?: string; caption?: string; description?: string; char_count?: number };
    youtube?: { title?: string; description?: string; char_count?: number };
    twitter?: { content?: string; char_count?: number };
  } | null>(null);
  const [activeVideoPlatform, setActiveVideoPlatform] = useState<'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter'>('instagram');

  // ── Load social config + latest jobs from native API ──
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [configRes, imageJob, videoJob] = await Promise.all([
          fetchSocialConfig().catch(() => null),
          fetchLatestJob('image'),
          fetchLatestJob('video'),
        ]);

        if (configRes?.context) {
          const ctx = configRes.context;
          const slug = (ctx.brandWebsite || '').replace(/^https?:\/\//, '').split('/')[0];
          setBrandName(ctx.companyName || DEFAULT_BRAND_NAME);
          setBrandHandle(ctx.uploadPostUser || slug || DEFAULT_BRAND_HANDLE);
          setBrandDomain(slug || DEFAULT_BRAND_DOMAIN);
        }

        if (imageJob?.assetUrl) {
          setSupabaseImageUrl(imageJob.assetUrl);
          setGeneratedSocialImage(imageJob.assetUrl);
          setCurrentImageJobId(imageJob.id);
          setShowImageWorkspace(true);
        }
        if (imageJob?.descriptions) {
          const d = imageJob.descriptions;
          setSocialDescriptions({
            instagram: d.instagram || '',
            facebook: d.facebook || '',
            tiktok: d.tiktok || '',
            linkedin: d.linkedin || '',
            twitter: d.twitter || '',
          });
        }

        if (videoJob?.assetUrl) {
          setSupabaseVideoUrl(videoJob.assetUrl);
          setCurrentVideoJobId(videoJob.id);
        }
        if (videoJob?.descriptions) {
          const d = videoJob.descriptions;
          setVideoMetadata({
            instagram: { content: d.instagram },
            facebook: { content: d.facebook },
            linkedin: { content: d.linkedin },
            tiktok: { caption: d.tiktok },
            youtube: { description: d.youtube },
            twitter: { content: d.twitter },
          });
        }
      } catch (err) {
        console.error('Error loading social studio data:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitial();

    const pollInterval = setInterval(async () => {
      try {
        const [imageJob, videoJob, pipelineStatus] = await Promise.all([
          fetchLatestJob('image'),
          fetchLatestJob('video'),
          fetchJobStatus(),
        ]);
        setStatus(pipelineStatus);

        if (imageJob?.assetUrl && imageJob.id !== currentImageJobId) {
          setSupabaseImageUrl(imageJob.assetUrl);
          setGeneratedSocialImage(imageJob.assetUrl);
          setCurrentImageJobId(imageJob.id);
        }
        if (videoJob?.assetUrl && videoJob.id !== currentVideoJobId) {
          setSupabaseVideoUrl(videoJob.assetUrl);
          setCurrentVideoJobId(videoJob.id);
        }
      } catch {
        // ignore poll errors
      }
    }, 8000);

    return () => clearInterval(pollInterval);
  }, [currentImageJobId, currentVideoJobId]);

  // ── Automatically detect aspect ratio of generated/fetched image ──
  useEffect(() => {
    if (generatedSocialImage) {
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio > 1) {
          setImageRatio('16:9');
        } else {
          setImageRatio('9:16');
        }
      };
      img.src = generatedSocialImage;
    }
  }, [generatedSocialImage]);

  // ── Clear progress from localStorage on page load (so refresh removes it) ──
  useEffect(() => {
    localStorage.removeItem('sd_generation_start');
  }, []);

  useEffect(() => {
    fetchJobStatus().then(setStatus).catch(() => setStatus('Connection Error'));
  }, []);

  // Timer logic for progress bar (max 6 minutes = 360s for video, 60s for images)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      const MAX_TIME = generationType === 'images' ? 60 : 360; // seconds
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 98) {
            clearInterval(interval);
            return 98; // Stay at 98% until status changes to success
          }
          return prev + (100 / MAX_TIME);
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating, generationType]);

  // Monitor status to trigger video preview refresh only (completely decoupled from prompt/image loading progress)
  useEffect(() => {
    const isDone = status?.toLowerCase().includes("successfully") || status?.toLowerCase().includes("completed");
    const prevIsDone = prevStatusRef.current?.toLowerCase().includes("successfully") || prevStatusRef.current?.toLowerCase().includes("completed");
    const isFirstLoad = prevStatusRef.current === undefined;

    if (isDone && !isFirstLoad && !prevIsDone) {
      // ✅ Status changed to done (e.g. video created successfully) — refresh preview
      handleRefreshPreview();
      showToast("Video preview updated!", "success");
    }

    prevStatusRef.current = status; // always update after checking
  }, [status]);

  const [isRefreshingVideo, setIsRefreshingVideo] = useState<boolean>(false);

  const handleRefreshPreview = async () => {
    setIsRefreshingVideo(true);
    try {
      const videoJob = await fetchLatestJob('video');
      if (videoJob?.assetUrl) {
        setSupabaseVideoUrl(`${videoJob.assetUrl}?t=${Date.now()}`);
        setCurrentVideoJobId(videoJob.id);
      }
      if (videoJob?.descriptions) {
        const d = videoJob.descriptions;
        setVideoMetadata({
          instagram: { content: d.instagram },
          facebook: { content: d.facebook },
          linkedin: { content: d.linkedin },
          tiktok: { caption: d.tiktok },
          youtube: { description: d.youtube },
          twitter: { content: d.twitter },
        });
      }
    } catch (err) {
      console.error("Error refreshing video preview:", err);
    } finally {
      setIsRefreshingVideo(false);
    }
  };

  const [isRefreshingImage, setIsRefreshingImage] = useState<boolean>(false);

  const handleRefreshImagePreview = async () => {
    setIsRefreshingImage(true);
    try {
      const imageJob = await fetchLatestJob('image');
      if (imageJob?.assetUrl) {
        setSupabaseImageUrl(imageJob.assetUrl);
        setGeneratedSocialImage(`${imageJob.assetUrl}?t=${Date.now()}`);
        setCurrentImageJobId(imageJob.id);
        setShowImageWorkspace(true);
      }
      if (imageJob?.descriptions) {
        const d = imageJob.descriptions;
        setSocialDescriptions({
          instagram: d.instagram || '',
          facebook: d.facebook || '',
          tiktok: d.tiktok || '',
          linkedin: d.linkedin || '',
          twitter: d.twitter || '',
        });
      }
    } catch (err) {
      console.error("Error refreshing image preview:", err);
    } finally {
      setIsRefreshingImage(false);
    }
  };


  const showToast = (message: string, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleImagePromptSubmit = async (prompt: string) => {
    setShowImageModal(false);
    setStatus("Generating images...");
    setIsGenerating(true);
    setGenerationType('images');
    setProgress(0);
    hasTriggeredInSession.current = true;
    setShowImageWorkspace(true);
    setIsImageGenerating(true);
    setGeneratedSocialImage(null);

    try {
      const start = await generateImage(prompt, imageRatio);
      setCurrentImageJobId(start.jobId);
      const result = await pollImageUntilDone(start.jobId, start.taskId, prompt);

      setProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationType(null);
      }, 1000);

      const imageUrl = result.imageUrl;
      const descriptions = result.descriptions || {};

      setGeneratedSocialImage(imageUrl);
      setSocialDescriptions({
        instagram: descriptions.instagram || SAMPLE_SOCIAL_FALLBACK.instagram,
        facebook: descriptions.facebook || SAMPLE_SOCIAL_FALLBACK.facebook,
        tiktok: descriptions.tiktok || SAMPLE_SOCIAL_FALLBACK.tiktok,
        linkedin: descriptions.linkedin || SAMPLE_SOCIAL_FALLBACK.linkedin,
        twitter: descriptions.twitter || SAMPLE_SOCIAL_FALLBACK.twitter,
      });
      showToast("Images generated successfully!", 'success');
    } catch (err: any) {
      console.error('[UI] Image generation error:', err);
      showToast(err?.message || 'Image generation failed', 'info');
      setIsGenerating(false);
      setGenerationType(null);
      setSocialDescriptions({ ...SAMPLE_SOCIAL_FALLBACK });
    } finally {
      setIsImageGenerating(false);
    }
  };

  const handleSocialPost = async () => {
    if (!currentImageJobId || !generatedSocialImage) {
      showToast('No image to post', 'info');
      return;
    }
    setIsImagePosting(true);
    try {
      await postImage(currentImageJobId, generatedSocialImage, socialDescriptions);
      showToast('IMAGE PUBLISHED SUCCESSFULLY', 'success');
      setStatus('Image Posted');
    } catch (err: any) {
      showToast(err?.message || 'Post failed', 'info');
    } finally {
      setIsImagePosting(false);
    }
  };

  const handleSocialRetrySubmit = async (retryPrompt: string) => {
    setShowSocialRetryModal(false);
    await handleImagePromptSubmit(retryPrompt);
  };

  const handleManualTrigger = async () => {
    setIsGenerating(true);
    setProgress(0);
    hasTriggeredInSession.current = true;
    localStorage.setItem('sd_generation_start', Date.now().toString());
    setStatus("Starting video process...");
    setLoading('manual');
    try {
      const result = await generateStory(videoFormData);
      if (result.story) {
        setGeneratedStory(result.story);
        showToast('Story generated! Review and accept to continue.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Video process failed', 'info');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateImages = () => {
    setShowImageModal(true);
  };

  const handleDynamicTrigger = () => {
    setShowModal(true);
    setGeneratedScenes([]);
  };

  const handleModalSubmit = async (data: any) => {
    console.log("[UI] Modal submitted with data:", data);
    setShowModal(false);

    const formattedData = {
      ...data,
      duration: typeof data.duration === 'number' || (typeof data.duration === 'string' && !data.duration.endsWith('s'))
        ? `${data.duration}s`
        : data.duration
    };

    setLastInputs(formattedData);
    setGeneratedScenes([]);
    setLoading('dynamic');

    try {
      const result = await generateStory(formattedData);
      const story = result?.output?.story || result?.story;
      if (story) {
        setGeneratedStory(story);
        showToast('Story generated!', 'success');
      } else {
        showToast('No story returned', 'info');
      }
    } catch (err: any) {
      showToast(err?.message || 'Story generation failed', 'info');
    } finally {
      setLoading(null);
    }
  };

  const handleAcceptStory = async () => {
    const backupStory = generatedStory;
    setGeneratedStory(null);
    setGeneratedScenes([]);
    setAcceptedStory(null);
    setIsGenerating(true);
    setGenerationType('video');
    setProgress(0);
    hasTriggeredInSession.current = true;
    localStorage.setItem('sd_generation_start', Date.now().toString());
    setStatus("Accepting story and generating prompts...");
    setLoading('accept');

    try {
      const result = await acceptStory({ ...lastInputs, generated_story: backupStory, status: "accepted" });
      const scenes = result.scenes || [];

      if (scenes.length > 0) {
        setGeneratedScenes(scenes);
        setAcceptedStory(backupStory);
        setCurrentVideoJobId(result.jobId);
        setVideoAudioUrl(result.audioUrl || null);
        setProgress(100);
        showToast('Story accepted and scenes generated!', 'success');
        setTimeout(() => {
          setIsGenerating(false);
          setGenerationType(null);
        }, 1000);
      } else {
        setIsGenerating(false);
        setGenerationType(null);
        showToast('Story accepted but no scenes returned', 'info');
      }
    } catch (err: any) {
      setIsGenerating(false);
      setGenerationType(null);
      showToast(err?.message || 'Accept failed', 'info');
    } finally {
      setLoading(null);
    }
  };

  const handleConfirmPrompts = async () => {
    if (!currentVideoJobId || !acceptedStory) {
      showToast('Missing job or story', 'info');
      return;
    }

    setSceneFailures({});
    setIsGenerating(true);
    setGenerationType('video');
    setProgress(0);
    hasTriggeredInSession.current = true;
    localStorage.setItem('sd_generation_start', Date.now().toString());
    setStatus("Generating your social video preview...");
    setLoading('confirm');

    try {
      const renderStart = await startVideoRender({
        jobId: currentVideoJobId,
        story: acceptedStory,
        scenes: generatedScenes,
        audioUrl: videoAudioUrl,
      });

      const imageTaskIds = renderStart.imageTaskIds || [];
      const imagePoll = (await pollKiePhase(() =>
        pollVideoPhase({
          phase: 'images',
          jobId: currentVideoJobId,
          scenes: generatedScenes,
          imageTaskIds,
        })
      )) as { complete?: boolean; scenes?: typeof generatedScenes; failures?: Array<{ failMsg?: string }> };

      const scenesWithImages = imagePoll.scenes || generatedScenes;
      const videoStart = await pollVideoPhase({
        phase: 'start_videos',
        jobId: currentVideoJobId,
        scenes: scenesWithImages,
      });

      const videoPoll = (await pollKiePhase(() =>
        pollVideoPhase({
          phase: 'videos',
          jobId: currentVideoJobId,
          scenes: scenesWithImages,
          videoTaskIds: videoStart.videoTaskIds,
        })
      )) as { complete?: boolean; scenes?: typeof generatedScenes; failures?: Array<{ failMsg?: string }> };

      const scenesComplete = videoPoll.scenes || scenesWithImages;

      setStatus('Stitching scene clips into final video...');
      const stitchStart = await pollVideoPhase({
        phase: 'start_stitch',
        jobId: currentVideoJobId,
        scenes: scenesComplete,
        audioUrl: videoAudioUrl,
      });

      await pollStitchPhase(() =>
        pollVideoPhase({
          phase: 'stitch',
          jobId: currentVideoJobId,
          stitchJobId: stitchStart.stitchJobId,
        })
      );

      setStatus('Finalizing video and captions...');
      const final = await pollVideoPhase({
        phase: 'complete_finalize',
        jobId: currentVideoJobId,
        story: acceptedStory,
        scenes: scenesComplete,
        stitchJobId: stitchStart.stitchJobId,
      });

      setProgress(100);
      setGeneratedScenes([]);
      setAcceptedStory(null);
      if (final.assetUrl) {
        setSupabaseVideoUrl(final.assetUrl);
      }
      if (final.descriptions) {
        const d = final.descriptions;
        setVideoMetadata({
          instagram: { content: d.instagram },
          facebook: { content: d.facebook },
          linkedin: { content: d.linkedin },
          tiktok: { caption: d.tiktok },
          youtube: { description: d.youtube },
          twitter: { content: d.twitter },
        });
      }
      showToast('Video created successfully!', 'success');
      handleRefreshPreview();
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationType(null);
      }, 1000);
    } catch (err: any) {
      console.error('[UI] Confirm prompts error:', err);
      setIsGenerating(false);
      setGenerationType(null);
      showToast(err?.message || 'Video generation failed', 'info');
    } finally {
      setLoading(null);
    }
  };

  const handleRetrySubmit = async (retryPrompt: string) => {
    setShowRetryModal(false);
    setGeneratedScenes([]);
    setSceneFailures({});
    setLoading('dynamic');

    try {
      const result = await retryStory({
        ...lastInputs,
        retry_prompt: retryPrompt,
        status: "retry",
        generated_story: generatedStory,
      });
      const story = result?.output?.story || result?.story;
      if (story) setGeneratedStory(story);
      showToast('Retry complete', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Retry failed', 'info');
    } finally {
      setLoading(null);
    }
  };

  const getPlatformConfig = (platform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'twitter') => {
    switch (platform) {
      case 'instagram':
        return {
          color: '#e1306c',
          bgActive: 'rgba(225, 48, 108, 0.15)',
          borderColor: 'rgba(225, 48, 108, 0.3)',
          charLimit: 2200,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          )
        };
      case 'facebook':
        return {
          color: '#1877f2',
          bgActive: 'rgba(24, 119, 242, 0.15)',
          borderColor: 'rgba(24, 119, 242, 0.3)',
          charLimit: 63206,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          )
        };
      case 'tiktok':
        return {
          color: '#00f2fe',
          bgActive: 'rgba(0, 242, 254, 0.15)',
          borderColor: 'rgba(0, 242, 254, 0.3)',
          charLimit: 2200,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.07-2.88-.53-4.13-1.28-.24-.15-.47-.32-.69-.49v7.1c0 2.22-.64 4.51-2.22 6.09-1.63 1.67-4.14 2.59-6.45 2.44-2.83-.16-5.61-2.07-6.52-4.78C1.23 15.81 1.76 12 3.86 9.77c1.7-1.85 4.41-2.71 6.89-2.22V11.7c-1.39-.47-3.07-.13-4.08.88a4.13 4.13 0 00-1.07 3.52c.28 1.54 1.61 2.87 3.16 3.03 1.79.16 3.61-.95 4.09-2.67.14-.52.17-1.06.17-1.6V.02z" />
            </svg>
          )
        };
      case 'linkedin':
        return {
          color: '#0a66c2',
          bgActive: 'rgba(10, 102, 194, 0.15)',
          borderColor: 'rgba(10, 102, 194, 0.3)',
          charLimit: 3000,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
            </svg>
          )
        };
      case 'twitter':
        return {
          color: '#000000',
          bgActive: 'rgba(0, 0, 0, 0.08)',
          borderColor: 'rgba(0, 0, 0, 0.2)',
          charLimit: 280,
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.736-8.852L2.017 2.25H8.1l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
          )
        };
      default:
        return {
          color: '#8C8474',
          bgActive: 'rgba(100,116,139,0.1)',
          borderColor: 'rgba(100,116,139,0.2)',
          charLimit: 2200,
          icon: null
        };
    }
  };

  const renderAvatar = () => (
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      border: '1px solid #E8DCC2'
    }}>
      <img src={brandLogo} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );

  const renderInstagramMock = () => {
    const text = socialDescriptions.instagram;
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#')) {
        return <span key={i} style={{ color: '#00376b', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ paddingBottom: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderAvatar()}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, margin: 0 }}>{brandHandle}</p>
              <p style={{ fontSize: '9px', color: '#8C8474', margin: 0 }}>AI Tenant Screening · Canada</p>
            </div>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#8C8474', cursor: 'pointer' }}>•••</span>
        </div>

        {/* Media Block */}
        <div style={{ background: '#000000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', aspectRatio: imageRatio === '16:9' ? '16/9' : '9/16', borderTop: '1px solid #FDF0D5', borderBottom: '1px solid #FDF0D5' }}>
          {generatedSocialImage ? (
            <img
              src={generatedSocialImage}
              alt="Instagram Mockup"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : null}
        </div>

        {/* Action icons bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px' }}>
          <div style={{ display: 'flex', gap: '14px' }}>
            <span style={{ cursor: 'pointer', fontSize: '16px' }}>❤️</span>
            <span style={{ cursor: 'pointer', fontSize: '16px' }}>💬</span>
            <span style={{ cursor: 'pointer', fontSize: '16px' }}>➡️</span>
          </div>
          <span style={{ cursor: 'pointer', fontSize: '16px' }}>🔖</span>
        </div>

        {/* Likes */}
        <p style={{ fontSize: '11px', fontWeight: 700, padding: '0 12px', margin: '0 0 6px 0' }}>1,482 likes</p>

        {/* Description text */}
        <div style={{ padding: '0 12px', fontSize: '11px', lineHeight: '1.5', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          <span style={{ fontWeight: 700, marginRight: '6px' }}>{brandHandle}</span>
          {formattedText}
        </div>
      </div>
    );
  };

  const renderFacebookMock = () => {
    const text = socialDescriptions.facebook;
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#')) {
        return <span key={i} style={{ color: '#1877f2', fontWeight: 500 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ padding: '12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          {renderAvatar()}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>{brandName}</p>
              <span style={{ color: '#1877f2', fontSize: '10px' }}>✔️</span>
            </div>
            <p style={{ fontSize: '9px', color: '#65676b', margin: 0 }}>Sponsored · 🌍</p>
          </div>
        </div>

        {/* Facebook Caption is ABOVE the image */}
        <p style={{ fontSize: '11px', lineHeight: '1.6', margin: '0 0 10px 0', wordBreak: 'break-word', whiteSpace: 'pre-wrap', color: '#003049' }}>
          {formattedText}
        </p>

        {/* Media Block */}
        <div style={{ background: '#f0f2f5', border: '1px solid #e4e6eb', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ width: '100%', aspectRatio: imageRatio === '16:9' ? '16/9' : '9/16', background: '#000000' }}>
            {generatedSocialImage ? (
              <img
                src={generatedSocialImage}
                alt="Facebook Mockup"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : null}
          </div>
          <div style={{ padding: '10px', background: '#f0f2f5', borderTop: '1px solid #e4e6eb' }}>
            <p style={{ fontSize: '9px', color: '#65676b', textTransform: 'uppercase', margin: 0 }}>{brandDomain}</p>
            <p style={{ fontSize: '12px', fontWeight: 700, margin: '4px 0 0 0', color: '#050505' }}>Affordable AI-Powered Tenant Screening for Canadian Landlords</p>
          </div>
        </div>

        {/* Likes Count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e4e6eb', padding: '8px 0', marginTop: '8px' }}>
          <span style={{ fontSize: '10px', color: '#65676b' }}>👍❤️ 244</span>
          <span style={{ fontSize: '10px', color: '#65676b' }}>42 Comments · 18 Shares</span>
        </div>

        {/* Engagement buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#65676b', fontSize: '10px', fontWeight: 600, padding: '4px', cursor: 'pointer' }}>👍 Like</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#65676b', fontSize: '10px', fontWeight: 600, padding: '4px', cursor: 'pointer' }}>💬 Comment</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#65676b', fontSize: '10px', fontWeight: 600, padding: '4px', cursor: 'pointer' }}>➡️ Share</button>
        </div>
      </div>
    );
  };

  const renderLinkedInMock = () => {
    const text = socialDescriptions.linkedin;
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#')) {
        return <span key={i} style={{ color: '#0a66c2', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ padding: '12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          {renderAvatar()}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, margin: 0, color: '#000000' }}>{brandName}</p>
            <p style={{ fontSize: '9px', color: '#8C8474', margin: 0 }}>AI-Powered Tenant Screening Platform · 10,240 followers</p>
            <p style={{ fontSize: '9px', color: '#8C8474', margin: 0 }}>1h · 🌍</p>
          </div>
        </div>

        {/* LinkedIn Caption ABOVE the image */}
        <p style={{ fontSize: '11px', lineHeight: '1.6', margin: '0 0 10px 0', color: '#000000', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {formattedText}
        </p>

        {/* Media card */}
        <div style={{ border: '1px solid #E8DCC2', borderRadius: '4px', overflow: 'hidden', background: '#000000', aspectRatio: imageRatio === '16:9' ? '16/9' : '9/16' }}>
          {generatedSocialImage ? (
            <img
              src={generatedSocialImage}
              alt="LinkedIn Mockup"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : null}
        </div>

        {/* Likes Count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E8DCC2', padding: '8px 0', marginTop: '8px' }}>
          <span style={{ fontSize: '9px', color: '#8C8474' }}>👍👏❤️ 82 · 12 comments</span>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#8C8474', fontSize: '9px', fontWeight: 600, padding: '4px' }}>👍 Like</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#8C8474', fontSize: '9px', fontWeight: 600, padding: '4px' }}>💬 Comment</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#8C8474', fontSize: '9px', fontWeight: 600, padding: '4px' }}>➡️ Share</button>
          <button style={{ flex: 1, background: 'none', border: 'none', color: '#8C8474', fontSize: '9px', fontWeight: 600, padding: '4px' }}>Send</button>
        </div>
      </div>
    );
  };

  const renderTikTokMock = () => {
    const text = socialDescriptions.tiktok;

    return (
      <div style={{ minHeight: '100%', width: '100%', background: '#000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        
        {/* Background Image full fit */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          {generatedSocialImage ? (
            <img
              src={generatedSocialImage}
              alt="TikTok Mockup"
              style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.85 }}
            />
          ) : null}
          {/* Subtle bottom gradient cover */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '140px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }} />
        </div>

        {/* Top Spacer */}
        <div style={{ zIndex: 2, height: '30px' }} />

        {/* Mid-content: Left User Details & Right floats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '10px', zIndex: 2, marginTop: 'auto', width: '100%' }}>
          
          {/* User & Caption Info */}
          <div style={{ flex: 1, paddingRight: '20px', color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', textAlign: 'left' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, margin: '0 0 4px 0' }}>@{brandHandle}</p>
            <p style={{ fontSize: '9px', lineHeight: '1.4', margin: 0, maxHeight: '60px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {text}
            </p>
            <p style={{ fontSize: '8px', color: '#d4d4d8', marginTop: '4px' }}>🎵 original sound - {brandName}</p>
          </div>

          {/* Right Floating Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            {/* Avatar with Pink Plus */}
            <div style={{ position: 'relative', width: '28px', height: '28px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '1.5px solid #ffffff', overflow: 'hidden', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={brandLogo} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', background: '#ff0050', color: '#ffffff', borderRadius: '50%', width: '10px', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', fontWeight: 800 }}>+</div>
            </div>

            {/* Heart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>❤️</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>34.2K</span>
            </div>

            {/* Comment */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>💬</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>822</span>
            </div>

            {/* Share */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>➡️</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>154</span>
            </div>
            
            {/* Audio Vinyl */}
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#23394A', border: '3px solid #23394A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#003049' }} />
            </div>
          </div>

        </div>

      </div>
    );
  };

  const renderTwitterMock = () => {
    const text = socialDescriptions.twitter;
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#') || word.startsWith('@')) {
        return <span key={i} style={{ color: '#1d9bf0', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ padding: '12px', background: '#ffffff' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderAvatar()}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, margin: 0, color: '#003049' }}>{brandName}</p>
              <p style={{ fontSize: '9px', color: '#8C8474', margin: 0 }}>@{brandHandle} · 1h</p>
            </div>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#000000">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.736-8.852L2.017 2.25H8.1l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
        </div>

        {/* Tweet Text */}
        <p style={{ fontSize: '12px', lineHeight: '1.6', margin: '0 0 10px 0', color: '#003049', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {formattedText}
        </p>

        {/* Image */}
        {generatedSocialImage && (
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8DCC2', marginBottom: '8px', background: '#000', aspectRatio: imageRatio === '16:9' ? '16/9' : '9/16' }}>
            <img src={generatedSocialImage} alt="X Post" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}

        {/* Char count */}
        <p style={{ fontSize: '9px', color: text.length > 280 ? '#C1121F' : '#9FA8A3', margin: '0 0 8px 0', textAlign: 'right', fontWeight: 500 }}>
          {text.length} / 280
        </p>

        {/* Engagement */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FDF0D5', paddingTop: '8px' }}>
          {[['💬','84'],['🔁','312'],['❤️','2.1K'],['📊','18.4K'],['🔖','']].map(([icon, count], i) => (
            <button key={i} style={{ background: 'none', border: 'none', color: '#8C8474', fontSize: '9px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
              {icon}{count && <span>{count}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const getVideoPlatformConfig = (platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter') => {
    switch (platform) {
      case 'instagram':
        return {
          color: '#e1306c',
          bgActive: 'rgba(225, 48, 108, 0.15)',
          borderColor: 'rgba(225, 48, 108, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          )
        };
      case 'facebook':
        return {
          color: '#1877f2',
          bgActive: 'rgba(24, 119, 242, 0.15)',
          borderColor: 'rgba(24, 119, 242, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          )
        };
      case 'linkedin':
        return {
          color: '#0a66c2',
          bgActive: 'rgba(10, 102, 194, 0.15)',
          borderColor: 'rgba(10, 102, 194, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
            </svg>
          )
        };
      case 'tiktok':
        return {
          color: '#00f2fe',
          bgActive: 'rgba(0, 242, 254, 0.15)',
          borderColor: 'rgba(0, 242, 254, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.07-2.88-.53-4.13-1.28-.24-.15-.47-.32-.69-.49v7.1c0 2.22-.64 4.51-2.22 6.09-1.63 1.67-4.14 2.59-6.45 2.44-2.83-.16-5.61-2.07-6.52-4.78C1.23 15.81 1.76 12 3.86 9.77c1.7-1.85 4.41-2.71 6.89-2.22V11.7c-1.39-.47-3.07-.13-4.08.88a4.13 4.13 0 00-1.07 3.52c.28 1.54 1.61 2.87 3.16 3.03 1.79.16 3.61-.95 4.09-2.67.14-.52.17-1.06.17-1.6V.02z" />
            </svg>
          )
        };
      case 'youtube':
        return {
          color: '#ff0000',
          bgActive: 'rgba(255, 0, 0, 0.15)',
          borderColor: 'rgba(255, 0, 0, 0.3)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.053 0 12 0 12s0 3.947.502 5.837a3.003 3.003 0 0 0 2.11 2.107C4.495 20.455 12 20.455 12 20.455s7.505 0 9.388-.511a3.002 3.002 0 0 0 2.11-2.107C24 15.947 24 12 24 12s0-3.947-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          )
        };
      case 'twitter':
        return {
          color: '#000000',
          bgActive: 'rgba(0, 0, 0, 0.08)',
          borderColor: 'rgba(0, 0, 0, 0.2)',
          icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.736-8.852L2.017 2.25H8.1l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
          )
        };
    }
  };

  const renderVideoAvatar = () => (
    <div style={{
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      border: '1px solid #E8DCC2',
      flexShrink: 0
    }}>
      <img src={brandLogo} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );

  const renderInstagramVideoMock = (videoSrc: string, text: string) => {
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#') || word.startsWith('@')) {
        return <span key={i} style={{ color: '#00376b', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #efefef' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderVideoAvatar()}
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, margin: 0, color: '#262626' }}>{brandHandle}</p>
              <p style={{ fontSize: '8px', color: '#8e8e8e', margin: 0 }}>Canada</p>
            </div>
          </div>
          <span style={{ fontSize: '12px', color: '#262626', fontWeight: 700, cursor: 'pointer' }}>•••</span>
        </div>

        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoSrc} />
        </div>

        {/* Engagement Icons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px 4px 10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ fontSize: '14px', cursor: 'pointer' }}>❤️</span>
            <span style={{ fontSize: '14px', cursor: 'pointer' }}>💬</span>
            <span style={{ fontSize: '14px', cursor: 'pointer' }}>✈️</span>
          </div>
          <span style={{ fontSize: '14px', cursor: 'pointer' }}>🔖</span>
        </div>

        {/* Caption */}
        <div style={{ padding: '0 10px 12px 10px', flex: 1 }}>
          <p style={{ fontSize: '9px', margin: '0 0 2px 0', color: '#262626', fontWeight: 700 }}>4,812 views</p>
          <p style={{ fontSize: '9px', lineHeight: '1.4', margin: 0, color: '#262626', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            <span style={{ fontWeight: 700, marginRight: '4px' }}>{brandHandle}</span>
            {formattedText}
          </p>
        </div>
      </div>
    );
  };

  const renderFacebookVideoMock = (videoSrc: string, text: string) => {
    return (
      <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderVideoAvatar()}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, margin: 0, color: '#050505' }}>{brandName}</p>
                <span style={{ color: '#1877f2', fontSize: '9px' }}>✓</span>
              </div>
              <p style={{ fontSize: '8px', color: '#65676b', margin: 0 }}>Sponsored · 🌐</p>
            </div>
          </div>
          <span style={{ fontSize: '14px', color: '#65676b', cursor: 'pointer' }}>•••</span>
        </div>

        {/* Text Caption */}
        <p style={{ fontSize: '9px', lineHeight: '1.4', padding: '0 12px 8px 12px', margin: 0, color: '#050505', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {text}
        </p>

        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoSrc} />
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid #f0f2f5', borderBottom: '1px solid #f0f2f5' }}>
          {[['👍','Like'],['💬','Comment'],['➡️','Share']].map(([icon, label], i) => (
            <button key={i} style={{ background: 'none', border: 'none', color: '#65676b', fontSize: '9px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderLinkedInVideoMock = (videoSrc: string, text: string) => {
    return (
      <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderVideoAvatar()}
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, margin: 0, color: '#000000' }}>{brandName}</p>
              <p style={{ fontSize: '7px', color: '#00000099', margin: '1px 0 0 0' }}>AI-Powered Tenant Screening for Landlords</p>
              <p style={{ fontSize: '7px', color: '#00000099', margin: 0 }}>1d · Edited · 🌐</p>
            </div>
          </div>
          <span style={{ fontSize: '14px', color: '#00000099', cursor: 'pointer' }}>•••</span>
        </div>

        {/* Text Caption */}
        <p style={{ fontSize: '9px', lineHeight: '1.4', padding: '4px 12px 8px 12px', margin: 0, color: '#000000e6', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {text}
        </p>

        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoSrc} />
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid #ebebeb' }}>
          {[['👍','Like'],['💬','Comment'],['🔁','Repost'],['✈️','Send']].map(([icon, label], i) => (
            <button key={i} style={{ background: 'none', border: 'none', color: '#00000099', fontSize: '9px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderTikTokVideoMock = (videoSrc: string, text: string) => {
    return (
      <div style={{ height: '100%', width: '100%', background: '#000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        
        {/* Fullscreen Video Background */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} key={videoSrc} />
          {/* Subtle bottom gradient cover */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '140px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', pointerEvents: 'none' }} />
        </div>

        {/* Top Spacer */}
        <div style={{ zIndex: 2, height: '30px' }} />

        {/* Left overlays & Right engagement buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '10px', zIndex: 2, marginTop: 'auto', width: '100%' }}>
          
          {/* User Details & Caption Overlay */}
          <div style={{ flex: 1, paddingRight: '20px', color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', textAlign: 'left' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, margin: '0 0 4px 0' }}>@{brandHandle}</p>
            <p style={{ fontSize: '9px', lineHeight: '1.4', margin: 0, maxHeight: '60px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {text}
            </p>
            <p style={{ fontSize: '8px', color: '#d4d4d8', marginTop: '4px' }}>🎵 original sound - {brandName}</p>
          </div>

          {/* Right Floating Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '28px', height: '28px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '1.5px solid #ffffff', overflow: 'hidden', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={brandLogo} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', background: '#ff0050', color: '#ffffff', borderRadius: '50%', width: '10px', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', fontWeight: 800 }}>+</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>❤️</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>4.8K</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>💬</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>188</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', cursor: 'pointer' }}>➡️</span>
              <span style={{ fontSize: '8px', color: '#ffffff', fontWeight: 600 }}>98</span>
            </div>
            
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#23394A', border: '3px solid #23394A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#003049' }} />
            </div>
          </div>

        </div>
      </div>
    );
  };

  const renderYouTubeVideoMock = (videoSrc: string, titleText: string, descriptionText: string) => {
    return (
      <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '16/9' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoSrc} />
        </div>

        {/* Video metadata */}
        <div style={{ padding: '10px 12px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 700, margin: 0, color: '#003049', lineHeight: '1.4' }}>
            {titleText || SAMPLE_VIDEO_FALLBACK.title}
          </h3>
          <p style={{ fontSize: '7.5px', color: '#8C8474', margin: 0 }}>4.2K views · 2 hours ago</p>

          {/* Channel Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #FDF0D5', borderBottom: '1px solid #FDF0D5', padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {renderVideoAvatar()}
              <div>
                <p style={{ fontSize: '9px', fontWeight: 700, margin: 0, color: '#003049' }}>{brandName}</p>
                <p style={{ fontSize: '7.5px', color: '#8C8474', margin: 0 }}>12.4K subscribers</p>
              </div>
            </div>
            <button style={{ background: '#cc0000', border: 'none', color: '#ffffff', fontSize: '8.5px', fontWeight: 700, borderRadius: '16px', padding: '5px 10px', cursor: 'pointer' }}>
              SUBSCRIBE
            </button>
          </div>

          {/* Video Description Box */}
          <div style={{ background: '#FDF6E3', borderRadius: '8px', padding: '8px 10px' }}>
            <p style={{ fontSize: '8px', color: '#23394A', fontWeight: 700, margin: '0 0 4px 0' }}>Description</p>
            <p style={{ fontSize: '8px', lineHeight: '1.4', margin: 0, color: '#4A5A64', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
              {descriptionText || SAMPLE_VIDEO_FALLBACK.description}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderTwitterVideoMock = (videoSrc: string, text: string) => {
    const formattedText = text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#') || word.startsWith('@')) {
        return <span key={i} style={{ color: '#1d9bf0', fontWeight: 600 }}>{word}</span>;
      }
      return word;
    });

    return (
      <div style={{ padding: '12px', background: '#ffffff', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {renderVideoAvatar()}
            <div>
              <p style={{ fontSize: '10px', fontWeight: 800, margin: 0, color: '#003049' }}>{brandName}</p>
              <p style={{ fontSize: '8px', color: '#8C8474', margin: 0 }}>@{brandHandle} · 1h</p>
            </div>
          </div>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#000000">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.736-8.852L2.017 2.25H8.1l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
        </div>

        {/* Tweet Content */}
        <p style={{ fontSize: '10px', lineHeight: '1.5', margin: '0 0 10px 0', color: '#003049', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {formattedText}
        </p>

        {/* Video Player */}
        <div style={{ width: '100%', background: '#000000', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8DCC2', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', marginBottom: '10px' }}>
          <video ref={videoRef} src={videoSrc} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} key={videoSrc} />
        </div>

        {/* Engagement Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #FDF0D5', paddingTop: '8px', marginTop: 'auto' }}>
          {[['💬','42'],['🔁','112'],['❤️','812'],['📊','9.4K'],['🔖','']].map(([icon, count], i) => (
            <button key={i} style={{ background: 'none', border: 'none', color: '#8C8474', fontSize: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
              {icon}{count && <span>{count}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const handlePostVideo = async () => {
    if (!currentVideoJobId) {
      showToast('No video job to post', 'info');
      return;
    }
    setIsVideoPosting(true);
    try {
      const descriptions = {
        instagram: videoMetadata?.instagram?.content || '',
        facebook: videoMetadata?.facebook?.content || '',
        linkedin: videoMetadata?.linkedin?.content || '',
        tiktok: videoMetadata?.tiktok?.caption || '',
        twitter: videoMetadata?.twitter?.content || '',
        youtube: videoMetadata?.youtube?.description || '',
      };
      await postVideo(
        currentVideoJobId,
        supabaseVideoUrl || videoUrl,
        descriptions,
        videoMetadata?.facebook?.title || videoMetadata?.instagram?.title
      );
      showToast('VIDEO PUBLISHED SUCCESSFULLY', 'success');
      setStatus('Video Posted');
    } catch (err: any) {
      showToast(err?.message || 'Video post failed', 'info');
    } finally {
      setIsVideoPosting(false);
    }
  };

  const getActiveVideoText = () => {
    if (videoMetadata) {
      const meta = videoMetadata[activeVideoPlatform];
      if (meta) {
        if (activeVideoPlatform === 'tiktok') return (meta as any).caption || (meta as any).content || "";
        if (activeVideoPlatform === 'youtube') return (meta as any).description || "";
        return (meta as any).content || (meta as any).description || (meta as any).caption || "";
      }
    }
    const socialFallback = (socialDescriptions as any)[activeVideoPlatform === 'youtube' ? 'instagram' : activeVideoPlatform];
    return socialFallback || SAMPLE_VIDEO_FALLBACK.caption;
  };

  const getActiveVideoTitle = () => {
    if (videoMetadata) {
      const meta = videoMetadata[activeVideoPlatform];
      if (meta) return (meta as any).title || SAMPLE_VIDEO_FALLBACK.title;
    }
    return SAMPLE_VIDEO_FALLBACK.title;
  };

  const renderPlatformTextTabs = (
    platforms: readonly string[],
    active: string,
    onSelect: (platform: string) => void,
    labels: Record<string, string>
  ) => (
    <div style={{ display: "flex", gap: 24, padding: "16px 0 8px", flexWrap: "wrap" }}>
      {platforms.map((platform) => {
        const isActive = active === platform;
        return (
          <button
            key={platform}
            type="button"
            onClick={() => onSelect(platform)}
            style={{
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? "#C1121F" : "#4A5A64",
              background: "none",
              border: "none",
              borderBottom: isActive ? "2px solid #C1121F" : "2px solid transparent",
              paddingBottom: 4,
              cursor: "pointer",
            }}
          >
            {labels[platform] || platform}
          </button>
        );
      })}
    </div>
  );

  const renderV4PreviewCard = (
    subtitle: string,
    media: React.ReactNode,
    statsLabel: string,
    captionText: string
  ) => (
    <div style={{ border: "1.5px solid #003049", borderRadius: 28, padding: "16px 14px", background: "#FFFFFF" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px 12px" }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#003049",
            color: "#FAEDCD",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {brandInitials(brandHandle, brandName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#003049" }}>{brandHandle}</div>
          <div style={{ fontSize: 11, color: "#8C8474" }}>{subtitle}</div>
        </div>
        <div style={{ color: "#8C8474", fontWeight: 700 }}>···</div>
      </div>
      {media}
      <div style={{ padding: "12px 4px 0" }}>
        <div style={{ fontSize: 12, color: "#8C8474" }}>{statsLabel}</div>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "#2B3A4A", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
          <strong>{brandHandle}</strong> {captionText}
        </p>
        {extractHashtags(captionText) && (
          <div style={{ fontSize: 12, color: "#38678A", marginTop: 6 }}>{extractHashtags(captionText)}</div>
        )}
      </div>
    </div>
  );

  /* ---- Portal Toast (renders directly into document.body, fully independent) ---- */
  const toastPortal = typeof window !== 'undefined' && toast
    ? createPortal(
        <div className="sd-portal-toast">
          <div className="sd-portal-toast-inner">
            <div className="sd-portal-toast-icon">
              {toast.type === 'success'
                ? <CheckCircle2 size={18} strokeWidth={2.5} color="#6ee7b7" />
                : <Activity size={18} strokeWidth={2.5} color="#669BBC" />}
            </div>
            <div className="sd-portal-toast-body">
              <span className="sd-portal-toast-label">
                {toast.type === 'success' ? 'Success' : 'Info'}
              </span>
              <span className="sd-portal-toast-msg">{toast.message}</span>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <EditorialPage>
      {toastPortal}

      <EditorialPageHeader
        eyebrow={
          <>
            Social Channels · <span style={{ color: "#38678A" }}>v2.0 connected</span>
          </>
        }
        title="Creator Studio"
        subtitle="Manage your social media content generation pipeline."
      />

      <EditorialTabBar
        tabs={[
          { id: "video", label: "Video" },
          { id: "image", label: "Image" },
        ]}
        activeId={creatorStudioView}
        onChange={(id) => setCreatorStudioView(id as "video" | "image")}
      />

      {creatorStudioView === "video" && (
        <>
          <section>
            <div
              style={{
                fontSize: 11.5,
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                color: "#C1121F",
                fontWeight: 700,
                padding: "28px 0 14px",
                fontFamily: "var(--font-display)",
              }}
            >
              Video AI Generation Config
            </div>

            <EditorialDefinitionList>
              <div style={{ borderTop: "1px solid var(--border)" }}>
                <EditorialDefinitionRow label="Category">
                  <EditorialField
                    value={videoFormData.category}
                    onChange={(v) => setVideoFormData((prev) => ({ ...prev, category: v }))}
                    placeholder="e.g. Tenant Screening"
                  />
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Video style">
                  <CustomSelect
                    variant="editorial"
                    value={videoFormData.videoStyle}
                    onChange={(v) => setVideoFormData((prev) => ({ ...prev, videoStyle: v }))}
                    options={[
                      { value: "Highly Realistic 4k, real life", label: "Realistic 4k" },
                      { value: "Cinematic Drone - Smooth", label: "Cinematic" },
                      { value: "Studio Professional - Clean", label: "Animated" },
                    ]}
                  />
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Character">
                  <CustomSelect
                    variant="editorial"
                    value={videoFormData.character}
                    onChange={(v) => {
                      const newChar = v as "male" | "female";
                      const firstVoice = VOICE_OPTIONS[newChar][0].id;
                      setVideoFormData((prev) => ({ ...prev, character: newChar, voice: firstVoice }));
                      setVoiceLabel(VOICE_OPTIONS[newChar][0].label);
                    }}
                    options={[
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                    ]}
                  />
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Voice">
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: "#003049", display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {voiceLabel.replace(" - ", " · ")}
                      {voiceLabel && <EditorialStatusPill variant="active">Selected</EditorialStatusPill>}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsVoiceModalOpen(true)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        fontFamily: "inherit",
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: "#003049",
                        borderBottom: "1px solid #C2B79A",
                        cursor: "pointer",
                      }}
                    >
                      Browse voices
                    </button>
                  </div>
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Language">
                  <CustomSelect
                    variant="editorial"
                    value={videoFormData.language}
                    onChange={(v) => setVideoFormData((prev) => ({ ...prev, language: v }))}
                    options={["English", "Spanish", "French", "Hebrew", "Turkish"].map((l) => ({ value: l, label: l }))}
                  />
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Background music">
                  <CustomSelect
                    variant="editorial"
                    value={videoFormData.backgroundSong}
                    onChange={(v) => setVideoFormData((prev) => ({ ...prev, backgroundSong: v }))}
                    options={[
                      { value: "Inspirational - Sunrise Bloom", label: "Sunrise Bloom" },
                      { value: "Ambient - Calm Waters", label: "Calm Horizon" },
                      { value: "Lo-fi - Midnight Study", label: "None" },
                    ]}
                  />
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Duration" labelSub="Min 30s · max 90s">
                  <input
                    type="number"
                    name="duration"
                    value={videoFormData.duration}
                    onKeyDown={(e) => {
                      if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                      const current = String(videoFormData.duration ?? "");
                      const wouldBe = parseInt(current + e.key, 10);
                      if (!isNaN(wouldBe) && wouldBe > 90) e.preventDefault();
                    }}
                    onChange={(e) => {
                      const raw = parseInt(e.target.value, 10);
                      if (!isNaN(raw) && raw > 90) {
                        setVideoFormData((prev) => ({ ...prev, duration: 90 }));
                      } else if (e.target.value === "") {
                        setVideoFormData((prev) => ({ ...prev, duration: "" as any }));
                      } else if (!isNaN(raw)) {
                        setVideoFormData((prev) => ({ ...prev, duration: raw }));
                      }
                    }}
                    onBlur={(e) => {
                      const raw = parseInt(e.target.value, 10);
                      const clamped = isNaN(raw) || raw < 30 ? 30 : Math.min(raw, 90);
                      setVideoFormData((prev) => ({ ...prev, duration: clamped }));
                    }}
                    min={30}
                    max={90}
                    style={editorialDurationInputStyle}
                  />
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Story description" isLast>
                  <EditorialField
                    value={videoFormData.description}
                    onChange={(v) => setVideoFormData((prev) => ({ ...prev, description: v }))}
                    multiline
                    rows={3}
                    placeholder="Tell your landlord story or describe the tenant screening content…"
                  />
                </EditorialDefinitionRow>
              </div>
            </EditorialDefinitionList>

            <div style={{ display: "flex", justifyContent: "flex-end", padding: "20px 0 0" }}>
              <EditorialPillButton
                variant="danger"
                onClick={() => handleModalSubmit(videoFormData)}
                disabled={loading === "dynamic" || !videoFormData.description.trim()}
              >
                {loading === "dynamic" ? (
                  <>
                    <Spinner size={14} color="white" /> Processing…
                  </>
                ) : (
                  <>Generate Video AI campaign →</>
                )}
              </EditorialPillButton>
            </div>

            {isGenerating && generationType !== "images" && (
              <div style={{ marginTop: 20, padding: "16px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "#003049" }}>
                      Video generation in progress
                    </div>
                    <div style={{ fontSize: 13, color: "#8C8474", marginTop: 4 }}>
                      Preview will update automatically · {Math.round(progress)}%
                    </div>
                  </div>
                </div>
                <div style={{ height: 4, background: "#E8DCC2", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progress}%`,
                      background: "#C1121F",
                      borderRadius: 4,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          {generatedStory && (
            <section style={{ marginTop: 48 }}>
              <EditorialSectionHeader title="Generated Story" />
            <div className="sd-action-card sd-action-card-success animate-fade-in">
              <div className="sd-card-head">
                <div className="sd-card-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <MessageSquare size={20} />
                </div>
                <h2 className="sd-card-title">Generated Story</h2>
              </div>
              <div className="sd-card-inner" style={{ background: '#ffffff', border: '1px solid #dcfce7' }}>
                <div className="sd-generated-text">
                  {loading === 'dynamic' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8C8474' }}>
                      <Spinner size={16} /> Generating new story...
                    </div>
                  ) : (
                    <textarea 
                      className="sd-story-textarea"
                      value={generatedStory}
                      onChange={(e) => setGeneratedStory(e.target.value)}
                      placeholder="Type or edit your story here..."
                    />
                  )}
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button 
                    className="sd-btn-secondary" 
                    style={{ width: 'auto', fontSize: 12, padding: '8px 16px', background: '#FDF6E3', color: '#23394A' }}
                    onClick={() => setShowRetryModal(true)}
                  >
                    <RefreshCw size={14} /> Retry
                  </button>
                  <button 
                    className="sd-btn-primary" 
                    style={{ width: 'auto', fontSize: 12, padding: '8px 20px', background: '#16a34a' }}
                    onClick={handleAcceptStory}
                    disabled={loading === 'accept'}
                  >
                    {loading === 'accept' 
                      ? <><Spinner size={14} color="white" /> Processing...</> 
                      : <><CheckCircle2 size={14} /> Accept Story</>}
                  </button>
                </div>
              </div>
            </div>
            </section>
          )}

          {generatedScenes && generatedScenes.length > 0 && loading !== 'confirm' && (() => {
            const failCount = Object.keys(sceneFailures).length;
            return (
            <div className="sd-action-card animate-fade-in" style={{ paddingBottom: 0, border: failCount > 0 ? '2px solid #C1121F' : undefined, boxShadow: failCount > 0 ? '0 8px 32px rgba(220,38,38,0.15)' : undefined }}>
              <div className="sd-card-head" style={{ borderBottom: failCount > 0 ? '1px solid #fecaca' : '1px solid #dcfce7', paddingBottom: 16, background: failCount > 0 ? 'linear-gradient(135deg, #C1121F, #C1121F)' : undefined, margin: failCount > 0 ? '-20px -20px 0 -20px' : undefined, padding: failCount > 0 ? '18px 20px' : undefined, borderRadius: failCount > 0 ? '14px 14px 0 0' : undefined }}>
                <div className="sd-card-icon" style={{ background: failCount > 0 ? 'rgba(255,255,255,0.2)' : '#f0fdf4', color: failCount > 0 ? '#fff' : '#16a34a' }}>
                  {failCount > 0 ? <span style={{ fontSize: 18 }}>⚠️</span> : <ImageIcon size={20} />}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 className="sd-card-title" style={{ color: failCount > 0 ? '#fff' : undefined }}>
                    {failCount > 0 ? 'Policy Violation — Fix & Resubmit' : 'Generated Ad Scenes'}
                  </h2>
                  <p style={{ fontSize: 11, color: failCount > 0 ? 'rgba(255,255,255,0.8)' : '#8C8474', marginTop: 2 }}>
                    {failCount > 0
                      ? `${failCount} scene${failCount > 1 ? 's' : ''} failed content policy check — edit the highlighted prompt${failCount > 1 ? 's' : ''} and click Resubmit.`
                      : 'Inspect and edit your scaled image and video scenario prompts.'}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: failCount > 0 ? "#fff" : "#16a34a",
                    background: failCount > 0 ? "rgba(255,255,255,0.2)" : "#f0fdf4",
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {failCount > 0 ? `${failCount} failed` : `${generatedScenes.length} scenes`}
                </span>
              </div>
              <div className="sd-card-inner" style={{ padding: 0, background: '#ffffff' }}>
                <div style={{ display: "grid", gridTemplateColumns: "44px 1.1fr 1.3fr 1.3fr", padding: "10px 20px", background: "#FDF6E3", borderBottom: "1.5px solid #E8DCC2" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#9FA8A3", textTransform: "uppercase" }}>#</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em", paddingRight: 16 }}>📖 Voiceover Storyline</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#003049", textTransform: "uppercase", letterSpacing: "0.05em", paddingRight: 16 }}>🖼️ Image Prompt</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#669BBC", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 16 }}>🎬 Video Scenario</div>
                </div>

                <div style={{ overflowY: "auto", maxHeight: "450px" }}>
                  {generatedScenes.map((scene: any, i: number) => {
                    const failure = sceneFailures[i];
                    const isFailed = failure !== undefined;
                    const isImageFail = isFailed && failure.column === 'image';
                    const isVideoFail = isFailed && failure.column === 'video';
                    const clearFailure = () => setSceneFailures(prev => { const n = { ...prev }; delete n[i]; return n; });
                    return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1.1fr 1.3fr 1.3fr", borderBottom: "1px solid #FDF0D5", background: isFailed ? "#fff5f5" : (i % 2 === 0 ? "#fff" : "#FDF6E3"), outline: isFailed ? "2px solid #fca5a5" : undefined }}>
                      {/* Scene number */}
                      <div style={{ padding: "16px 8px", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 18 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 24, height: 24, borderRadius: "50%",
                          background: isFailed ? "#C1121F" : "#003049",
                          color: "#fff", fontSize: 11, fontWeight: 800,
                          boxShadow: isFailed ? "0 0 0 3px rgba(239,68,68,0.2)" : undefined
                        }}>{scene.scene}</span>
                      </div>

                      {/* Storyline / Story Sentence — editable */}
                      <div style={{ padding: "12px 12px 12px 0", borderRight: "1px solid #E8DCC2" }}>
                        <textarea
                          value={scene.script_line || scene.story_sentence || ""}
                          onChange={(e) => {
                            setGeneratedScenes((prev: any[]) => {
                              const arr = [...prev];
                              arr[i] = { ...arr[i], script_line: e.target.value };
                              return arr;
                            });
                          }}
                          rows={4}
                          style={{
                            width: "100%", fontSize: 11, color: "#15803d", fontWeight: 500, lineHeight: 1.75,
                            border: "1.5px solid #dcfce7", borderRadius: 8, padding: "10px 12px",
                            resize: "vertical", fontFamily: "inherit", outline: "none",
                            background: "#f0fdf4", transition: "border 0.15s",
                          }}
                          onFocus={e => e.target.style.borderColor = "#16a34a"}
                          onBlur={e => e.target.style.borderColor = "#dcfce7"}
                          placeholder="No voiceover storyline sentence..."
                        />
                      </div>

                      {/* Image Prompt — red if image failure */}
                      <div style={{ padding: "12px 12px 12px 12px", borderRight: "1px solid #E8DCC2" }}>
                        <textarea
                          value={scene.prompt || ""}
                          onChange={(e) => {
                            setGeneratedScenes((prev: any[]) => {
                              const arr = [...prev];
                              arr[i] = { ...arr[i], prompt: e.target.value };
                              return arr;
                            });
                            if (isImageFail) clearFailure();
                          }}
                          rows={4}
                          style={{
                            width: "100%", fontSize: 11, color: isImageFail ? "#780000" : "#23394A", lineHeight: 1.75,
                            border: isImageFail ? "2px solid #C1121F" : "1.5px solid #E8DCC2",
                            borderRadius: 8, padding: "10px 12px",
                            resize: "vertical", fontFamily: "inherit", outline: "none",
                            background: isImageFail ? "#fff1f2" : "#FDF6E3", transition: "border 0.15s",
                            boxShadow: isImageFail ? "0 0 0 3px rgba(239,68,68,0.12)" : undefined,
                          }}
                          onFocus={e => e.target.style.borderColor = isImageFail ? "#C1121F" : "#003049"}
                          onBlur={e => e.target.style.borderColor = isImageFail ? "#C1121F" : "#E8DCC2"}
                          placeholder="No image prompt..."
                        />
                        {isImageFail && (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6, padding: "7px 10px", background: "#F9E3E0", border: "1px solid #fecaca", borderRadius: 7 }}>
                            <span style={{ fontSize: 13, flexShrink: 0 }}>🚫</span>
                            <span style={{ fontSize: 10, color: "#780000", lineHeight: 1.5, fontWeight: 600 }}>{failure.msg}</span>
                          </div>
                        )}
                      </div>

                      {/* Video Scenario — red if video failure */}
                      <div style={{ padding: "12px 12px" }}>
                        <textarea
                          value={scene.video_scenario || ""}
                          onChange={(e) => {
                            setGeneratedScenes((prev: any[]) => {
                              const arr = [...prev];
                              arr[i] = { ...arr[i], video_scenario: e.target.value };
                              return arr;
                            });
                            if (isVideoFail) clearFailure();
                          }}
                          rows={4}
                          style={{
                            width: "100%", fontSize: 11, lineHeight: 1.75,
                            color: isVideoFail ? "#780000" : "#2C5A77",
                            border: isVideoFail ? "2px solid #C1121F" : "1.5px solid #E8DCC2",
                            borderRadius: 8, padding: "10px 12px",
                            resize: "vertical", fontFamily: "inherit", outline: "none",
                            background: isVideoFail ? "#fff1f2" : "#E7F0F6", transition: "border 0.15s",
                            boxShadow: isVideoFail ? "0 0 0 3px rgba(239,68,68,0.12)" : undefined,
                          }}
                          onFocus={e => e.target.style.borderColor = isVideoFail ? "#C1121F" : "#669BBC"}
                          onBlur={e => e.target.style.borderColor = isVideoFail ? "#C1121F" : "#E8DCC2"}
                          placeholder="No video scenario..."
                        />
                        {isVideoFail && (
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6, padding: "7px 10px", background: "#F9E3E0", border: "1px solid #fecaca", borderRadius: 7 }}>
                            <span style={{ fontSize: 13, flexShrink: 0 }}>🚫</span>
                            <span style={{ fontSize: 10, color: "#780000", lineHeight: 1.5, fontWeight: 600 }}>{failure.msg}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Footer bar with Confirm Prompts button */}
                <div style={{
                  padding: "14px 20px",
                  borderTop: "1.5px solid #E8DCC2",
                  display: "flex",
                  justifyContent: "flex-end",
                  background: "#FDF6E3",
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12
                }}>
                  <button
                    className="sd-btn-primary"
                    style={{
                      width: "auto",
                      padding: "10px 24px",
                      background: `linear-gradient(135deg, ${medicalBlue}, ${medicalTeal})`,
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8
                    }}
                    onClick={handleConfirmPrompts}
                    disabled={loading === 'confirm'}
                  >
                    {loading === 'confirm' ? (
                      <><Spinner size={14} color="white" /> Confirming...</>
                    ) : failCount > 0 ? (
                      <><CheckCircle2 size={14} /> Resubmit Prompts →</>
                    ) : (
                      <><CheckCircle2 size={14} /> Confirm Prompts</>
                    )}
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

          {/* RIGHT: video preview — editorial v4 */}
          <section style={{ marginTop: 48 }}>
            <EditorialSectionHeader
              title="System Preview Output"
              meta={
                <EditorialTextLink onClick={handleRefreshPreview} disabled={isRefreshingVideo}>
                  Live feed · refresh
                </EditorialTextLink>
              }
            />

            {renderPlatformTextTabs(
              ["instagram", "facebook", "linkedin", "tiktok", "youtube", "twitter"],
              activeVideoPlatform,
              (p) => setActiveVideoPlatform(p as typeof activeVideoPlatform),
              VIDEO_PLATFORM_LABELS
            )}

            <div
              className="editorial-preview-grid"
              style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 48, paddingTop: 24, alignItems: "start" }}
            >
              {renderV4PreviewCard(
                "Canada",
                (
                  <div style={{ width: "100%", aspectRatio: "4/5", position: "relative", borderRadius: 6, overflow: "hidden", background: "#000" }}>
                    {isVideoPosting ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 280, gap: 12 }}>
                        <Loader2 size={28} color="#FDF6E3" style={{ animation: "spin 1.5s linear infinite" }} />
                      </div>
                    ) : supabaseVideoUrl || videoUrl ? (
                      <>
                        <video
                          ref={videoRef}
                          src={supabaseVideoUrl || videoUrl}
                          controls
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          key={supabaseVideoUrl || videoUrl}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: 10,
                            bottom: 10,
                            background: "rgba(0,48,73,0.85)",
                            color: "#FDF6E3",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: "3px 10px",
                            pointerEvents: "none",
                          }}
                        >
                          ▶ {formatDurationBadge(videoFormData.duration)}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 280, color: "#8C8474", fontSize: 13, padding: 16, textAlign: "center" }}>
                        {isRefreshingVideo ? <Loader2 size={24} color="#003049" style={{ animation: "spin 1s linear infinite" }} /> : "Video preview will appear here after generation"}
                      </div>
                    )}
                  </div>
                ),
                "4,812 views",
                getActiveVideoText()
              )}

              <div>
                <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "#8C8474", marginBottom: 10 }}>
                  Edit {VIDEO_PLATFORM_LABELS[activeVideoPlatform]} post copy
                </div>

                {activeVideoPlatform === "youtube" && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "#8C8474", marginBottom: 8 }}>
                      YouTube video title
                    </div>
                    <EditorialField
                      value={getActiveVideoTitle()}
                      onChange={(val) => {
                        setVideoMetadata((prev: any) => {
                          const currentMetadata = prev ? { ...prev } : {
                            instagram: { content: socialDescriptions.instagram },
                            facebook: { content: socialDescriptions.facebook },
                            linkedin: { content: socialDescriptions.linkedin },
                            tiktok: { caption: socialDescriptions.tiktok },
                            youtube: { title: SAMPLE_VIDEO_FALLBACK.title, description: socialDescriptions.instagram },
                            twitter: { content: socialDescriptions.twitter },
                          };
                          return { ...currentMetadata, youtube: { ...currentMetadata.youtube, title: val } };
                        });
                      }}
                    />
                  </div>
                )}

                <EditorialField
                  value={getActiveVideoText()}
                  onChange={(val) => {
                    setVideoMetadata((prev: any) => {
                      const currentMetadata = prev ? { ...prev } : {
                        instagram: { content: socialDescriptions.instagram },
                        facebook: { content: socialDescriptions.facebook },
                        linkedin: { content: socialDescriptions.linkedin },
                        tiktok: { caption: socialDescriptions.tiktok },
                        youtube: { title: SAMPLE_VIDEO_FALLBACK.title, description: socialDescriptions.instagram },
                        twitter: { content: socialDescriptions.twitter },
                      };
                      const updatedPlatformData = { ...currentMetadata[activeVideoPlatform] };
                      if (activeVideoPlatform === "tiktok") updatedPlatformData.caption = val;
                      else if (activeVideoPlatform === "youtube") updatedPlatformData.description = val;
                      else updatedPlatformData.content = val;
                      return { ...currentMetadata, [activeVideoPlatform]: updatedPlatformData };
                    });
                  }}
                  multiline
                  rows={6}
                />

                <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #E8DCC2" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#003049" }}>
                    Final creative approval
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#8C8474" }}>
                    Ready to push this content to your active social channels?
                  </p>
                  <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginTop: 16 }}>
                    <EditorialTextLink onClick={() => setShowRetryModal(true)}>Regenerate</EditorialTextLink>
                    <EditorialPillButton
                      variant="danger"
                      onClick={handlePostVideo}
                      disabled={isVideoPosting}
                      style={{ marginLeft: "auto", padding: "10px 24px", whiteSpace: "nowrap" }}
                    >
                      {isVideoPosting ? <Spinner size={14} color="white" /> : <>Post now →</>}
                    </EditorialPillButton>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {creatorStudioView === "image" && (
        <>
          <section>
            <EditorialSectionHeader
              title="Social Image Creator"
              meta="Auto-scale enabled"
              style={{ paddingTop: 28, borderBottom: "1px solid var(--primary)" }}
            />

            <EditorialDefinitionList>
              <div style={{ borderTop: "1px solid var(--border)" }}>
                <EditorialDefinitionRow label="Generation prompt">
                  <EditorialField
                    value={imagePrompt}
                    onChange={setImagePrompt}
                    multiline
                    rows={3}
                    placeholder="e.g. Landlord reviewing tenant application on laptop, professional home office, warm natural lighting, highly detailed…"
                  />
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Aspect ratio" isLast>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {(["16:9", "9:16"] as const).map((ratio) => {
                      const isActive = imageRatio === ratio;
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setImageRatio(ratio)}
                          style={{
                            fontFamily: "inherit",
                            border: isActive ? "none" : "1px solid #C2B79A",
                            background: isActive ? "#003049" : "transparent",
                            color: isActive ? "#FDF6E3" : "#8C8474",
                            borderRadius: 999,
                            padding: "7px 18px",
                            fontSize: 13.5,
                            fontWeight: isActive ? 700 : 400,
                            cursor: "pointer",
                          }}
                        >
                          {isActive ? "✓ " : ""}
                          {ratio === "16:9" ? "16:9 landscape" : "9:16 portrait"}
                        </button>
                      );
                    })}
                  </div>
                </EditorialDefinitionRow>
              </div>
            </EditorialDefinitionList>

            <div style={{ display: "flex", justifyContent: "flex-end", padding: "20px 0 0" }}>
              <EditorialPillButton
                variant="danger"
                onClick={() => handleImagePromptSubmit(imagePrompt)}
                disabled={loading === "images" || isImageGenerating || !imagePrompt.trim()}
              >
                {loading === "images" || isImageGenerating ? (
                  <>
                    <Spinner size={14} color="white" /> Generating…
                  </>
                ) : (
                  <>Generate social images →</>
                )}
              </EditorialPillButton>
            </div>
          </section>

          <section style={{ marginTop: 48 }}>
            <EditorialSectionHeader
              title="Social Campaign Mockup"
              meta={
                <EditorialTextLink onClick={handleRefreshImagePreview} disabled={isRefreshingImage}>
                  Live feed · refresh
                </EditorialTextLink>
              }
            />

            {isInitialLoading || isImageGenerating || isImagePosting ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <Loader2 size={32} color="#003049" style={{ animation: "spin 1.5s linear infinite" }} />
                <p style={{ margin: "16px 0 0", fontSize: 14, fontWeight: 600, color: "#003049" }}>
                  {isInitialLoading ? "Loading platform preview…" : isImagePosting ? "Posting content…" : "Drafting platform creatives…"}
                </p>
                {generationType === "images" && (
                  <div style={{ width: 200, margin: "16px auto 0", height: 4, background: "#E8DCC2", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: "#C1121F", transition: "width 0.3s ease" }} />
                  </div>
                )}
              </div>
            ) : (
              <>
                {renderPlatformTextTabs(
                  ["instagram", "facebook", "linkedin", "tiktok", "twitter"],
                  activePlatform,
                  (p) => setActivePlatform(p as typeof activePlatform),
                  IMAGE_PLATFORM_LABELS
                )}

                <div
                  className="editorial-preview-grid"
                  style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 48, paddingTop: 24, alignItems: "start" }}
                >
                  {renderV4PreviewCard(
                    "AI Tenant Screening · Canada",
                    (
                      <div style={{ width: "100%", aspectRatio: imageRatio === "16:9" ? "16/9" : "9/16", borderRadius: 6, overflow: "hidden", background: "#E8DCC2" }}>
                        {generatedSocialImage ? (
                          <img src={generatedSocialImage} alt="Generated social" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#8C8474", fontSize: 13 }}>
                            Generated image preview
                          </div>
                        )}
                      </div>
                    ),
                    "1,482 likes",
                    socialDescriptions[activePlatform] || SAMPLE_SOCIAL_FALLBACK[activePlatform]
                  )}

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "#8C8474" }}>
                        Edit {IMAGE_PLATFORM_LABELS[activePlatform]} post
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color:
                            socialDescriptions[activePlatform].length > getPlatformConfig(activePlatform).charLimit
                              ? "#C1121F"
                              : "#8C8474",
                        }}
                      >
                        {socialDescriptions[activePlatform].length.toLocaleString()} /{" "}
                        {getPlatformConfig(activePlatform).charLimit.toLocaleString()} chars
                      </div>
                    </div>

                    <EditorialField
                      value={socialDescriptions[activePlatform]}
                      onChange={(val) => setSocialDescriptions((prev) => ({ ...prev, [activePlatform]: val }))}
                      multiline
                      rows={5}
                    />

                    <div style={{ marginTop: 18 }}>
                      <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "#8C8474", marginBottom: 10 }}>
                        Tap to append landlord hashtags
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {LANDLORD_HASHTAGS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              const currentText = socialDescriptions[activePlatform];
                              const space = currentText.endsWith(" ") || currentText === "" ? "" : " ";
                              setSocialDescriptions((prev) => ({
                                ...prev,
                                [activePlatform]: currentText + space + tag,
                              }));
                            }}
                            style={{
                              fontFamily: "inherit",
                              border: "1px solid #C2B79A",
                              borderRadius: 999,
                              padding: "5px 12px",
                              fontSize: 13,
                              color: "#2B3A4A",
                              background: "transparent",
                              cursor: "pointer",
                            }}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #E8DCC2" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#003049" }}>
                        Creative approved
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#8C8474" }}>
                        Verify scaling & descriptions before pushing live.
                      </p>
                      <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginTop: 16 }}>
                        <EditorialTextLink onClick={() => setShowSocialRetryModal(true)} disabled={isImagePosting}>
                          Retry
                        </EditorialTextLink>
                        <EditorialPillButton
                          variant="danger"
                          onClick={handleSocialPost}
                          disabled={isImagePosting}
                          style={{ marginLeft: "auto", padding: "10px 24px", whiteSpace: "nowrap" }}
                        >
                          {isImagePosting ? <Spinner size={14} color="white" /> : <>Post →</>}
                        </EditorialPillButton>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      <GeneratorModal 
        isOpen={showModal} 
        onOpenChange={setShowModal} 
        onSubmit={handleModalSubmit}
        loading={loading === 'dynamic'}
      />

      <RetryModal 
        isOpen={showRetryModal}
        onOpenChange={setShowRetryModal}
        onSubmit={handleRetrySubmit}
        loading={loading === 'dynamic'}
      />

      <ImagePromptModal 
        isOpen={showImageModal}
        onOpenChange={setShowImageModal}
        onSubmit={handleImagePromptSubmit}
        loading={loading === 'images'}
      />

      <RetryModal 
        isOpen={showSocialRetryModal}
        onOpenChange={setShowSocialRetryModal}
        onSubmit={handleSocialRetrySubmit}
        loading={loading === 'post_social'}
      />

      <VoiceExplorerModal 
        isOpen={isVoiceModalOpen}
        onOpenChange={setIsVoiceModalOpen}
        selectedVoiceId={videoFormData.voice}
        onSelectVoice={(id, label) => {
          setVideoFormData(prev => ({ ...prev, voice: id }));
          setVoiceLabel(label);
          setIsVoiceModalOpen(false);
        }}
      />

    </EditorialPage>
  );
}
