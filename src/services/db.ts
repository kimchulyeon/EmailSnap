import Database from "@tauri-apps/plugin-sql";
import type { Mail, CategoryRule, Project } from "../types";
import { PROJECT_COLORS } from "../types";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:emailsnap.db");
    await initTables(db);
  }
  return db;
}

async function initTables(database: Database) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS mails (
      id TEXT PRIMARY KEY,
      sender_name TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      received_at TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'uncategorized',
      web_link TEXT,
      notified INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      priority INTEGER NOT NULL,
      match_type TEXT NOT NULL,
      match_value TEXT NOT NULL,
      color TEXT NOT NULL,
      notify INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migration: add project_id to mails if not exists
  try {
    await database.execute(
      "ALTER TABLE mails ADD COLUMN project_id INTEGER REFERENCES projects(id)"
    );
  } catch {
    // Column already exists
  }

  // Migration: add keywords to projects
  try {
    await database.execute(
      "ALTER TABLE projects ADD COLUMN keywords TEXT DEFAULT '[]'"
    );
  } catch {
    // Column already exists
  }

  // Migration: add message_id to mails
  try {
    await database.execute(
      "ALTER TABLE mails ADD COLUMN message_id TEXT DEFAULT ''"
    );
  } catch {
    // Column already exists
  }

  // Insert default category rules if empty
  const rules = await database.select<CategoryRule[]>(
    "SELECT * FROM category_rules LIMIT 1"
  );
  if (rules.length === 0) {
    await insertDefaultRules(database);
  }
}

async function insertDefaultRules(database: Database) {
  const defaults = [
    {
      name: "urgent",
      priority: 1,
      match_type: "subject_contains",
      match_value: "[긴급],[장애],[URGENT]",
      color: "#EF4444",
      is_default: 1,
    },
    {
      name: "approval",
      priority: 2,
      match_type: "subject_contains",
      match_value: "[결재],[승인],[Approval]",
      color: "#F59E0B",
      is_default: 1,
    },
    {
      name: "external",
      priority: 3,
      match_type: "sender_domain",
      match_value: "__EXTERNAL__",
      color: "#3B82F6",
      is_default: 1,
    },
    {
      name: "internal",
      priority: 4,
      match_type: "sender_domain",
      match_value: "__INTERNAL__",
      color: "#22C55E",
      is_default: 1,
    },
    {
      name: "system",
      priority: 5,
      match_type: "sender_contains",
      match_value: "noreply,system,notification,no-reply",
      color: "#6B7280",
      is_default: 1,
    },
  ];

  for (const rule of defaults) {
    await database.execute(
      "INSERT INTO category_rules (name, priority, match_type, match_value, color, is_default) VALUES (?, ?, ?, ?, ?, ?)",
      [
        rule.name,
        rule.priority,
        rule.match_type,
        rule.match_value,
        rule.color,
        rule.is_default,
      ]
    );
  }
}

// ── Mail CRUD ──

export async function insertMail(
  mail: Omit<Mail, "created_at">
): Promise<boolean> {
  const database = await getDb();
  try {
    const result = await database.execute(
      "INSERT OR IGNORE INTO mails (id, sender_name, sender_email, subject, received_at, category, web_link, notified, is_read, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        mail.id,
        mail.sender_name,
        mail.sender_email,
        mail.subject,
        mail.received_at,
        mail.category,
        mail.web_link,
        mail.notified ? 1 : 0,
        mail.is_read ? 1 : 0,
        mail.message_id || "",
      ]
    );
    return result.rowsAffected > 0;
  } catch {
    return false;
  }
}

export async function getMailsByProject(
  filter: number | "all" | "unassigned"
): Promise<Mail[]> {
  const database = await getDb();
  let query: string;
  let params: (string | number)[] = [];

  if (filter === "all") {
    query = "SELECT * FROM mails ORDER BY received_at DESC";
  } else if (filter === "unassigned") {
    query =
      "SELECT * FROM mails WHERE project_id IS NULL ORDER BY received_at DESC";
  } else {
    query =
      "SELECT * FROM mails WHERE project_id = ? ORDER BY received_at DESC";
    params = [filter];
  }

  const rows = await database.select<Mail[]>(query, params);
  return rows.map((row) => ({
    ...row,
    notified: Boolean(row.notified),
    is_read: Boolean(row.is_read),
  }));
}

export async function markAsRead(mailId: string): Promise<void> {
  const database = await getDb();
  await database.execute("UPDATE mails SET is_read = 1 WHERE id = ?", [
    mailId,
  ]);
}

export async function markAllAsReadByProject(
  filter: number | "all" | "unassigned"
): Promise<void> {
  const database = await getDb();
  if (filter === "all") {
    await database.execute("UPDATE mails SET is_read = 1 WHERE is_read = 0");
  } else if (filter === "unassigned") {
    await database.execute(
      "UPDATE mails SET is_read = 1 WHERE project_id IS NULL AND is_read = 0"
    );
  } else {
    await database.execute(
      "UPDATE mails SET is_read = 1 WHERE project_id = ? AND is_read = 0",
      [filter]
    );
  }
}

export async function getLastReceivedTime(): Promise<string | null> {
  const database = await getDb();
  const result = await database.select<{ max_time: string | null }[]>(
    "SELECT MAX(received_at) as max_time FROM mails"
  );
  return result[0]?.max_time ?? null;
}

export async function cleanupOldMails(days: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    "DELETE FROM mails WHERE created_at < datetime('now', ?)",
    [`-${days} days`]
  );
}

// ── Projects ──

export async function getProjects(): Promise<Project[]> {
  const database = await getDb();
  return database.select<Project[]>(`
    SELECT
      p.id,
      p.name,
      p.color,
      COUNT(m.id) as mail_count,
      COALESCE(SUM(CASE WHEN m.is_read = 0 THEN 1 ELSE 0 END), 0) as unread_count,
      MAX(m.received_at) as latest_mail_at
    FROM projects p
    LEFT JOIN mails m ON m.project_id = p.id
    GROUP BY p.id
    ORDER BY MAX(m.received_at) DESC NULLS LAST
  `);
}

export async function getOrCreateProject(name: string): Promise<number> {
  const database = await getDb();

  const existing = await database.select<{ id: number }[]>(
    "SELECT id FROM projects WHERE name = ?",
    [name]
  );
  if (existing.length > 0) return existing[0].id;

  const countResult = await database.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM projects"
  );
  const color =
    PROJECT_COLORS[(countResult[0]?.cnt ?? 0) % PROJECT_COLORS.length];

  const result = await database.execute(
    "INSERT INTO projects (name, color) VALUES (?, ?)",
    [name, color]
  );
  return result.lastInsertId!;
}

export async function assignMailToProject(
  mailId: string,
  projectId: number
): Promise<void> {
  const database = await getDb();
  await database.execute("UPDATE mails SET project_id = ? WHERE id = ?", [
    projectId,
    mailId,
  ]);
}

export async function getProjectNames(): Promise<string[]> {
  const database = await getDb();
  const rows = await database.select<{ name: string }[]>(
    "SELECT name FROM projects ORDER BY name"
  );
  return rows.map((r) => r.name);
}

export async function getProjectsForMatching(): Promise<
  { id: number; name: string; keywords: string[] }[]
> {
  const database = await getDb();
  const rows = await database.select<
    { id: number; name: string; keywords: string }[]
  >("SELECT id, name, keywords FROM projects");
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keywords: (() => {
      try {
        return JSON.parse(r.keywords || "[]");
      } catch {
        return [];
      }
    })(),
  }));
}

export async function updateProjectKeywords(
  projectId: number,
  keywords: string[]
): Promise<void> {
  const database = await getDb();
  await database.execute("UPDATE projects SET keywords = ? WHERE id = ?", [
    JSON.stringify(keywords),
    projectId,
  ]);
}

export async function getUnassignedMails(): Promise<
  Pick<Mail, "id" | "subject" | "sender_email">[]
> {
  const database = await getDb();
  return database.select(
    "SELECT id, subject, sender_email FROM mails WHERE project_id IS NULL ORDER BY received_at DESC"
  );
}

export async function getTotalMailStats(): Promise<{
  total: number;
  unread: number;
}> {
  const database = await getDb();
  const rows = await database.select<{ total: number; unread: number }[]>(
    "SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END), 0) as unread FROM mails"
  );
  return { total: rows[0]?.total ?? 0, unread: rows[0]?.unread ?? 0 };
}

export async function getUnassignedMailStats(): Promise<{
  total: number;
  unread: number;
}> {
  const database = await getDb();
  const rows = await database.select<{ total: number; unread: number }[]>(
    "SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END), 0) as unread FROM mails WHERE project_id IS NULL"
  );
  return { total: rows[0]?.total ?? 0, unread: rows[0]?.unread ?? 0 };
}

// ── Category Rules ──

export async function getCategoryRules(): Promise<CategoryRule[]> {
  const database = await getDb();
  return database.select<CategoryRule[]>(
    "SELECT * FROM category_rules ORDER BY priority ASC"
  );
}

export async function upsertCategoryRule(
  rule: Omit<CategoryRule, "id"> & { id?: number }
): Promise<void> {
  const database = await getDb();
  if (rule.id) {
    await database.execute(
      "UPDATE category_rules SET name = ?, priority = ?, match_type = ?, match_value = ?, color = ?, notify = ? WHERE id = ?",
      [
        rule.name,
        rule.priority,
        rule.match_type,
        rule.match_value,
        rule.color,
        rule.notify ? 1 : 0,
        rule.id,
      ]
    );
  } else {
    await database.execute(
      "INSERT INTO category_rules (name, priority, match_type, match_value, color, notify, is_default) VALUES (?, ?, ?, ?, ?, ?, 0)",
      [
        rule.name,
        rule.priority,
        rule.match_type,
        rule.match_value,
        rule.color,
        rule.notify ? 1 : 0,
      ]
    );
  }
}

export async function deleteCategoryRule(id: number): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM category_rules WHERE id = ?", [id]);
}

// ── Settings ──

export async function getSetting(key: string): Promise<string | null> {
  const database = await getDb();
  const result = await database.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  return result[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  await database.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, value]
  );
}
