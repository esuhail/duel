import { normalizeCode } from "../net/transport";
import { Home } from "./Home";
import { LocalMatch } from "./LocalMatch";
import { HostPage, JoinPage } from "./MatchPages";
import { Practice } from "./Practice";
import { Field } from "./arena";
import { useHashRoute } from "./router";
import { useSeamShift } from "./seam";
import "./theme";
import { ThemePicker } from "./ThemePicker";
import "./styles.css";

export function App() {
  return (
    <>
      <Field shift={useSeamShift()} />
      <Screen />
      <ThemePicker />
    </>
  );
}

function Screen() {
  const [page, arg] = useHashRoute();
  if (page === "practice" && arg) return <Practice key={arg} gameId={arg} />;
  if (page === "host" && arg) return <HostPage roomId={normalizeCode(arg)} />;
  if (page === "join" && arg) return <JoinPage roomId={normalizeCode(arg)} />;
  if (page === "local") return <LocalMatch />;
  return <Home />;
}
