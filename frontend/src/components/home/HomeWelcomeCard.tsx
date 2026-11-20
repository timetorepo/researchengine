import React, { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/stores/useStore";

/** Static approved Home artwork. Never wraps the composer or private content. */
export function HomeWelcomeCard() {
  const [failed, setFailed] = useState(false);
  const editorial = useStore((s) => s.settings.homeEditorialHeading === true);
  const navigate = useNavigate();
  return (
    <section
      className="re-home-welcome mb-7"
      aria-labelledby="re-home-welcome-title"
      data-art={!failed}
    >
      {!failed && (
        <img
          className="re-home-welcome-art"
          src="/art/home-blue.webp"
          width={1280}
          height={720}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <div className="re-home-welcome-copy">
        <span className="re-home-welcome-kicker">
          RESEARCH ENGINE / YOUR WORKSPACE
        </span>
        <h1
          id="re-home-welcome-title"
          className={editorial ? "re-home-editorial-heading" : undefined}
        >
          Follow a thought.
          <br />
          See where it leads.
        </h1>
        <p>
          A calm starting point for notes, sources and connections.
          <br />
          The work itself stays on a quiet, readable surface.
        </p>
        <div className="re-home-welcome-actions">
          <button
            onClick={() =>
              document
                .querySelector<HTMLTextAreaElement>(
                  "[data-home-composer] textarea",
                )
                ?.focus()
            }
          >
            Start a question <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate("/board")}>
            Open Board <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
