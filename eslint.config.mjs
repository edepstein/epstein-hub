import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Client components hydrate from localStorage (an external system) in mount effects;
      // that is the documented pattern for device-local saves, so this rule is disabled.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: ["reference/**", ".next/**", "node_modules/**", "test-results/**", "playwright-report/**", "next-env.d.ts", "public/**", ".claude/**"],
  },
];

export default config;
