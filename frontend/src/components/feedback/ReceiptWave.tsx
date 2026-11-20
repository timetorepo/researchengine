import { useEffect, useRef, useState } from "react";
import {
  DistortionWave,
  type CaptureFunction,
  type DistortionWaveHandle,
} from "distortion-waves";
import { ReceiptSample } from "./ActionReceipt";

/** Fixed public receipt only. Never access request.element, DOM, CSS or user values. */
function captureReceipt(layout: boolean): CaptureFunction {
  return ({ slot, width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.min(800, Math.round(width)));
    canvas.height = Math.max(1, Math.min(160, Math.round(height)));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Receipt canvas unavailable");
    ctx.scale(canvas.width / width, canvas.height / height);
    const saved = slot === "revealed";
    ctx.fillStyle = saved ? "#153b45" : "#272824";
    ctx.fillRect(0, 0, width, height);
    if (layout) {
      ctx.fillStyle = "#86b9c7";
      ctx.fillRect(16, 14, saved ? 24 : 40, 28);
      ctx.fillRect(saved ? 46 : 62, 14, saved ? 90 : 74, 28);
      ctx.fillRect(142, 14, 28, 28);
    }
    ctx.fillStyle = "#f5f6fa";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText(
      saved
        ? layout
          ? "Layout applied"
          : "Changes saved"
        : layout
          ? "Workspace layout"
          : "Unsaved changes",
      16,
      layout ? 65 : 32,
    );
    ctx.font = "11px Arial, sans-serif";
    ctx.fillStyle = "#d9e2ef";
    ctx.fillText(
      "Synthetic confirmation · no workspace content",
      16,
      layout ? 86 : 53,
    );
    return canvas;
  };
}
export default function ReceiptWave({
  layout,
  onFailure,
}: {
  layout: boolean;
  onFailure: () => void;
}) {
  const wave = useRef<DistortionWaveHandle>(null);
  const [revealed, setRevealed] = useState(false);
  const [capture] = useState<CaptureFunction>(() => {
    const draw = captureReceipt(layout);
    return (request: Parameters<CaptureFunction>[0]) => {
      try {
        return draw(request);
      } catch {
        onFailure();
        throw new Error("Synthetic receipt capture unavailable");
      }
    };
  });
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setRevealed(true));
    });
    const root = wave.current?.element;
    root?.addEventListener("webglcontextlost", onFailure, true);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      root?.removeEventListener("webglcontextlost", onFailure, true);
    };
  }, [onFailure]);
  useEffect(() => {
    if (!revealed) return;
    const frame = requestAnimationFrame(() => {
      if (!wave.current?.controller?.debug.webgl) onFailure();
    });
    return () => cancelAnimationFrame(frame);
  }, [revealed, onFailure]);
  return (
    <DistortionWave
      ref={wave}
      revealed={revealed}
      type="vertical"
      palette="ocean"
      capture={capture}
      prewarm={false}
      live={false}
      resolution={1}
      reducedMotion="system"
      revealedContent={<ReceiptSample saved layout={layout} />}
    >
      <ReceiptSample saved={false} layout={layout} />
    </DistortionWave>
  );
}
