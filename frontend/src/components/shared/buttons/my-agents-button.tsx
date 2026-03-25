/* eslint-disable jsx-a11y/control-has-associated-label */
import { useNavigate, useLocation } from "react-router";
import { cn } from "#/utils/utils";

export function MyAgentsButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = pathname === "/my-agents";

  return (
    <button
      type="button"
      onClick={() => navigate("/my-agents")}
      title="我的 Agent"
      className={cn(
        "w-[36px] h-[36px] rounded flex items-center justify-center transition",
        isActive
          ? "bg-[#4ECDC4] text-black"
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
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </button>
  );
}
