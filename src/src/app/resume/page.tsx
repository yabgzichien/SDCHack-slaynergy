import { redirect } from "next/navigation";

// The resume is scanned in the onboarding now; the report comes straight after the scan there.
export default function ResumePage() {
  redirect("/start");
}
