// Built-in score library.
// Each score lives in its own file under ./library (written Bb trumpet notation).
// To add one: create library/<id>.ts exporting a Score, then list it in SCORES below.

import { Score } from "./types";
import gammeDoMajeur from "./library/gamme-do-majeur";
import hotCrossBuns from "./library/hot-cross-buns";
import lightlyRow from "./library/lightly-row";
import londonBridge from "./library/london-bridge";
import oldMacdonald from "./library/old-macdonald";
import amazingGrace from "./library/amazing-grace";
import auClairDeLaLune from "./library/au-clair-de-la-lune";
import ahVousDiraiJeMaman from "./library/ah-vous-dirai-je-maman";
import maryHadALittleLamb from "./library/mary-had-a-little-lamb";
import viveLeVent from "./library/vive-le-vent";
import frereJacques from "./library/frere-jacques";
import odeALaJoie from "./library/ode-a-la-joie";
import happyBirthday from "./library/happy-birthday";
import flyMeToTheMoon from "./library/fly-me-to-the-moon";
import summertime from "./library/summertime";
import whenTheSaints from "./library/when-the-saints";
import autumnLeaves from "./library/autumn-leaves";

export * from "./types";
export * from "./timing";

// Built-in scores, in display order (beginner pieces first)
export const SCORES: Score[] = [
  gammeDoMajeur,
  hotCrossBuns,
  lightlyRow,
  londonBridge,
  oldMacdonald,
  amazingGrace,
  auClairDeLaLune,
  ahVousDiraiJeMaman,
  maryHadALittleLamb,
  viveLeVent,
  frereJacques,
  odeALaJoie,
  happyBirthday,
  flyMeToTheMoon,
  summertime,
  whenTheSaints,
  autumnLeaves,
];

// Search by title (case-insensitive, accent-insensitive)
export function findScore(query: string): Score | undefined {
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const r = normalize(query);
  return SCORES.find((p) => normalize(p.title).includes(r) || normalize(p.id).includes(r));
}
