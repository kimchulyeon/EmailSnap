import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, Mail, MailCategory } from "../types";
import { getLastReceivedTime, insertMail, getCategoryRules, cleanupOldMails } from "./db";
import { classifyMail } from "./classifier";
import { classifyWithAI } from "./ai";
import { sendNotification } from "./notification";

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let errorCount = 0;

interface PollerDeps {
  accessToken: string;
  userId: string;
  settings: AppSettings;
  onNewMails?: (mails: Mail[]) => void;
}

export function startPolling(deps: PollerDeps) {
  stopPolling();
  const interval = deps.settings.polling_interval * 1000;

  poll(deps);
  pollingTimer = setInterval(() => poll(deps), interval);
}

export function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  errorCount = 0;
}

async function poll(deps: PollerDeps) {
  // Work hours check
  if (!isWithinWorkHours(deps.settings)) return;

  try {
    const lastTime = await getLastReceivedTime();

    const rawMails = await invoke<
      {
        mail_id: string;
        sender_name: string;
        sender_email: string;
        subject: string;
        received_at: string;
      }[]
    >("fetch_mails", {
      accessToken: deps.accessToken,
      userId: deps.userId,
      since: lastTime,
    });

    if (rawMails.length === 0) {
      errorCount = 0;
      return;
    }

    const rules = await getCategoryRules();
    const newMails: Mail[] = [];

    for (const raw of rawMails) {
      let category: MailCategory;

      // AI classification if enabled
      if (
        deps.settings.ai_categorization &&
        deps.settings.groq_api_key
      ) {
        try {
          const aiResult = await classifyWithAI(
            deps.settings.groq_api_key,
            raw.subject,
            raw.sender_email
          );
          category =
            aiResult.confidence >= 0.7
              ? aiResult.category
              : classifyMail(raw, rules, deps.settings.company_domain);
        } catch {
          category = classifyMail(raw, rules, deps.settings.company_domain);
        }
      } else {
        category = classifyMail(raw, rules, deps.settings.company_domain);
      }

      const mail: Omit<Mail, "created_at"> = {
        id: raw.mail_id,
        sender_name: raw.sender_name,
        sender_email: raw.sender_email,
        subject: raw.subject,
        received_at: raw.received_at,
        category,
        web_link: `https://mail.worksmobile.com/mail/read/${raw.mail_id}`,
        notified: false,
        is_read: false,
      };

      const inserted = await insertMail(mail);
      if (inserted) {
        newMails.push({ ...mail, created_at: new Date().toISOString() });
      }
    }

    // Send notifications
    if (deps.settings.notifications_enabled && newMails.length > 0) {
      for (const mail of newMails) {
        await sendNotification(mail);
      }
    }

    deps.onNewMails?.(newMails);
    errorCount = 0;

    // Auto cleanup
    await cleanupOldMails(deps.settings.auto_cleanup_days);
  } catch (err) {
    errorCount++;
    const errorMsg = String(err);

    if (errorMsg === "UNAUTHORIZED") {
      // TODO: trigger token refresh or re-login
      stopPolling();
      return;
    }

    // Exponential backoff: after 3 consecutive failures, double the interval
    if (errorCount >= 3) {
      stopPolling();
      const backoffInterval =
        deps.settings.polling_interval * 1000 * Math.pow(2, errorCount - 2);
      pollingTimer = setInterval(
        () => poll(deps),
        Math.min(backoffInterval, 600000) // max 10 min
      );
    }
  }
}

function isWithinWorkHours(settings: AppSettings): boolean {
  const now = new Date();
  const [startH, startM] = settings.work_hours_start.split(":").map(Number);
  const [endH, endM] = settings.work_hours_end.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}
