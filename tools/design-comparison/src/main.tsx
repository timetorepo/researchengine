import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  MessageSquare,
  LayoutDashboard,
  Library,
  Code,
  Settings,
  ArrowRight,
  Check,
  FlaskConical,
} from "lucide-react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/lilex";
import "./style.css";
const WaveSample = lazy(() => import("./WaveSample"));
const nav = [
  { label: "Home", Icon: Home },
  { label: "Chats", Icon: MessageSquare },
  { label: "Board", Icon: LayoutDashboard },
  { label: "Library", Icon: Library },
  { label: "Coding", Icon: Code },
];
class EffectBoundary extends React.Component<
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
function App() {
  const systemReduced = useReducedMotion(),
    [motionOff, setMotionOff] = useState(false),
    [light, setLight] = useState(false),
    [opaque, setOpaque] = useState(false);
  const reduced = !!systemReduced || motionOff,
    [open, setOpen] = useState(() => !matchMedia("(max-width:760px)").matches),
    [mobile, setMobile] = useState(
      () => matchMedia("(max-width:760px)").matches,
    ),
    [section, setSection] = useState("Home"),
    [scenario, setScenario] = useState("populated");
  const [font, setFont] = useState("baseline"),
    [ligatures, setLigatures] = useState(false),
    [enabled, setEnabled] = useState(false),
    [revealed, setRevealed] = useState(false),
    [failed, setFailed] = useState(false),
    [visible, setVisible] = useState(!document.hidden);
  const toggle = useRef<HTMLButtonElement>(null),
    drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    const query = matchMedia("(max-width:760px)"),
      update = () => {
        setMobile(query.matches);
        setOpen(!query.matches);
      };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    toggle.current?.focus();
  }, []);
  useEffect(() => {
    if (!mobile || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const items = [
          toggle.current,
          ...Array.from(
            drawer.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
          ),
        ].filter(Boolean) as HTMLButtonElement[];
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
    };
  }, [mobile, open, close]);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const fail = useCallback(() => setFailed(true), []);
  const activate = () => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      setFailed(true);
      return;
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    setEnabled(true);
  };
  const plain = (
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
  return (
    <div
      className={`app ${light ? "light" : ""} ${opaque ? "opaque" : ""}`}
      data-font={font}
      data-reduced={reduced}
    >
      <a className="skip" href="#comparison">
        Skip to comparison
      </a>
      <header className="masthead">
        <a className="wordmark" href="#comparison">
          <img
            className="brand-mark"
            src="/research-engine-symbol.svg"
            alt=""
            width="30"
            height="30"
          />
          <span>
            Research Engine<span className="sub-brand">DESIGN STUDY / 01</span>
          </span>
        </a>
        <span className="prototype">
          <FlaskConical size={14} /> Isolated prototype
        </span>
      </header>
      <main id="comparison">
        <div className="intro">
          <div>
            <span className="eyebrow">A QUIETER WORKSPACE</span>
            <h1>
              Room to think.
              <br />
              <em>Less in the way.</em>
            </h1>
          </div>
          <div className="intro-note">
            <span className="short-rule" />
            <p>
              Familiar tools. A more deliberate rhythm.
              <br />
              Explore navigation, material and type before
              <br /> anything changes in your workspace.
            </p>
            <a href="#navigation">
              Explore the comparison <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
        <div className="controls" aria-label="Preview preferences">
          <span>Preview only</span>
          <label>
            <input
              type="checkbox"
              checked={light}
              onChange={(e) => setLight(e.target.checked)}
            />{" "}
            Light surface
          </label>
          <label>
            <input
              type="checkbox"
              checked={opaque}
              onChange={(e) => setOpaque(e.target.checked)}
            />{" "}
            Opaque material
          </label>
          <label>
            <input
              type="checkbox"
              checked={motionOff}
              onChange={(e) => setMotionOff(e.target.checked)}
            />{" "}
            Motion off
          </label>
          {systemReduced && <small>System reduced motion respected</small>}
        </div>
        <section id="navigation" className="study">
          <div className="section-heading">
            <div>
              <span className="index">01</span>
              <h2>Navigation, with continuity.</h2>
            </div>
            <p>Open. Close. Change your mind midway.</p>
          </div>
          <div
            className="workspace"
            data-open={open}
            role={mobile && open ? "dialog" : undefined}
            aria-modal={mobile && open ? true : undefined}
            aria-label={
              mobile && open ? "Sample workspace navigation" : undefined
            }
          >
            <div className="workspace-bar">
              <button
                ref={toggle}
                aria-label={
                  open ? "Close sample sidebar" : "Open sample sidebar"
                }
                aria-expanded={open}
                aria-controls="sample-sidebar"
                onClick={() => setOpen((value) => !value)}
              >
                {open ? (
                  <PanelLeftClose size={18} />
                ) : (
                  <PanelLeftOpen size={18} />
                )}
                <span>Workspace</span>
              </button>
              <span className="sample-label">
                SAMPLE CONTENT / NO LOCAL DATA
              </span>
            </div>
            <div
              className="workspace-body"
              style={{
                gridTemplateColumns: mobile ? "1fr" : `${open ? 224 : 0}px 1fr`,
              }}
            >
              {mobile && open && (
                <button
                  className="scrim"
                  aria-label="Dismiss sample sidebar"
                  tabIndex={-1}
                  onClick={close}
                />
              )}
              <motion.aside
                ref={drawer}
                id="sample-sidebar"
                aria-label="Sample workspace navigation"
                aria-hidden={!open}
                inert={!open}
                initial={false}
                animate={{ x: open ? 0 : -224, opacity: open ? 1 : 0 }}
                transition={{
                  duration: reduced ? 0 : open ? 0.2 : 0.16,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div className="sidebar-context">
                  <span className="context-mark">R</span>
                  <div>
                    Personal workspace<small>Local · sample only</small>
                  </div>
                </div>
                <nav aria-label="Sample sections">
                  {nav.map(({ label, Icon }) => (
                    <button
                      key={label}
                      aria-current={section === label ? "page" : undefined}
                      onClick={() => {
                        setSection(label);
                        if (mobile) close();
                      }}
                    >
                      <Icon size={17} />
                      <span>{label}</span>
                      {section === label && <span className="nav-dot" />}
                    </button>
                  ))}
                </nav>
                <div className="sidebar-bottom">
                  <Settings size={16} />
                  <span>Preferences unchanged</span>
                </div>
              </motion.aside>
              <div
                className="reading-pane"
                inert={mobile && open ? true : undefined}
                aria-hidden={mobile && open ? true : undefined}
              >
                <div className="pane-top">
                  <span>WORKSPACE / {section.toUpperCase()}</span>
                  <label>
                    State{" "}
                    <select
                      aria-label="Sample content state"
                      value={scenario}
                      onChange={(e) => setScenario(e.target.value)}
                    >
                      <option value="populated">Populated</option>
                      <option value="empty">Empty</option>
                      <option value="error">Error</option>
                    </select>
                  </label>
                </div>
                <h3>
                  {section === "Home"
                    ? "A place for your next idea."
                    : section === "Board"
                      ? "See the connections."
                      : `Your ${section.toLowerCase()}, in focus.`}
                </h3>
                <p className="pane-lead">
                  A stable reading surface. Navigation moves; your words don't.
                </p>
                {scenario === "populated" ? (
                  <div className="sample-list">
                    {[
                      "Notes worth returning to",
                      "A question to follow",
                      "Connections in the margins",
                    ].map((title, i) => (
                      <div key={title}>
                        <span className="list-number">0{i + 1}</span>
                        <div>
                          <strong>{title}</strong>
                          <p>
                            {
                              [
                                "Collect a source. Keep the context.",
                                "Make space for a different perspective.",
                                "Bring related ideas into the same view.",
                              ][i]
                            }
                          </p>
                        </div>
                        <ArrowUpRight size={16} />
                      </div>
                    ))}
                  </div>
                ) : scenario === "empty" ? (
                  <div className="state-message">
                    <Library size={22} />
                    <strong>No sample notes yet</strong>
                    <p>
                      Empty states explain the next step, not invent activity.
                    </p>
                  </div>
                ) : (
                  <div className="state-message" role="status">
                    <strong>This is a sample error state.</strong>
                    <p>Your content stays in place. No request was sent.</p>
                    <button onClick={() => setScenario("populated")}>
                      Restore sample
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="caption">
            {reduced
              ? "Immediate changes · motion disabled"
              : "200 ms open / 160 ms close · transform + opacity"}
            <span>
              Single layout change. No width tween. No saved preferences.
            </span>
          </p>
        </section>
        <div className="paired-studies">
          <section className="study" id="waves">
            <div className="section-heading">
              <div>
                <span className="index">02</span>
                <h2>A little expression.</h2>
              </div>
            </div>
            <p className="section-copy">
              One bounded colour preview. Never a private document, credential
              or conversation.
            </p>
            <div className="wave-box">
              <EffectBoundary fallback={plain} onFailure={fail}>
                {enabled && !failed && !reduced && visible ? (
                  <Suspense fallback={plain}>
                    <WaveSample revealed={revealed} onFailure={fail} />
                  </Suspense>
                ) : (
                  plain
                )}
              </EffectBoundary>
            </div>
            <div className="wave-actions">
              <button
                className="primary"
                onClick={() => setRevealed((value) => !value)}
              >
                {revealed ? "Preview stone" : "Preview clay"}
                <ArrowRight size={16} />
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={enabled && !failed}
                  disabled={reduced || failed}
                  onChange={(e) =>
                    e.target.checked ? activate() : setEnabled(false)
                  }
                />{" "}
                Enable Waves trial
              </label>
            </div>
            <p className="caption" role="status">
              {failed
                ? "Waves unavailable. Colour preview still works."
                : reduced
                  ? "Motion disabled. No Waves capture or rendering."
                  : enabled
                    ? "Waves enabled · synthetic content only"
                    : "Waves off · loaded only after opt-in"}
            </p>
          </section>
          <section className="study type-study" id="typography">
            <div className="section-heading">
              <div>
                <span className="index">03</span>
                <h2>Character, not noise.</h2>
              </div>
            </div>
            <p className="section-copy">
              Inter is a neutral reference. Compare a softer shell and an
              editorial accent; your chosen app font stays unchanged.
            </p>
            <div
              className="font-options"
              role="group"
              aria-label="Typography comparison"
            >
              {[
                ["baseline", "Inter baseline"],
                ["rounded", "Geist Rounded"],
                ["editorial", "Newsreader"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={font === value}
                  onClick={() => setFont(value)}
                >
                  {font === value && <Check size={13} />} {label}
                </button>
              ))}
            </div>
            <div className="type-specimen">
              <span className="eyebrow">READ / CONNECT / RETURN</span>
              <h3>
                Good questions
                <br />
                deserve clear space.
              </h3>
              <p>
                Catatan kecil, gagasan besar. Keep your sources close and your
                own perspective closer.
              </p>
              <div className="metadata">
                12 sources · 08:42 · research-notes_2026.md
              </div>
            </div>
            <div className="code-specimen">
              <div>
                <span>LILEX / OPTIONAL CODE FACE</span>
                <label>
                  <input
                    type="checkbox"
                    checked={ligatures}
                    onChange={(e) => setLigatures(e.target.checked)}
                  />{" "}
                  Ligatures
                </label>
              </div>
              <code
                style={{ fontVariantLigatures: ligatures ? "normal" : "none" }}
              >
                {"const ready = source !== null;"}
                <br />
                {"const next = (source) => source; // sample"}
              </code>
            </div>
          </section>
        </div>
        <footer>
          <span>RESEARCH ENGINE / DESIGN COMPARISON</span>
          <p>
            Nothing here changes your app settings. No workspace data is loaded.
          </p>
          <span>Built to be considered, not imposed.</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
