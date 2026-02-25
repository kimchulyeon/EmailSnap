import {
  isPermissionGranted,
  requestPermission,
  sendNotification as tauriNotify,
} from "@tauri-apps/plugin-notification";
import type { Mail } from "../types";
import { CATEGORY_CONFIG } from "../types";

export async function initNotifications(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }
  return granted;
}

export async function sendNotification(mail: Mail): Promise<void> {
  const granted = await isPermissionGranted();
  if (!granted) return;

  const config = CATEGORY_CONFIG[mail.category];

  tauriNotify({
    title: `${config.emoji} ${mail.sender_name || mail.sender_email}`,
    body: mail.subject,
  });
}
