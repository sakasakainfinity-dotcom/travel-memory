import { redirect } from "next/navigation";

export default function AITripPage() {
  redirect("/plans/new?mode=ai");
}
