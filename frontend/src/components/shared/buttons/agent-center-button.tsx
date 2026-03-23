import { useNavigate, useLocation } from "react-router";
import { cn } from "#/utils/utils";

export function AgentCenterButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = pathname.startsWith("/agents");

  return (
    <button
      type="button"
      onClick={() => navigate("/agents")}
      title="Agent 中心"
      className={cn(
        "w-[36px] h-[36px] rounded flex items-center justify-center transition",
        isActive
          ? "bg-blue-600 text-white"
          : "text-gray-400 hover:text-white hover:bg-[#333]",
      )}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    </button>
  );
}
