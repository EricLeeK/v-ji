import { NextResponse } from "next/server";
import { getUserId, createClient } from "@/lib/supabase/server";
import { isOwnStoragePath } from "@/lib/ai/input";

export async function GET(request: Request) {
  const uid = await getUserId();
  if (!uid) return new NextResponse("Unauthorized", { status: 401 });

  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isOwnStoragePath(path, uid)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("card-images").download(path);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
