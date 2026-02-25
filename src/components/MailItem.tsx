import { openUrl } from "@tauri-apps/plugin-opener";
import type { Mail } from "../types";
import { useMailStore } from "../stores/mailStore";

interface Props {
  mail: Mail;
}

function MailItem({ mail }: Props) {
  const markMailAsRead = useMailStore((s) => s.markMailAsRead);

  const handleClick = async () => {
    await openUrl(
      `https://mail.worksmobile.com/read/popup?nMailId=${mail.id}&folderSN=0`
    );
    await markMailAsRead(mail.id);
  };

  return (
    <li
      onClick={handleClick}
      className={`px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/50 cursor-pointer transition-colors ${
        !mail.is_read ? "bg-zinc-900/50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${
            !mail.is_read ? "bg-emerald-500" : "bg-transparent"
          }`}
        />
        <div className="flex-1 min-w-0">
          {/* Sender + Time */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span
              className={`text-sm truncate ${
                !mail.is_read
                  ? "font-semibold text-white"
                  : "text-zinc-300"
              }`}
            >
              {mail.sender_name || mail.sender_email}
            </span>
            <span className="text-[10px] text-zinc-500 shrink-0">
              {formatRelativeTime(mail.received_at)}
            </span>
          </div>

          {/* Subject */}
          <p
            className={`text-sm truncate ${
              !mail.is_read ? "text-zinc-200" : "text-zinc-400"
            }`}
          >
            {mail.subject}
          </p>

          {/* Urgent badge */}
          {mail.category === "urgent" && (
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
              긴급
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay === 1) return "어제";
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export default MailItem;
