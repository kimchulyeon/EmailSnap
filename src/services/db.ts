import Database from "@tauri-apps/plugin-sql";
import type { Mail, CategoryRule, MailCategory } from "../types";

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
    await database.execute(
      "INSERT OR IGNORE INTO mails (id, sender_name, sender_email, subject, received_at, category, web_link, notified, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
      ]
    );
    return true;
  } catch {
    return false;
  }
}

export async function getMails(category?: MailCategory): Promise<Mail[]> {
  const database = await getDb();
  let query = "SELECT * FROM mails";
  const params: string[] = [];

  if (category && category !== ("all" as string)) {
    query += " WHERE category = ?";
    params.push(category);
  }

  query += " ORDER BY received_at DESC";

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
