"use client";

import { useState } from "react";
import Image from "next/image";

export function ProfileAvatar({ src, nickname, className = "", loading = "eager" }: {
  src?: string | null;
  nickname?: string | null;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span aria-hidden="true" className={`flex size-full shrink-0 items-center justify-center overflow-hidden bg-primary/10 font-semibold text-primary ${className}`}>
      {src && src !== failedSrc ? (
        <Image
          src={src}
          alt=""
          width={256}
          height={256}
          // Presets are precompressed WebP; reuse one cached file at every size.
          unoptimized
          loading={loading}
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : Array.from(nickname?.trim() || "学")[0]}
    </span>
  );
}
