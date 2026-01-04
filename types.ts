
export enum LeadCategory {
  MediaPress = "Medios y Prensa",
  AgencyProspecting = "Prospecto de Agencia",
  DigitalBusiness = "Negocios Digitales",
  Investment = "Inversión / Capital",
  MusicIndustry = "Industria Musical",
  Unclassified = "Sin Clasificar",
  Irrelevant = "Ruido / Irrelevante"
}

// Data shape returned by the Node.js Mechanical Scraper
export interface RawProfile {
  username: string;
  fullName: string;
  bio: string; // Raw text
  externalUrl: string;
  followerCount: number;
  email: string | null; // Extracted via Regex in Node.js
  phone: string | null; // Extracted via Regex in Node.js
  isScraped: boolean;
}

// Data shape after AI Enrichment
export interface Profile extends RawProfile {
  id: string;
  category: LeadCategory; // AI Determined
  relevanceScore: number; // AI Determined
  scrapedAt: string;
}

export type SearchMode = 'niche' | 'followers';

export interface SearchParams {
  mode: SearchMode;
  niche: string;
  country: string;
  sourceUsername: string;
  contactNature: string;
  musicStyle: string; // Optional field for Media searches
  minFollowers: number;
  maxFollowers: number;
  resultsCount: number;
}

export interface GenerationChunk {
  profiles: Profile[];
  logs: string[];
}

export enum AppStatus {
  Idle = 'idle',
  Scraping = 'scraping', // Mechanical Phase (Puppeteer)
  Classifying = 'classifying', // AI Phase
  Completed = 'completed',
  Error = 'error'
}

// New Types for Email Marketing
export type ViewMode = 'scraper' | 'campaign' | 'analytics' | 'settings';

export interface MailgunConfig {
  // SMTP Config
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  isConfigured: boolean;
  
  // Database Config (MySQL/Postgres)
  dbHost: string;
  dbUser: string;
  dbPass: string;
  dbName: string;
}

export interface RecipientStats {
  email: string;
  status: 'sent' | 'failed' | 'opened';
  openCount: number;
  lastOpenAt?: string;
}

export interface Campaign {
  id: string;
  name: string; // Usually the subject or a specific name
  subject: string;
  category: string;
  htmlContent: string;
  createdAt: string;
  recipients: RecipientStats[];
  stats: {
    totalSent: number;
    delivered: number;
    failed: number;
    uniqueOpens: number;
    totalOpens: number;
  };
  aiAnalysis?: string; // Stored AI advice
}

export interface CampaignState {
  subject: string;
  htmlContent: string;
  status: 'draft' | 'sending' | 'sent' | 'error';
  logs: string[];
}
