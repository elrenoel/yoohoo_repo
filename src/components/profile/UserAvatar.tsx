"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  src?: string | null;
  name: string;
  size: number;
  className?: string;
  textClassName?: string;
};

export default function UserAvatar({ src, name, size, className = "", textClassName = "" }: Props) {
  const [failedSources, setFailedSources] = useState<Set<string>>(
    () => new Set(),
  );
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const fallbackSrc = `https://api.dicebear.com/10.x/lorelei/svg?seed=${encodeURIComponent(name)}`;
  const activeSrc = src && !failedSources.has(src)
    ? src
    : !failedSources.has(fallbackSrc)
      ? fallbackSrc
      : null;
  const optimized = Boolean(activeSrc?.startsWith("https://lh3.googleusercontent.com/"));

  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-accent font-bold text-on-accent ${className}`} style={{ width: size, height: size }}>
    {activeSrc
      ? <Image src={activeSrc} alt="" width={size} height={size} unoptimized={!optimized} onError={() => setFailedSources(current => new Set(current).add(activeSrc))} className="h-full w-full object-cover" />
      : <span aria-label={name} className={textClassName}>{initials || "?"}</span>}
  </span>;
}
