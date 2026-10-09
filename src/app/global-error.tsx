"use client";

import { RefreshCw } from "lucide-react";
import Image from "next/image";
import { DARK_THEME } from "@/lib/theme-tokens";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en" style={{background:DARK_THEME.bg,colorScheme:"dark"}}><body style={{margin:0,background:DARK_THEME.bg,color:DARK_THEME.text}}><main style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:DARK_THEME.bg,padding:"24px",textAlign:"center",fontFamily:"Plus Jakarta Sans,system-ui,sans-serif",color:DARK_THEME.text}}>
    <div style={{width:"100%",maxWidth:448}}>
      <Image src="/error-mascot.svg" alt="A surprised Yoohoo mascot" width={300} height={216} priority style={{display:"block",width:"100%",maxWidth:300,height:"auto",margin:"0 auto"}} />
      <h1 style={{margin:"12px 0 0",fontSize:24}}>Something went wrong</h1>
      <p style={{margin:"8px 0 0",fontSize:14,color:DARK_THEME.textSecondary}}>We couldn&apos;t load this page. Please try again.</p>
      <button type="button" onClick={reset} style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:28,border:0,borderRadius:999,background:DARK_THEME.accent,padding:"12px 24px",fontWeight:700,color:DARK_THEME.onAccent,cursor:"pointer"}}><RefreshCw size={16} />Retry</button>
    </div>
  </main></body></html>;
}
