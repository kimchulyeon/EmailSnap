import { useEffect, useState } from "react";
import { useUIStore } from "./stores/uiStore";
import { useSettingsStore } from "./stores/settingsStore";
import { getSetting } from "./services/db";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import LoginView from "./components/LoginView";
import ProjectList from "./components/ProjectList";
import ProjectMailList from "./components/ProjectMailList";
import Settings from "./components/Settings";
import Toast from "./components/Toast";

function App() {
  const currentView = useUIStore((s) => s.currentView);
  const navigateTo = useUIStore((s) => s.navigateTo);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadRules = useSettingsStore((s) => s.loadRules);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await loadSettings();
        await loadRules();

        // Request notification permission on startup
        try {
          const granted = await isPermissionGranted();
          console.log("[EmailSnap] notification permission:", granted);
          if (!granted) {
            const result = await requestPermission();
            console.log("[EmailSnap] notification permission request:", result);
          }
        } catch (e) {
          console.error("[EmailSnap] notification permission error:", e);
        }

        // Auto-login: check saved credentials
        const savedEmail = await getSetting("imap_email");
        const savedPassword = await getSetting("imap_password");
        if (savedEmail && savedPassword) {
          navigateTo("projects");
        }
      } catch (e) {
        console.error("[EmailSnap] init error:", e);
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, [loadSettings, loadRules, navigateTo]);

  if (initializing) {
    return (
      <div className="app-container items-center justify-center">
        <p className="text-zinc-500 text-sm">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {currentView === "login" && <LoginView />}
      {currentView === "projects" && <ProjectList />}
      {currentView === "project_mails" && <ProjectMailList />}
      {currentView === "settings" && <Settings />}
      <Toast />
    </div>
  );
}

export default App;
