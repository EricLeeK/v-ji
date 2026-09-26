import { PhoneShell } from "@/components/phone-shell";
import { Suspense } from "react";
import { getProfile } from "@/lib/data";
import { parseSettings } from "@/lib/settings";
import { StudyReminder } from "@/components/settings/study-reminder";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <PhoneShell>{children}<Suspense fallback={null}><ReminderLoader /></Suspense></PhoneShell>;
}

async function ReminderLoader() {
  const profile = await getProfile();
  return profile ? <StudyReminder ownerId={profile.id} reminder={parseSettings(profile.settings).reminder} /> : null;
}
