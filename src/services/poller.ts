import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, ImapCredentials, Mail, MailCategory } from "../types";
import { extractDomain } from "../types";
import { getLastReceivedTime, insertMail, getCategoryRules, cleanupOldMails } from "./db";
import { classifyMail } from "./classifier";
import { sendNotification } from "./notification";

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let errorCount = 0;

interface PollerDeps {
  credentials: ImapCredentials;
  settings: AppSettings;
  onNewMails?: (mails: Mail[]) => void;
}

export function startPolling(deps: PollerDeps) {
  stopPolling();
  const interval = deps.settings.polling_interval * 1000;

  // Immediately poll once, then set interval
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
  console.log(`[EmailSnap] poll - ${new Date().toLocaleTimeString()}`);

  const companyDomain = extractDomain(deps.credentials.email);

  try {
    const lastTime = await getLastReceivedTime();
    console.log(`[EmailSnap] fetching mails since: ${lastTime ?? "all (first run)"}`);

    const rawMails = await invoke<
      {
        mail_id: string;
        sender_name: string;
        sender_email: string;
        subject: string;
        received_at: string;
        message_id: string;
      }[]
    >("fetch_mails", {
      host: deps.credentials.host,
      port: deps.credentials.port,
      email: deps.credentials.email,
      password: deps.credentials.password,
      since: lastTime,
    });

    console.log(`[EmailSnap] fetched ${rawMails.length} mails from IMAP`);

    if (rawMails.length === 0) {
      errorCount = 0;
      return;
    }

    const rules = await getCategoryRules();
    const newMails: Mail[] = [];

    for (const raw of rawMails) {
      // Rule-based category only (AI is used for project assignment, not per-mail classification)
      const category: MailCategory = classifyMail(raw, rules, companyDomain);

      const mail: Omit<Mail, "created_at"> = {
        id: raw.mail_id,
        sender_name: raw.sender_name,
        sender_email: raw.sender_email,
        subject: raw.subject,
        received_at: raw.received_at,
        category,
        web_link: "https://mail.worksmobile.com",
        notified: false,
        is_read: false,
        project_id: null,
        message_id: raw.message_id,
      };

      const inserted = await insertMail(mail);
      if (inserted) {
        newMails.push({ ...mail, created_at: new Date().toISOString() });
      }
    }

    if (deps.settings.notifications_enabled && newMails.length > 0) {
      for (const mail of newMails) {
        await sendNotification(mail);
      }
    }

    deps.onNewMails?.(newMails);
    errorCount = 0;

    await cleanupOldMails(deps.settings.auto_cleanup_days);
  } catch (err) {
    errorCount++;
    const errorMsg = String(err);
    console.error(`[EmailSnap] poll error (${errorCount}):`, errorMsg);

    if (errorMsg.includes("AUTH_FAILED")) {
      stopPolling();
      return;
    }

    if (errorCount >= 3) {
      stopPolling();
      const backoffInterval =
        deps.settings.polling_interval * 1000 * Math.pow(2, errorCount - 2);
      pollingTimer = setInterval(
        () => poll(deps),
        Math.min(backoffInterval, 600000)
      );
    }
  }
}

