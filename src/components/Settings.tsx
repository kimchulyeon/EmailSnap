import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useUIStore } from "../stores/uiStore";
import { getSetting, setSetting } from "../services/db";

function Settings() {
  const { settings, updateSetting } = useSettingsStore();
  const navigateTo = useUIStore((s) => s.navigateTo);
  const showToast = useUIStore((s) => s.showToast);
  const [loggedInEmail, setLoggedInEmail] = useState("");

  useEffect(() => {
    getSetting("imap_email").then((v) => setLoggedInEmail(v ?? ""));
  }, []);

  const handleLogout = async () => {
    await setSetting("imap_email", "");
    await setSetting("imap_password", "");
    await setSetting("imap_host", "");
    await setSetting("imap_port", "");
    showToast("로그아웃 되었습니다");
    navigateTo("login");
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <button
          onClick={() => navigateTo("projects")}
          className="text-zinc-400 hover:text-white transition-colors text-sm cursor-pointer"
        >
          뒤로
        </button>
        <h1 className="text-lg font-bold text-white">설정</h1>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Account */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">계정</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">로그인 계정</span>
              <span className="text-sm text-white">{loggedInEmail}</span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-2 text-sm text-red-400 hover:text-red-300 border border-zinc-700 hover:border-red-400/30 rounded-lg transition-colors cursor-pointer"
            >
              로그아웃
            </button>
          </div>
        </section>

        {/* Polling */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">메일 확인</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">폴링 주기</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={30}
                  max={120}
                  step={10}
                  value={settings.polling_interval}
                  onChange={(e) =>
                    updateSetting("polling_interval", Number(e.target.value))
                  }
                  className="w-24"
                />
                <span className="text-xs text-zinc-500 w-10 text-right">
                  {settings.polling_interval}초
                </span>
              </div>
            </label>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">알림</h2>
          <label className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">데스크톱 알림</span>
            <input
              type="checkbox"
              checked={settings.notifications_enabled}
              onChange={(e) =>
                updateSetting("notifications_enabled", e.target.checked)
              }
              className="w-4 h-4 accent-emerald-500"
            />
          </label>
        </section>

        {/* AI Settings */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">
            AI 분류 (Groq)
          </h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">AI 카테고리 분류</span>
              <input
                type="checkbox"
                checked={settings.ai_categorization}
                onChange={(e) =>
                  updateSetting("ai_categorization", e.target.checked)
                }
                className="w-4 h-4 accent-emerald-500"
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-400 block mb-1">
                Groq API Key
              </span>
              <input
                type="password"
                placeholder="gsk_..."
                value={settings.groq_api_key}
                onChange={(e) =>
                  updateSetting("groq_api_key", e.target.value)
                }
                className="w-full bg-zinc-800 text-white text-sm rounded px-3 py-2 border border-zinc-700 placeholder:text-zinc-600"
              />
            </label>

            {settings.ai_categorization && !settings.groq_api_key && (
              <p className="text-[10px] text-amber-400">
                AI 분류를 사용하려면 Groq API Key를 입력하세요
              </p>
            )}
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">데이터</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">자동 정리 (일)</span>
              <input
                type="number"
                min={7}
                max={365}
                value={settings.auto_cleanup_days}
                onChange={(e) =>
                  updateSetting("auto_cleanup_days", Number(e.target.value))
                }
                className="w-16 bg-zinc-800 text-white text-sm rounded px-2 py-1 border border-zinc-700 text-right"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">시작 시 자동 실행</span>
              <input
                type="checkbox"
                checked={settings.launch_on_startup}
                onChange={(e) =>
                  updateSetting("launch_on_startup", e.target.checked)
                }
                className="w-4 h-4 accent-emerald-500"
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
