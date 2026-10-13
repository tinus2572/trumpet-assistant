import TrumpetAnalyzer from "@/components/TrumpetAnalyzer";
import { loadScores } from "@/lib/scores/load";

export default function Page() {
  return <TrumpetAnalyzer scores={loadScores()} />;
}
