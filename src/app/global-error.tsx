"use client";

import { RefreshCw } from "lucide-react";
import Image from "next/image";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F5F6F3",padding:"24px",textAlign:"center",fontFamily:"Plus Jakarta Sans,system-ui,sans-serif",color:"#16241D"}}>
    <div style={{width:"100%",maxWidth:448}}>
      <Image src="/error-mascot.svg" alt="A surprised Yoohoo mascot" width={300} height={216} priority style={{display:"block",width:"100%",maxWidth:300,height:"auto",margin:"0 auto"}} />
      <h1 style={{margin:"12px 0 0",fontSize:24}}>Something went wrong</h1>
      <p style={{margin:"8px 0 0",fontSize:14,color:"#6B7971"}}>We couldn&apos;t load this page. Please try again.</p>
      <button type="button" onClick={reset} style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:28,border:0,borderRadius:999,background:"#164C3D",padding:"12px 24px",fontWeight:700,color:"white",cursor:"pointer"}}><RefreshCw size={16} />Retry</button>
    </div>
  </main></body></html>;
}
