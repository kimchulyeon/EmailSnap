// ── Mail ──

export interface Mail {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  received_at: string;
  category: MailCategory;
  web_link: string;
  notified: boolean;
  is_read: boolean;
  created_at: string;
}

export type MailCategory =
  | "urgent"
  | "approval"
  | "external"
  | "internal"
  | "system"
  | "uncategorized";

export interface CategoryRule {
  id: number;
  name: string;
  priority: number;
  match_type: "subject_contains" | "sender_domain" | "sender_contains";
  match_value: string;
  color: string;
  notify: boolean;
  is_default: boolean;
}

// ── Settings ──

export interface AppSettings {
  polling_interval: number; // seconds (30-120)
  notifications_enabled: boolean;
  work_hours_start: string; // 'HH:MM'
  work_hours_end: string; // 'HH:MM'
  auto_cleanup_days: number; // default 30
  launch_on_startup: boolean;
  company_domain: string; // e.g. 'mycompany.com'
  groq_api_key: string;
  ai_categorization: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  polling_interval: 60,
  notifications_enabled: true,
  work_hours_start: "09:00",
  work_hours_end: "18:00",
  auto_cleanup_days: 30,
  launch_on_startup: false,
  company_domain: "",
  groq_api_key: "",
  ai_categorization: false,
};

// ── Category Display ──

export const CATEGORY_CONFIG: Record<
  MailCategory,
  { label: string; color: string; emoji: string }
> = {
  urgent: { label: "긴급", color: "#EF4444", emoji: "🔴" },
  approval: { label: "결재", color: "#F59E0B", emoji: "🟡" },
  external: { label: "외부", color: "#3B82F6", emoji: "🔵" },
  internal: { label: "내부", color: "#22C55E", emoji: "🟢" },
  system: { label: "시스템", color: "#6B7280", emoji: "⚙️" },
  uncategorized: { label: "미분류", color: "#9CA3AF", emoji: "📧" },
};

// ── AI Classification ──

export interface AIClassificationResult {
  category: MailCategory;
  confidence: number;
  reason: string;
}

// ── Auth (IMAP) ──

export interface ImapCredentials {
  host: string;
  port: number;
  email: string;
  password: string;
}

// ── View ──

export type ViewType = "login" | "mail_list" | "settings";
export type CategoryFilter = MailCategory | "all";
