import { useEffect } from "react";
import { useUIStore } from "./stores/uiStore";
import { useSettingsStore } from "./stores/settingsStore";
import LoginView from "./components/LoginView";
import MailList from "./components/MailList";
import Settings from "./components/Settings";
import Toast from "./components/Toast";

function App() {
  const currentView = useUIStore((s) => s.currentView);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadRules = useSettingsStore((s) => s.loadRules);

  useEffect(() => {
    loadSettings();
    loadRules();
  }, [loadSettings, loadRules]);

  return (
    <div className="app-container">
      {currentView === "login" && <LoginView />}
      {currentView === "mail_list" && <MailList />}
      {currentView === "settings" && <Settings />}
      <Toast />
    </div>
  );
}

export default App;
