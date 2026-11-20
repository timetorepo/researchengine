import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useStore } from "@/stores/useStore";
import { useInterfaceReducedMotion } from "@/lib/ui/useInterfaceReducedMotion";
import "./action-receipt.css";

const ReceiptWave = lazy(() => import("./ReceiptWave"));
class Boundary extends React.Component<
  React.PropsWithChildren<{ fallback: React.ReactNode; fail: () => void }>,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.fail();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
/** Only a successful explicit operation increments serial. Never pass form data here. */
export function ActionReceipt({
  serial,
  layout = false,
}: {
  serial: number;
  layout?: boolean;
}) {
  const enabled = useStore((s) => s.settings.actionConfirmationWaves === true);
  const reduced = useInterfaceReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(serial);
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => {
    setFailed(true);
    setActive(false);
  }, []);
  useEffect(() => {
    if (serial !== previous.current) {
      previous.current = serial;
      const box = root.current?.getBoundingClientRect();
      setActive(
        !!serial &&
          enabled &&
          !reduced &&
          !document.hidden &&
          !!box &&
          box.bottom > 0 &&
          box.top < innerHeight,
      );
    }
  }, [serial, enabled, reduced]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setActive(false);
    };
    document.addEventListener("visibilitychange", hide);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver((entries) => {
            if (!entries[0]?.isIntersecting) setActive(false);
          });
    if (root.current) observer?.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      observer?.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!enabled || reduced) setActive(false);
  }, [enabled, reduced]);
  const fallback = <ReceiptSample saved={serial > 0} layout={layout} />;
  return (
    <div
      ref={root}
      className="re-action-receipt"
      data-action-receipt
      style={serial ? undefined : { margin: 0 }}
    >
      {serial > 0 && enabled && (
        <div aria-hidden="true" className="re-action-visual">
          <Boundary fallback={fallback} fail={fail}>
            {active && enabled && !reduced && !failed ? (
              <Suspense fallback={fallback}>
                <ReceiptWave key={serial} layout={layout} onFailure={fail} />
              </Suspense>
            ) : (
              fallback
            )}
          </Boundary>
        </div>
      )}
      {serial > 0 && (
        <p role="status">
          {serial > 0
            ? layout
              ? "Layout applied."
              : "Changes saved locally."
            : "Confirmation appears here after saving."}
        </p>
      )}
      {serial > 0 && failed && <p>Wave unavailable. Saving is unaffected.</p>}
    </div>
  );
}
export function ReceiptSample({
  saved,
  layout,
}: {
  saved: boolean;
  layout: boolean;
}) {
  return (
    <div className="re-receipt-sample" data-saved={saved}>
      {layout && (
        <div className="re-receipt-layout">
          <i />
          <i />
          <i />
        </div>
      )}
      <strong>
        {saved
          ? layout
            ? "Layout applied"
            : "Changes saved"
          : layout
            ? "Workspace layout"
            : "Unsaved changes"}
      </strong>
      <span>Synthetic confirmation · no workspace content</span>
    </div>
  );
}
