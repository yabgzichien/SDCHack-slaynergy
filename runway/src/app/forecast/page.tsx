import { redirect } from "next/navigation";

// The forecast now lives on Skills (the speed switch) and the market page (how the chances are made).
export default function ForecastRedirect() {
  redirect("/market#how");
}
