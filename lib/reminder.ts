import { localDateKey } from "@/lib/dates";
import { validTime, type UserSettings } from "@/lib/settings";

export const reminderStorageKey = (ownerId: string) => `vji:reminder-day:${ownerId}`;

export function reminderDue(settings: UserSettings["reminder"], now: Date, lastDay: string | null) {
  if (!settings.enabled || !validTime(settings.time) || lastDay === localDateKey(now)) return false;
  const [hours, minutes] = settings.time.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}
