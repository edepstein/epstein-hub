import type { CSSProperties } from "react";
import type { GameTheme } from "@/games/types";

/**
 * Decorative board silhouette for shelf cards (ported from the v2 reference).
 * Uses fixed illustrative letters, never a live puzzle's answer. aria-hidden.
 */
export function Poster({ theme }: { theme: GameTheme }) {
  const kind = theme.poster;
  const style = { "--accent": theme.accent, "--wash": theme.wash } as CSSProperties;
  let art: React.ReactNode;
  if (kind === "hex") {
    art = (
      <div className="mini-hex">
        {"WORDPLAY".split("").map((l, i) => (
          <i key={i}>{l}</i>
        ))}
      </div>
    );
  } else if (kind === "orbit" || kind === "petals") {
    const letters = kind === "orbit" ? "EDUCTION" : "CELNPT";
    art = (
      <div className={`mini-orbit ${kind}`}>
        {letters.split("").map((l, i) => (
          <i
            key={i}
            style={
              {
                "--x": `${50 + 34 * Math.sin((i * Math.PI * 2) / letters.length)}%`,
                "--y": `${50 - 34 * Math.cos((i * Math.PI * 2) / letters.length)}%`,
              } as CSSProperties
            }
          >
            {l}
          </i>
        ))}
        <i className="mini-centre">A</i>
      </div>
    );
  } else if (["code", "groups", "cross", "weave", "path", "table"].includes(kind)) {
    const letters =
      kind === "code" ? "C R A T E  ?    " : kind === "groups" ? "BIRD GEM HERB NOTE" : kind === "path" ? "R O S E I R I S M I N T F E R N" : kind === "table" ? "   C A T       " : "W O R D  C L U E";
    art = (
      <div className={`mini-grid ${kind}`}>
        {letters
          .split(" ")
          .slice(0, 16)
          .map((l, i) => (
            <i key={i} className={`m${i % 4}`}>
              {l}
            </i>
          ))}
      </div>
    );
  } else if (kind === "stairs" || kind === "shrink") {
    art = (
      <div className="mini-stairs">
        {(kind === "stairs" ? ["COLD", "CORD", "CARD"] : ["STEAM", "MEAT", "MAT"]).map((w) => (
          <i key={w}>{w}</i>
        ))}
      </div>
    );
  } else if (kind === "pair" || kind === "bridge") {
    art = (
      <div className="mini-pair">
        <i>{kind === "pair" ? "bird" : "HAND"}</i>
        <b>{kind === "pair" ? "&" : "?"}</b>
        <i>{kind === "pair" ? "machine" : "PIPE"}</i>
      </div>
    );
  } else if (kind === "circuit") {
    art = (
      <div className="mini-circuit">
        <i>T O P</i>
        <b>↗</b>
        <i>S I C</i>
      </div>
    );
  } else if (kind === "scraps" || kind === "tickets" || kind === "relay") {
    art = (
      <div className="mini-scraps">
        {(kind === "scraps" ? ["EDU", "CAT", "ION"] : kind === "tickets" ? ["CRY", "OVER", "MILK"] : ["STARE", "+ N", "ASTERN"]).map((w) => (
          <i key={w}>{w}</i>
        ))}
      </div>
    );
  } else {
    art = (
      <div className="mini-note">
        <small>{kind === "dossier" ? "CASE 01" : "CLUE 01"}</small>
        <i>{kind === "dossier" ? "Follow the evidence." : "Hidden in plain sight."}</i>
        <b>_________</b>
      </div>
    );
  }
  return (
    <span className={`poster poster-${kind}`} style={style} aria-hidden="true">
      {art}
      <span className="poster-star">✳</span>
    </span>
  );
}
