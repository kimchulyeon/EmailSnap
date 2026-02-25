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
  project_id: number | null;
  message_id: string;
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

// ── Project ──

export interface Project {
  id: number;
  name: string;
  color: string;
  mail_count: number;
  unread_count: number;
  latest_mail_at: string | null;
}

export const PROJECT_COLORS = [
  "#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#06B6D4",
];

// ── Settings ──

export interface AppSettings {
  polling_interval: number;
  notifications_enabled: boolean;
  auto_cleanup_days: number;
  launch_on_startup: boolean;
  groq_api_key: string;
  ai_categorization: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  polling_interval: 60,
  notifications_enabled: true,
  auto_cleanup_days: 30,
  launch_on_startup: false,
  groq_api_key: "",
  ai_categorization: false,
};

export function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

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

export type ViewType = "login" | "projects" | "project_mails" | "settings";
export type ProjectFilter = number | "all" | "unassigned";
