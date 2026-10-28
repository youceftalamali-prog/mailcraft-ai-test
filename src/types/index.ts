export interface SubjectLineOption {
  text: string;
  openRateScore: number;
  angle: string;
  preheader: string;
}

export interface EmailBodyData {
  headline: string;
  subheadline: string;
  heroGreeting: string;
  mainStory: string;
  bulletPoints: Array<{ title: string; desc: string }>;
  socialProof: { quote: string; author: string; role: string };
  cta: { text: string; url: string; secondaryText?: string };
  urgencyBanner?: string;
  signoff: string;
  senderName: string;
  companyName: string;
  companyAddress: string;
}

export interface VisualConfig {
  prompt: string;
  aspectRatio: '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
  imageSize: '1K' | '2K' | '4K';
  imageUrl?: string;
  style: string;
}

export interface DripStep {
  step: number;
  title: string;
  sendDelay: string;
  subject: string;
  summary: string;
  keyAction: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  brief: string;
  targetAudience: string;
  tone: string;
  campaignGoal: string;
  subjectLines: SubjectLineOption[];
  selectedSubjectIndex: number;
  preheader: string;
  body: EmailBodyData;
  visual: VisualConfig;
  dripSequence: DripStep[];
  createdAt: number;
}

export interface AlgerianOutroItem {
  id: string;
  title: string;
  englishSubtitle: string;
  region: 'العاصمي (الوسط)' | 'الوهراني (الغرب)' | 'القسنطيني (الشرق)' | 'تسويقي تجاري (Business & E-Commerce)' | 'شبابي لصناع المحتوى (Creator & Vlog)' | 'تراثي وشعبي (Traditional)';
  dialectKey?: string;
  vibe: string;
  recommendedVoice: 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' | 'Charon';
  voiceLabel: string;
  gender: 'ذكر' | 'أنثى' | 'كلاهما';
  arabicText: string;
  phoneticGuide: string;
  bestFor: string;
  audioDataUrl?: string;
}

export interface AlgerianDialect {
  id: string;
  label: string;
  englishLabel: string;
  regionTag: string;
  recommendedVoice: 'Zephyr' | 'Puck' | 'Fenrir' | 'Kore' | 'Charon';
  description: string;
  vocabularySample: string;
}

/** Professional delivery emotion / performance style for product ads & outros */
export type DeliveryEmotionId =
  | 'very_enthusiastic'
  | 'product_admiration'
  | 'luxurious_elegant'
  | 'friendly_advice'
  | 'confident_persuasive'
  | 'playful'
  | 'surprise'
  | 'calm_reassuring'
  | 'emotional'
  | 'gradual_story';

export interface DeliveryEmotion {
  id: DeliveryEmotionId;
  labelAr: string;
  labelEn: string;
  /** Instruction sent ONLY in speechMetadata.style — never spoken as text */
  styleInstruction: string;
  description: string;
}

export interface DeliverySettings {
  emotionId: DeliveryEmotionId;
  /** 0–100, default 55 */
  intensity: number;
  /** speaking rate multiplier, default 1.0 (0.75–1.35) */
  pace: number;
  /** natural pauses between phrases, default true */
  pauses: boolean;
}

export interface GeneratedVoiceScriptResult {
  id: string;
  /** 'literal' = user's exact text spoken; 'generate_outro' = AI-written short outro */
  mode?: 'literal' | 'generate_outro';
  catchyTitle: string;
  scriptText: string;
  phoneticText: string;
  dialect: string;
  dialectLabel: string;
  voice: 'Zephyr' | 'Puck' | 'Fenrir' | 'Kore' | 'Charon';
  deliveryStyle: string;
  callToAction: string;
  audioDataUrl?: string;
  durationEstimate?: string;
  /** Exact text that was sent to the TTS engine (for verification) */
  textSentToTts?: string;
  /** Echo of delivery settings used for this generation */
  deliverySettings?: DeliverySettings;
  emotionLabel?: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  model: 'gemini-3.8-flash' | 'gemini-4-argon' | 'gemini-3.1-flash-lite';
  roleType?: 'email_marketer' | 'algerian_voice_coach' | 'creative_director';
}
