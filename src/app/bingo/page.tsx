import { redirect } from "next/navigation";

// Keep old bookmarks and printed QR codes working while the public entry point
// moves from a feature name to the town-exploration hierarchy.
export default function TownBingoIndex() {
  redirect("/explore");
}
