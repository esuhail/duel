import { normalizeCode } from "../net/transport";
import { CodeEntry } from "./CodeEntry";
import { Home } from "./Home";
import { PracticeList } from "./PracticeList";
import { Records } from "./Records";
import { SettingsScreen } from "./SettingsScreen";
import { LocalMatch } from "./LocalMatch";
import { HostPage, JoinPage } from "./MatchPages";
import { Practice } from "./Practice";
import { Field } from "./arena";
import { useHashRoute } from "./router";
import { useSeamShift } from "./seam";
import "./themes/arcade.css";
import "./styles.css";

export function App() {
  return (
    <>
      <Field shift={useSeamShift()} />
      <Screen />
    </>
  );
}

function Screen() {
  const [page, arg] = useHashRoute();
  if (page === "practice" && arg) return <Practice key={arg} gameId={arg} />;
  if (page === "practice") return <PracticeList />;
  if (page === "records") return <Records />;
  if (page === "settings") return <SettingsScreen />;
  if (page === "join" && !arg) return <CodeEntry />;
  if (page === "host" && arg) return <HostPage roomId={normalizeCode(arg)} />;
  if (page === "join" && arg) return <JoinPage roomId={normalizeCode(arg)} />;
  if (page === "local") return <LocalMatch />;
  return <Home />;
}
