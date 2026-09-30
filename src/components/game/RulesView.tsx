import type { RulesContent } from "@/games/types";

export function RulesView({ rules, headingLevel = 3 }: { rules: RulesContent; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="rules-view">
      <p style={{ lineHeight: 1.6 }}>{rules.summary}</p>
      {rules.sections.map((s) => (
        <section key={s.heading}>
          <H>{s.heading}</H>
          <ul>
            {s.points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      ))}
      {rules.example ? (
        <>
          <H>Example</H>
          <p style={{ lineHeight: 1.6 }}>{rules.example}</p>
        </>
      ) : null}
    </div>
  );
}
