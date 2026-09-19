"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { protectCardImageUrl } from "@/lib/card-image-url";

export function ImageUpload({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid || typeof uid !== "string") {
      setUploading(false);
      toast.error("请先登录");
      return;
    }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("card-images").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    onChange(`/api/card-images?path=${encodeURIComponent(path)}`);
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">配图</p>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={protectCardImageUrl(value)} alt="" className="h-32 w-full rounded-2xl object-cover" />
      ) : null}
      <div className="flex gap-2">
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "relative cursor-pointer",
            uploading && "pointer-events-none opacity-50",
          )}
        >
          {uploading ? "上传中..." : "上传图片"}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            className="sr-only"
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            移除
          </Button>
        ) : null}
      </div>
    </div>
  );
}
