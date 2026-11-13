import { Home } from "./Home";
import { HostPage, JoinPage } from "./MatchPages";
import { Practice } from "./Practice";
import { useHashRoute } from "./router";
import "./styles.css";

export function App() {
  const [page, arg] = useHashRoute();
  if (page === "practice" && arg) return <Practice key={arg} gameId={arg} />;
  if (page === "host" && arg) return <HostPage roomId={arg} />;
  if (page === "join" && arg) return <JoinPage roomId={arg} />;
  return <Home />;
}
