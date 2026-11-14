import { GAMES } from "../games/registry";
import { loadName } from "./hooks";
import { Menu } from "./Menu";
import { Screen } from "./Menu";
import { records } from "./results";
import { navigate } from "./router";

export function PracticeList() {
  const bests = records.bests(loadName());
  return (
    <Screen title="Practice">
      <Menu
        label="Pick a game"
        items={GAMES.map((g) => ({
          label: g.name,
          hint: bests[g.id] ? `Your best: ${g.formatScore(bests[g.id]!.score)}` : "No best yet",
          testId: `practice-${g.id}`,
          onSelect: () => navigate(`/practice/${g.id}`),
        }))}
      />
    </Screen>
  );
}
