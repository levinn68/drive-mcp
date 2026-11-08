"use client";

import { useState } from "react";
import { Cable, Compass, Plus, ShieldCheck, Command } from "lucide-react";

const items = [
  { id: "connections", label: "Connections", icon: Cable },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "add", label: "Add MCP", icon: Plus },
  { id: "security", label: "Security", icon: ShieldCheck },
];

export default function WorkspaceTabs({ connections, discover, add, security }) {
  const [active, setActive] = useState("connections");
  const panels = { connections, discover, add, security };
  return <main className="drive-app">
    <header className="app-topbar">
      <a className="app-brand" href="/"><span className="brand-mark"><Command size={18}/></span><span>DRIVE</span></a>
      <div className="app-context"><span className="context-dot"/> PERSONAL MCP WORKSPACE</div>
      <div className="app-top-actions"><span className="app-status">PRIVATE</span></div>
    </header>
    <section className="app-content" aria-live="polite">
      {items.map((item) => <div key={item.id} className="app-panel" hidden={active !== item.id}>
        {panels[item.id]}
      </div>)}
    </section>
    <nav className="bottom-dock" aria-label="Main navigation">
      {items.map(({id,label,icon:Icon}) => <button key={id} type="button" className={`dock-item ${active===id?"active":""}`} aria-current={active===id?"page":undefined} onClick={()=>setActive(id)}>
        <span className="dock-icon"><Icon size={18}/></span><span>{label}</span>
      </button>)}
    </nav>
  </main>;
}
