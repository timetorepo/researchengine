import React from "react";

/** Fixed public strings/colours only: never accept user content or theme CSS here. */
export const SAMPLE = {
  kicker: "HOME / SAMPLE",
  title: "Follow a thought.",
  subtitle: "See where it leads.",
  note: "Fixed sample text. No workspace data.",
  plain: "#272824",
  blue: "#09172f",
} as const;
export function HomeTreatmentSample({ blue }: { blue: boolean }) {
  return (
    <div className="re-treatment-sample" data-blue={blue}>
      <span>{SAMPLE.kicker}</span>
      <strong>
        {SAMPLE.title}
        <br />
        {SAMPLE.subtitle}
      </strong>
      <p>{SAMPLE.note}</p>
    </div>
  );
}
