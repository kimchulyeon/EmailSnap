import { useEffect, useState } from "react";
import { useProjectStore } from "../stores/projectStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useUIStore } from "../stores/uiStore";
import { getSetting } from "../services/db";
import { startPolling, stopPolling } from "../services/poller";
import type { ImapCredentials } from "../types";

function ProjectList() {
  const {
    projects,
    totalStats,
    unassignedStats,
    analyzing,
    fetchProjects,
    analyzeAndAssign,
  } = useProjectStore();
  const settings = useSettingsStore((s) => s.settings);
  const { navigateTo, openProject } = useUIStore();
  const [pollingStatus, setPollingStatus] = useState<
    "starting" | "running" | "error"
  >("starting");

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const host = (await getSetting("imap_host")) || "imap.worksmobile.com";
      const port = Number((await getSetting("imap_port")) || "993");
      const email = await getSetting("imap_email");
      const password = await getSetting("imap_password");

      if (!email || !password) {
        navigateTo("login");
        return;
      }

      const credentials: ImapCredentials = { host, port, email, password };

      startPolling({
        credentials,
        settings,
        onNewMails: async (mails) => {
          if (cancelled) return;
          await fetchProjects();
          // Keyword matching (no AI) for new mails
          if (mails.length > 0) {
            const { assignNewMails } = useProjectStore.getState();
            await assignNewMails(
              mails.map((m) => ({ id: m.id, subject: m.subject }))
            );
          }
        },
      });

      if (!cancelled) {
        setPollingStatus("running");
        await fetchProjects();

        // Only run full analysis when no projects exist yet (first time setup)
        if (settings.ai_categorization && settings.groq_api_key) {
          const { projects } = useProjectStore.getState();
          if (projects.length === 0) {
            analyzeAndAssign(settings.groq_api_key);
          }
        }
      }
    };

    init().catch(() => setPollingStatus("error"));

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [settings, fetchProjects, analyzeAndAssign, navigateTo]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="text-lg font-bold text-white">EmailSnap</h1>
        <div className="flex items-center gap-3">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              pollingStatus === "running"
                ? "bg-emerald-500"
                : pollingStatus === "starting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-red-500"
            }`}
            title={
              pollingStatus === "running"
                ? "메일 감지 중"
                : pollingStatus === "starting"
                  ? "연결 중..."
                  : "연결 오류"
            }
          />
          {settings.groq_api_key && !analyzing && unassignedStats.total > 0 && (
            <button
              onClick={() => analyzeAndAssign(settings.groq_api_key)}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
            >
              AI 분석
            </button>
          )}
          <button
            onClick={() => navigateTo("settings")}
            className="text-zinc-400 hover:text-white transition-colors text-sm cursor-pointer"
          >
            설정
          </button>
        </div>
      </header>

      {/* Folder Grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* AI analysis indicator */}
        {analyzing && (
          <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg">
            <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-violet-300">
              AI가 메일을 분석하고 있습니다...
            </span>
          </div>
        )}

        {/* No AI key banner */}
        {!settings.groq_api_key && totalStats.total > 0 && (
          <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-300">
              설정에서 Groq API Key를 입력하면 AI로 프로젝트를 생성할 수
              있습니다
            </p>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* All mails folder */}
          {totalStats.total > 0 && (
            <FolderCard
              name="전체 메일"
              count={totalStats.total}
              unread={totalStats.unread}
              color="#71717A"
              onClick={() => openProject("all")}
            />
          )}

          {/* Project folders */}
          {projects.map((project) => (
            <FolderCard
              key={project.id}
              name={project.name}
              count={project.mail_count}
              unread={project.unread_count}
              latestAt={project.latest_mail_at}
              color={project.color}
              onClick={() => openProject(project)}
            />
          ))}

          {/* Unassigned folder */}
          {unassignedStats.total > 0 && (
            <FolderCard
              name="미분류"
              count={unassignedStats.total}
              unread={unassignedStats.unread}
              color="#9CA3AF"
              onClick={() => openProject("unassigned")}
            />
          )}
        </div>

        {/* Empty state */}
        {totalStats.total === 0 && !analyzing && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-zinc-500 text-sm">메일이 없습니다</p>
            <p className="text-zinc-600 text-xs">
              {pollingStatus === "running"
                ? `${settings.polling_interval}초마다 새 메일을 확인합니다`
                : "메일 서버에 연결 중..."}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-4 py-2 border-t border-zinc-800 text-center">
        <p className="text-[10px] text-zinc-600">
          v{__APP_VERSION__} &middot; {totalStats.total}건
        </p>
      </footer>
    </div>
  );
}

function FolderCard({
  name,
  count,
  unread,
  color,
  latestAt,
  onClick,
}: {
  name: string;
  count: number;
  unread: number;
  color: string;
  latestAt?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 transition-colors cursor-pointer text-left relative overflow-hidden"
    >
      {/* Color accent top */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: color }}
      />

      {/* Project name */}
      <span className="text-sm font-medium text-white truncate w-full">
        {name}
      </span>

      {/* Count */}
      <div className="flex items-center justify-between w-full">
        <span className="text-xs text-zinc-500">{count}건</span>
        {unread > 0 && (
          <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </div>

      {/* Latest time */}
      {latestAt && (
        <span className="text-[10px] text-zinc-600">
          {formatRelativeTime(latestAt)}
        </span>
      )}
    </button>
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

export default ProjectList;
