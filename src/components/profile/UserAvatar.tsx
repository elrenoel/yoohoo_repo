"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  src?: string | null;
  name: string;
  size: number;
  className?: string;
  textClassName?: string;
};

export default function UserAvatar({ src, name, size, className = "", textClassName = "" }: Props) {
  const [failedPrimary, setFailedPrimary] = useState(false);
  const [failedFallback, setFailedFallback] = useState(false);
  useEffect(() => { setFailedPrimary(false); setFailedFallback(false); }, [src, name]);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const fallbackSrc = `https://api.dicebear.com/10.x/lorelei/svg?seed=${encodeURIComponent(name)}`;
  const activeSrc = src && !failedPrimary ? src : !failedFallback ? fallbackSrc : null;
  const optimized = Boolean(activeSrc?.startsWith("https://lh3.googleusercontent.com/"));

  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D8DCD3] bg-[#DDF259] font-bold text-[#164C3D] ${className}`} style={{ width: size, height: size }}>
    {activeSrc
      ? <Image src={activeSrc} alt="" width={size} height={size} unoptimized={!optimized} onError={() => src && !failedPrimary ? setFailedPrimary(true) : setFailedFallback(true)} className="h-full w-full object-cover" />
      : <span aria-label={name} className={textClassName}>{initials || "?"}</span>}
  </span>;
}
