import AppMenu from "@/components/AppMenu";
import DaigoExplore from "./daigo-explore";

export default function DaigoExplorePage() {
  return (
    <main className="bingo-shell daigo-shell">
      <AppMenu current="town-bingo" />
      <DaigoExplore />
    </main>
  );
}
