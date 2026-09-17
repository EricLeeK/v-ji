"use client";

import { Camera, FileUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PendingSource = {
  id: string;
  kind: "text" | "image" | "pdf";
  name: string;
  mime?: string;
  sizeBytes?: number;
  storagePath?: string;
  text?: string;
  pageRange?: { start: number; end: number };
  file?: File;
};

export function SourceInput({ onAdd }: { onAdd: (sources: PendingSource[]) => void }) {
  function fromFiles(list: FileList | File[]) {
    return Array.from(list).flatMap((file) => {
      const kind = kindOf(file);
      if (!kind) return [];
      return [
        {
          id: crypto.randomUUID(),
          kind,
          name: file.name,
          mime: file.type,
          sizeBytes: file.size,
          file,
          ...(kind === "pdf" ? { pageRange: { start: 1, end: 60 } } : {}),
        } satisfies PendingSource,
      ];
    });
  }

  return (
    <div className="space-y-3">
      <label
        className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-primary/30 bg-primary/5 px-4 py-6 text-center"
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files);
          if (files.length) {
            event.preventDefault();
            onAdd(fromFiles(files));
            return;
          }
          const text = event.clipboardData.getData("text").trim();
          if (text) {
            event.preventDefault();
            onAdd([{ id: crypto.randomUUID(), kind: "text", name: "粘贴文字", text }]);
          }
        }}
      >
        <FileUp className="mb-2 size-6 text-primary" />
        <p className="text-sm font-medium">放入资料</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          拍照、相册、PDF、TXT，或在此粘贴文字和截图
        </p>
        <input
          type="file"
          accept="application/pdf,text/plain,text/markdown,image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) onAdd(fromFiles(event.target.files));
            event.target.value = "";
          }}
        />
      </label>
      <div className="flex gap-2">
        <label
          className={cn(
            buttonVariants({ variant: "outline" }),
            "relative flex-1 cursor-pointer overflow-hidden rounded-full",
          )}
        >
          <Camera className="mr-1 size-4" />
          拍照
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.length) onAdd(fromFiles(event.target.files));
              event.target.value = "";
            }}
          />
        </label>
        <label
          className={cn(
            buttonVariants({ variant: "outline" }),
            "relative flex-1 cursor-pointer overflow-hidden rounded-full",
          )}
        >
          相册
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.length) onAdd(fromFiles(event.target.files));
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <Textarea
        data-testid="ai-source-text"
        placeholder="也可以直接粘贴或输入资料正文"
        rows={4}
        onBlur={(event) => {
          const text = event.target.value.trim();
          if (!text) return;
          onAdd([{ id: crypto.randomUUID(), kind: "text", name: "输入文字", text }]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function kindOf(file: File): PendingSource["kind"] | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name)) return "text";
  return null;
}
