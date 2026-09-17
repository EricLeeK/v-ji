import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";

export default async function Home() {
  const uid = await getUserId();
  redirect(uid ? "/today" : "/login");
}
