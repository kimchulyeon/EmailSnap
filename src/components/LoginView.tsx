import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUIStore } from "../stores/uiStore";
import { setSetting } from "../services/db";

function LoginView() {
  const navigateTo = useUIStore((s) => s.navigateTo);
  const showToast = useUIStore((s) => s.showToast);

  const [host, setHost] = useState("imap.worksmobile.com");
  const [port, setPort] = useState("993");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력하세요");
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

      // Save credentials to settings DB
      await setSetting("imap_host", host);
      await setSetting("imap_port", port);
      await setSetting("imap_email", email);
      await setSetting("imap_password", password);

      showToast("로그인 성공!");
      navigateTo("mail_list");
    } catch (err) {
      const msg = String(err);
      if (msg.includes("AUTH_FAILED") || msg.includes("Login failed")) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다");
      } else if (msg.includes("Connection failed")) {
        setError("서버에 연결할 수 없습니다. IMAP 설정을 확인하세요");
      } else {
        setError(`연결 실패: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">EmailSnap</h1>
        <p className="text-sm text-zinc-400">스마트 메일 알림</p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <p className="text-xs text-zinc-500 text-center leading-relaxed mb-2">
          네이버웍스 메일 계정으로 로그인하세요
        </p>

        {/* IMAP Server (collapsible advanced) */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="IMAP 서버"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="flex-1 bg-zinc-800 text-white text-sm rounded px-3 py-2 border border-zinc-700 placeholder:text-zinc-600"
          />
          <input
            type="text"
            placeholder="포트"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="w-16 bg-zinc-800 text-white text-sm rounded px-2 py-2 border border-zinc-700 placeholder:text-zinc-600 text-center"
          />
        </div>

        <input
          type="email"
          placeholder="이메일 주소"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          className="w-full bg-zinc-800 text-white text-sm rounded px-3 py-2 border border-zinc-700 placeholder:text-zinc-600"
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="w-full bg-zinc-800 text-white text-sm rounded px-3 py-2 border border-zinc-700 placeholder:text-zinc-600"
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
      </div>

      <div className="text-center space-y-1">
        <p className="text-[10px] text-zinc-600">
          IMAP 접속 방식 (imap.worksmobile.com:993 SSL)
        </p>
        <p className="text-[10px] text-zinc-600">
          메일 본문은 저장되지 않으며, 메타데이터만 로컬에 보관됩니다
        </p>
      </div>
    </div>
  );
}

export default LoginView;
