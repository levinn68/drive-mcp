"use client";

import { useMemo } from "react";
import { ArrowUpRight, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";

export default function OAuthCompletePage() {
  const callback = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get("callback") || "";
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" && url.hostname !== "localhost") return "";
      return url.toString();
    } catch {
      return "";
    }
  }, []);

  return (
    <main style={{minHeight:"100svh",display:"grid",placeItems:"center",padding:"24px",background:"radial-gradient(ellipse at 50% -10%,rgba(111,87,255,.28),transparent 48%),#080a12",color:"#f5f6ff"}}>
      <section style={{width:"min(100%,520px)",padding:"32px",borderRadius:"28px",border:"1px solid rgba(255,255,255,.13)",background:"linear-gradient(145deg,rgba(24,27,44,.97),rgba(13,16,28,.98))",boxShadow:"0 30px 100px rgba(0,0,0,.5)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"28px"}}>
          <div style={{width:48,height:48,borderRadius:16,display:"grid",placeItems:"center",background:"rgba(150,132,255,.18)",color:"#b9adff"}}><ShieldCheck size={25}/></div>
          <div><strong style={{letterSpacing:".18em"}}>DRIVE</strong><div style={{fontSize:12,color:"#9295a8"}}>One hub. Every connection.</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:9,color:"#86efc3",fontSize:13,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase"}}><CheckCircle2 size={17}/> Access approved</div>
        <h1 style={{fontSize:30,lineHeight:1.15,letterSpacing:"-.04em",margin:"14px 0 10px"}}>Your connection is approved.</h1>
        <p style={{color:"#a5a7b7",lineHeight:1.65,marginBottom:26}}>Open your DRIVE workspace in a separate tab first. Then return here and finish the secure handoff to your MCP provider. This two-step flow avoids popup blocking in Android browsers.</p>
        <div style={{display:"grid",gap:12}}>
          <a href="/" target="_blank" rel="noopener noreferrer" style={{minHeight:54,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:"linear-gradient(100deg,#b5a8ff,#8c7af0)",color:"#11111c",fontWeight:750,textDecoration:"none"}}><ExternalLink size={17}/> Open DRIVE Dashboard</a>
          {callback ? <a href={callback} style={{minHeight:54,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",gap:10,border:"1px solid rgba(255,255,255,.17)",background:"rgba(255,255,255,.05)",color:"#e7e5ff",fontWeight:650,textDecoration:"none"}}>Finish connection <ArrowUpRight size={17}/></a> : <div role="alert" style={{padding:14,borderRadius:14,background:"rgba(248,113,113,.1)",color:"#fca5a5",fontSize:13}}>The provider callback URL is missing or invalid. Return to your MCP provider and restart the connection.</div>}
        </div>
        <p style={{fontSize:12,color:"#777b8d",textAlign:"center",marginTop:24}}>DRIVE · Secure connection authorization</p>
      </section>
    </main>
  );
}
