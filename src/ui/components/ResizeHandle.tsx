import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Bottom-right drag grip that resizes the Figma plugin window. Figma exposes no
 * native resize corner, so the UI tracks the pointer delta and asks the sandbox
 * to call `figma.ui.resize` (see the RESIZE message). The size baseline is read
 * once on pointerdown; during the drag we compute from that origin + total delta
 * so the async iframe resize never feeds back into jitter.
 */

const MIN_WIDTH = 320;
const MIN_HEIGHT = 420;
const MAX_WIDTH = 1000;
const MAX_HEIGHT = 1400;
const KEY_STEP = 20;
const KEY_STEP_LARGE = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type ResizeHandleProps = {
  onResize: (width: number, height: number) => void;
  /** Inert outside Figma (a browser tab cannot resize itself). */
  disabled?: boolean;
};

export function ResizeHandle({
  onResize,
  disabled = false,
}: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const origin = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const pending = useRef({ width: 0, height: 0 });
  const frame = useRef(0);

  const sendResize = useCallback(
    (width: number, height: number) => {
      onResize(
        clamp(Math.round(width), MIN_WIDTH, MAX_WIDTH),
        clamp(Math.round(height), MIN_HEIGHT, MAX_HEIGHT)
      );
    },
    [onResize]
  );

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    []
  );

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = {
      x: event.clientX,
      y: event.clientY,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !dragging) return;
    const { x, y, width, height } = origin.current;
    pending.current = {
      width: width + (event.clientX - x),
      height: height + (event.clientY - y),
    };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      sendResize(pending.current.width, pending.current.height);
    });
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !dragging) return;
    const el = event.currentTarget;
    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    setDragging(false);
    // Flush the last pending size so the final window matches the pointer.
    sendResize(pending.current.width, pending.current.height);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    let dx = 0;
    let dy = 0;
    switch (event.key) {
      case "ArrowRight":
        dx = step;
        break;
      case "ArrowLeft":
        dx = -step;
        break;
      case "ArrowDown":
        dy = step;
        break;
      case "ArrowUp":
        dy = -step;
        break;
      default:
        return;
    }
    event.preventDefault();
    sendResize(window.innerWidth + dx, window.innerHeight + dy);
  }

  const color = dragging
    ? "text-[var(--primary)]"
    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]";

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="调整插件窗口大小"
      aria-disabled={disabled || undefined}
      title="拖动以调整大小"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={`fixed bottom-0 right-0 z-50 flex h-5 w-5 touch-none select-none items-end justify-end p-1 outline-none focus-visible:text-[var(--primary)] ${
        disabled ? "cursor-default opacity-30" : `cursor-nwse-resize ${color}`
      }`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none"
      >
        <path
          d="M9 3.2 L3.2 9 M9 6.8 L6.8 9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
