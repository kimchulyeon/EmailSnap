import { useUIStore } from "../stores/uiStore";

function LoginView() {
  const navigateTo = useUIStore((s) => s.navigateTo);

  const handleLogin = () => {
    // TODO: NaverWorks OAuth2 인증 플로우 구현
    // 1. OAuth2 Authorization Code Grant
    // 2. Access Token + Refresh Token 발급
    // 3. OS Secure Storage에 토큰 저장
    navigateTo("mail_list");
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">EmailSnap</h1>
        <p className="text-sm text-zinc-400">스마트 메일 알림</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <p className="text-xs text-zinc-500 text-center leading-relaxed">
          네이버웍스 계정으로 로그인하여
          <br />
          메일 알림 서비스를 시작하세요
        </p>

        <button
          onClick={handleLogin}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
        >
          네이버웍스 로그인
        </button>
      </div>

      <p className="text-[10px] text-zinc-600 mt-4">
        메일 본문은 저장되지 않으며, 메타데이터만 로컬에 보관됩니다
      </p>
    </div>
  );
}

export default LoginView;
