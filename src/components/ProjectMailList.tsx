import { useEffect } from "react";
import { useMailStore } from "../stores/mailStore";
import { useUIStore } from "../stores/uiStore";
import { useProjectStore } from "../stores/projectStore";
import MailItem from "./MailItem";
import type { ProjectFilter } from "../types";

function ProjectMailList() {
  const { mails, loading, fetchMails, markAllAsRead } = useMailStore();
  const selectedProject = useUIStore((s) => s.selectedProject);
  const navigateTo = useUIStore((s) => s.navigateTo);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);

  const projectName =
    selectedProject?.type === "all"
      ? "전체 메일"
      : selectedProject?.type === "unassigned"
        ? "미분류"
        : selectedProject?.type === "project"
          ? selectedProject.name
          : "";

  const projectColor =
    selectedProject?.type === "project" ? selectedProject.color : undefined;

  const filter: ProjectFilter | null =
    selectedProject?.type === "all"
      ? "all"
      : selectedProject?.type === "unassigned"
        ? "unassigned"
        : selectedProject?.type === "project"
          ? selectedProject.id
          : null;

  useEffect(() => {
    if (filter === null) {
      navigateTo("projects");
      return;
    }
    fetchMails(filter);
  }, [filter, fetchMails, navigateTo]);

  const hasUnread = mails.some((m) => !m.is_read);

  const handleMarkAllRead = async () => {
    if (filter === null) return;
    await markAllAsRead(filter);
    await fetchProjects();
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <button
          onClick={() => navigateTo("projects")}
          className="text-zinc-400 hover:text-white transition-colors text-sm cursor-pointer"
        >
          뒤로
        </button>
        {projectColor && (
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: projectColor }}
          />
        )}
        <h1 className="text-lg font-bold text-white truncate flex-1">
          {projectName}
        </h1>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
          >
            전체 읽음
          </button>
        )}
      </header>

      {/* Mail List */}
      <div className="flex-1 overflow-y-auto">
        {loading && mails.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-zinc-500 text-sm">메일을 가져오는 중...</p>
          </div>
        ) : mails.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-zinc-500 text-sm">메일이 없습니다</p>
          </div>
        ) : (
          <ul>
            {mails.map((mail) => (
              <MailItem key={mail.id} mail={mail} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ProjectMailList;
