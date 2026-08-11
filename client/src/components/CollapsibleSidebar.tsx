import { useState } from "react";
import type { ReactNode } from "react";

interface CollapsibleSidebarProps {
  children: ReactNode;
  width?: string;
  className?: string;
}

export default function CollapsibleSidebar({
  children,
  width = "w-72",
  className = "",
}: CollapsibleSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`relative shrink-0 bg-gray-900 border-r border-gray-800 transition-all duration-300 flex flex-col ${
        collapsed ? "w-10" : width
      } ${className}`}
    >
      <div
        className={`flex items-center shrink-0 p-1.5 ${
          collapsed ? "justify-center" : "justify-end"
        }`}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "展开面板" : "收缩面板"}
          className="w-6 h-6 flex items-center justify-center rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white text-xs"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      )}
    </div>
  );
}
