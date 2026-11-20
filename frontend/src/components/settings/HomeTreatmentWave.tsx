import React, { useCallback, useEffect, useRef } from "react";
import {
  DistortionWave,
  type DistortionWaveHandle,
  type CaptureFunction,
} from "distortion-waves";
import { HomeTreatmentSample, SAMPLE } from "./HomeTreatmentSample";

/** Safe capture adapter: draw fixed sample constants, not DOM, CSS, images or fonts.
 * In particular, never inspect request.element or scan the surrounding Settings. */
const captureSample: CaptureFunction = ({ slot, width, height, scale }) => {
  const canvas = document.createElement("canvas");
  const ratio = Math.min(1, Math.max(0.1, scale));
  canvas.width = Math.max(1, Math.min(800, Math.round(width * ratio)));
  canvas.height = Math.max(1, Math.min(240, Math.round(height * ratio)));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Sample canvas unavailable");
  context.scale(canvas.width / width, canvas.height / height);
  const blue = slot === "revealed";
  context.fillStyle = blue ? SAMPLE.blue : SAMPLE.plain;
  context.fillRect(0, 0, width, height);
  if (blue) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#09172f");
    gradient.addColorStop(0.6, "#123b81");
    gradient.addColorStop(1, "#7097c6");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  context.fillStyle = "#d9e2ef";
  context.font = "10px Arial, sans-serif";
  context.fillText(SAMPLE.kicker, 22, 28);
  context.fillStyle = "#f5f6fa";
  context.font = "26px Arial, sans-serif";
  context.fillText(SAMPLE.title, 22, 66);
  context.fillText(SAMPLE.subtitle, 22, 95);
  context.fillStyle = "#d9e2ef";
  context.font = "11px Arial, sans-serif";
  context.fillText(SAMPLE.note, 22, 126);
  return canvas;
};
export default function HomeTreatmentWave({
  blue,
  source,
  onFailure,
}: {
  blue: boolean;
  source: React.RefObject<HTMLDivElement | null>;
  onFailure: () => void;
}) {
  const wave = useRef<DistortionWaveHandle>(null);
  const previous = useRef(blue);
  const capture = useCallback<CaptureFunction>(
    (request) => {
      try {
        return captureSample(request);
      } catch {
        onFailure();
        throw new Error("Synthetic sample capture unavailable");
      }
    },
    [onFailure],
  );
  useEffect(() => {
    const root = wave.current?.element;
    if (!root) return;
    root.addEventListener("webglcontextlost", onFailure, true);
    return () => root.removeEventListener("webglcontextlost", onFailure, true);
  }, [onFailure]);
  useEffect(() => {
    const changed = previous.current !== blue;
    previous.current = blue;
    if (!changed) return;
    // The library applies the new target before this next rendering opportunity.
    const frame = requestAnimationFrame(() => {
      if (wave.current?.controller && !wave.current.controller.debug.webgl)
        onFailure();
    });
    return () => cancelAnimationFrame(frame);
  }, [blue, onFailure]);
  return (
    <DistortionWave
      ref={wave}
      revealed={blue}
      source={source}
      type="vertical"
      palette="ocean"
      capture={capture}
      prewarm={false}
      live={false}
      resolution={1}
      reducedMotion="system"
      revealedContent={<HomeTreatmentSample blue />}
    >
      <HomeTreatmentSample blue={false} />
    </DistortionWave>
  );
}
