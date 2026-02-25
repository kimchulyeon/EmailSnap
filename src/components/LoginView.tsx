import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useUIStore } from "../stores/uiStore";
import { setSetting } from "../services/db";

const NAVER_WORKS_SECURITY_URL =
  "https://common.worksmobile.com/security-settings/app-password";

function LoginView() {
  const navigateTo = useUIStore((s) => s.navigateTo);
  const showToast = useUIStore((s) => s.showToast);

  const [host, setHost] = useState("imap.worksmobile.com");
  const [port, setPort] = useState("993");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("이메일과 외부 앱 비밀번호를 입력하세요");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await invoke("test_imap_connection", {
        host,
        port: Number(port),
        email,
        password,
      });

      await setSetting("imap_host", host);
      await setSetting("imap_port", port);
      await setSetting("imap_email", email);
      await setSetting("imap_password", password);

      showToast("로그인 성공!");
      navigateTo("projects");
    } catch (err) {
      const msg = String(err);
      if (msg.includes("AUTH_FAILED") || msg.includes("Login failed")) {
        setError(
          "인증 실패 - 외부 앱 비밀번호가 맞는지 확인하세요"
        );
      } else if (msg.includes("Connection failed")) {
        setError("서버에 연결할 수 없습니다. IMAP 설정을 확인하세요");
      } else {
        setError(`연결 실패: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPasswordGuide = async () => {
    await openUrl(NAVER_WORKS_SECURITY_URL);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-5 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">EmailSnap</h1>
        <p className="text-sm text-zinc-400">스마트 메일 알림</p>
      </div>

      {/* Guide Banner */}
      <div className="w-full max-w-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <p className="text-xs text-amber-300 leading-relaxed mb-2">
          네이버웍스 IMAP 로그인은 일반 비밀번호가 아닌
          <strong> 외부 앱 비밀번호</strong>가 필요합니다.
        </p>
        <button
          onClick={handleOpenPasswordGuide}
          className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
        >
          네이버웍스에서 외부 앱 비밀번호 생성하기 &rarr;
        </button>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <input
          type="email"
          placeholder="네이버웍스 이메일 주소"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2.5 border border-zinc-700 placeholder:text-zinc-500"
        />

        <input
          type="password"
          placeholder="외부 앱 비밀번호"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2.5 border border-zinc-700 placeholder:text-zinc-500"
        />

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
        >
          {loading ? "연결 중..." : "로그인"}
        </button>

        {/* Advanced: IMAP server settings */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
        >
          {showAdvanced ? "서버 설정 닫기" : "서버 설정 변경"}
        </button>

        {showAdvanced && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="IMAP 서버"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="flex-1 bg-zinc-800 text-white text-xs rounded px-3 py-2 border border-zinc-700 placeholder:text-zinc-600"
            />
            <input
              type="text"
              placeholder="포트"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-16 bg-zinc-800 text-white text-xs rounded px-2 py-2 border border-zinc-700 placeholder:text-zinc-600 text-center"
            />
          </div>
        )}
      </div>

      <p className="text-[10px] text-zinc-600 text-center">
        메일 본문은 저장되지 않으며, 메타데이터만 로컬에 보관됩니다
      </p>
    </div>
  );
}

export default LoginView;
