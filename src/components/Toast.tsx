import { useUIStore } from "../stores/uiStore";

function Toast() {
  const toastMessage = useUIStore((s) => s.toastMessage);

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-zinc-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in">
      {toastMessage}
    </div>
  );
}

export default Toast;
