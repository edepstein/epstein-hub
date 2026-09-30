"use client";

import { ComingSoon } from "@/components/game/ComingSoon";
import { definition } from "./definition";

export default function Play() {
  return <ComingSoon game={definition} />;
}
