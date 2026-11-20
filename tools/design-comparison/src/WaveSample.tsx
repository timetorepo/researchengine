import React, { useRef, useEffect } from "react";
import { DistortionWave, type DistortionWaveHandle } from "distortion-waves";
export function Swatch({ revealed }: { revealed: boolean }) {
  return (
    <div className={`swatch ${revealed ? "clay" : "stone"}`}>
      <span>{revealed ? "02 / CLAY" : "01 / STONE"}</span>
      <strong>
        {revealed ? "A warmer point of view." : "A little more clarity."}
      </strong>
      <p>
        Synthetic colour and text.
        <br />
        Nothing from your workspace.
      </p>
    </div>
  );
}
export default function WaveSample({
  revealed,
  onFailure,
}: {
  revealed: boolean;
  onFailure: () => void;
}) {
  const ref = useRef<DistortionWaveHandle>(null);
  useEffect(() => {
    const root = ref.current?.element;
    if (!root) return;
    root.addEventListener("webglcontextlost", onFailure, true);
    return () => root.removeEventListener("webglcontextlost", onFailure, true);
  }, [onFailure]);
  return (
    <DistortionWave
      ref={ref}
      revealed={revealed}
      prewarm={false}
      live={false}
      resolution={1}
      type="horizontal"
      reducedMotion="system"
      revealedContent={<Swatch revealed={true} />}
    >
      <Swatch revealed={false} />
    </DistortionWave>
  );
}
