import { useEffect } from "react";
import { useMailStore } from "../stores/mailStore";
import { useUIStore } from "../stores/uiStore";
import CategoryFilter from "./CategoryFilter";
import MailItem from "./MailItem";

function MailList() {
  const { mails, loading, fetchMails } = useMailStore();
  const navigateTo = useUIStore((s) => s.navigateTo);

  useEffect(() => {
    fetchMails();
  }, [fetchMails]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="text-lg font-bold text-white">EmailSnap</h1>
        <button
          onClick={() => navigateTo("settings")}
          className="text-zinc-400 hover:text-white transition-colors text-sm cursor-pointer"
        >
          설정
        </button>
      </header>

      {/* Category Filter */}
      <CategoryFilter />

      {/* Mail List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-zinc-500 text-sm">로딩 중...</p>
          </div>
        ) : mails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
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

      {/* Footer */}
      <footer className="px-4 py-2 border-t border-zinc-800 text-center">
        <p className="text-[10px] text-zinc-600">
          v{__APP_VERSION__} &middot; {mails.length}건
        </p>
      </footer>
    </div>
  );
}

export default MailList;
