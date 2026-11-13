import { Home } from "./Home";
import { Practice } from "./Practice";
import { useHashRoute } from "./router";
import "./styles.css";

export function App() {
  const [page, arg] = useHashRoute();
  if (page === "practice" && arg) return <Practice gameId={arg} />;
  return <Home />;
}
