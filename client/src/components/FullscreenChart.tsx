import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  children: (isFullscreen: boolean) => ReactNode;
}

export default function FullscreenChart({ title, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await ref.current?.requestFullscreen();
      }
    } catch {
      /* request may be rejected by the browser */
    }
  };

  return (
    <div
      ref={ref}
      className={`relative ${
        isFullscreen
          ? "bg-gray-950 flex items-center justify-center p-4"
          : ""
      }`}
    >
      <button
        onClick={toggle}
        title={isFullscreen ? "退出全屏 (Esc)" : `${title} 全屏`}
        className="absolute top-1 right-1 z-10 w-7 h-7 flex items-center justify-center rounded bg-gray-800/80 text-gray-300 hover:text-white hover:bg-gray-700 text-xs"
      >
        {isFullscreen ? "✕" : "⛶"}
      </button>
      {children(isFullscreen)}
    </div>
  );
}
