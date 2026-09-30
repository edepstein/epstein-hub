"use client";
/* Client component map. Each Play component is code-split. */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { PlayProps } from "./play-types";

const loading = () => <div className="empty" role="status">Loading the board…</div>;

export const PLAY_COMPONENTS: Record<string, ComponentType<PlayProps>> = {
  "letter-wheel": dynamic(() => import("./letter-wheel/Play"), { loading }),
  "letter-set": dynamic(() => import("./letter-set/Play"), { loading }),
  "word-deduction": dynamic(() => import("./word-deduction/Play"), { loading }),
  "word-families": dynamic(() => import("./word-families/Play"), { loading }),
  "hidden-word-trail": dynamic(() => import("./hidden-word-trail/Play"), { loading }),
  "letter-circuit": dynamic(() => import("./letter-circuit/Play"), { loading }),
  "daily-crossword": dynamic(() => import("./daily-crossword/Play"), { loading }),
  "word-ladder": dynamic(() => import("./word-ladder/Play"), { loading }),
  "clue-pairs": dynamic(() => import("./clue-pairs/Play"), { loading }),
  "word-weave": dynamic(() => import("./word-weave/Play"), { loading }),
  "cryptic-workshop": dynamic(() => import("./cryptic-workshop/Play"), { loading }),
  "shrinking-staircase": dynamic(() => import("./shrinking-staircase/Play"), { loading }),
  "word-fragments": dynamic(() => import("./word-fragments/Play"), { loading }),
  "missing-links": dynamic(() => import("./missing-links/Play"), { loading }),
  "phrase-repair": dynamic(() => import("./phrase-repair/Play"), { loading }),
  "anagram-relay": dynamic(() => import("./anagram-relay/Play"), { loading }),
  "definition-detective": dynamic(() => import("./definition-detective/Play"), { loading }),
  "shared-word-board": dynamic(() => import("./shared-word-board/Play"), { loading }),
  "hexabble": dynamic(() => import("./hexabble/Play"), { loading }),
};
