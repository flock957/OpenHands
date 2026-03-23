import { useNavigate, useLocation } from "react-router";
import { cn } from "#/utils/utils";

export function TaskCenterButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = pathname.startsWith("/tasks");

  return (
    <button
      type="button"
      onClick={() => navigate("/tasks")}
      title="任务中心"
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
        <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
        <path d="M15 3v4a2 2 0 0 0 2 2h4" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    </button>
  );
}
