import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { useInterfaceReducedMotion } from "@/lib/ui/useInterfaceReducedMotion";
import { SegmentedControl } from "@/components/ui/native/SegmentedControl";
import { Switch } from "@/components/ui/heroui/Switch";
import { HomeTreatmentSample } from "./HomeTreatmentSample";
import "./home-treatment-preview.css";

// Neither this lazy module nor distortion-waves is fetched until explicit opt-in.
const HomeTreatmentWave = lazy(() => import("./HomeTreatmentWave"));
class WaveBoundary extends React.Component<
  React.PropsWithChildren<{ fallback: React.ReactNode; onFailure: () => void }>,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function HomeTreatmentPreview() {
  const saved = useStore((s) => s.settings.homeWelcomeCard === true);
  const [draft, setDraft] = useState(saved);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [inView, setInView] = useState(false);
  const [applied, setApplied] = useState(false);
  const reduced = useInterfaceReducedMotion();
  const panel = useRef<HTMLDivElement>(null),
    source = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setDraft(saved);
  }, [saved]);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver((entries) =>
      setInView(entries[0]?.isIntersecting ?? false),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const fail = useCallback(() => setFailed(true), []);
  const enable = (value: boolean) => {
    if (value && !reduced) {
      try {
        const probe = document.createElement("canvas"),
          context = probe.getContext("webgl2");
        if (!context) {
          setFailed(true);
          return;
        }
        context.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        setFailed(true);
        return;
      }
    }
    setEnabled(value);
  };
  const apply = () => {
    // Real preference commit. No renderer callbacks, async imports or animation gates.
    useStore.setState((s) => ({
      settings: { ...s.settings, homeWelcomeCard: draft },
    }));
    setApplied(true);
  };
  const fallback = <HomeTreatmentSample blue={saved} />;
  return (
    <section className="re-treatment" aria-labelledby="re-treatment-title">
      <div className="re-treatment-heading">
        <div>
          <h3 id="re-treatment-title">Home welcome-card preview</h3>
          <p>
            Choose a treatment, then Apply. Only this fixed sample receives the
            wave.
          </p>
        </div>
        <span className="re-treatment-tag">SYNTHETIC PREVIEW</span>
      </div>
      <SegmentedControl
        label="Home treatment"
        value={draft ? "blue" : "plain"}
        onChange={(value) => {
          setDraft(value === "blue");
          setApplied(false);
        }}
        items={[
          { value: "plain", label: "Plain headline" },
          { value: "blue", label: "Blue welcome card" },
        ]}
      />
      <div ref={panel} className="re-treatment-preview">
        <div className="re-treatment-capture-boundary" aria-hidden="true">
          <WaveBoundary fallback={fallback} onFailure={fail}>
            {enabled && !failed && !reduced && visible && inView ? (
              <Suspense fallback={fallback}>
                <HomeTreatmentWave
                  blue={saved}
                  source={source}
                  onFailure={fail}
                />
              </Suspense>
            ) : (
              fallback
            )}
          </WaveBoundary>
        </div>
        {/* A stable live overlay, outside all captured DOM, survives lazy load/failure. */}
        <div ref={source} className="re-treatment-apply">
          <button
            type="button"
            className="re-treatment-confirm"
            aria-disabled={draft === saved}
            onClick={() => {
              if (draft !== saved) apply();
            }}
          >
            <Check size={14} />
            Apply Home treatment
          </button>
        </div>
      </div>
      <p className="re-treatment-status" role="status">
        {applied ? "Applied. " : "Current Home treatment: "}
        {saved ? "Blue welcome card." : "Plain headline."}
      </p>
      <Switch
        label="Wave confirmation"
        description="Animate Apply on this synthetic preview only. Optional; resets when this settings panel closes."
        checked={enabled && !failed}
        disabled={reduced || failed}
        onChange={enable}
      />
      <p className="re-treatment-note">
        {reduced
          ? "Reduced motion: instant preview, with no wave loaded or captured."
          : failed
            ? "Wave unavailable: the setting still applies instantly."
            : enabled
              ? "Waves enabled for this sample only. Settings save independently of the effect."
              : "Waves off. Enable confirmation, then choose a different treatment and Apply."}{" "}
        No workspace content, credentials or images are captured.
      </p>
    </section>
  );
}
