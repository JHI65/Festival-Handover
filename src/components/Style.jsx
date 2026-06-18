import { useEffect } from "react";
import { LT, DK } from "../lib/theme";

function Style({ dark }) {
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  }, []);
  useEffect(() => {
    document.body.style.background = dark ? DK.bg : LT.bg;
  }, [dark]);
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
    ::-webkit-scrollbar { width:4px; height:4px; }
    ::-webkit-scrollbar-thumb { background:#C94A2A; border-radius:2px; }
    input::placeholder, textarea::placeholder { color:#B0A090; }
    input, textarea, select { font-size:16px !important; }
    button { font-family:'DM Mono',monospace; }

    /* ---------- login screen ---------- */
    @keyframes lg-fade { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes lg-glow { 0%,100% { opacity:0.45; } 50% { opacity:0.75; } }
    @keyframes lg-eq { 0%,100% { transform:scaleY(0.35); } 50% { transform:scaleY(1); } }
    .lg-card { animation:lg-fade .6s cubic-bezier(.2,.7,.3,1) both; }
    .lg-glow { animation:lg-glow 6s ease-in-out infinite; }
    .lg-mark span { display:block; width:4px; border-radius:2px; transform-origin:center; animation:lg-eq 1.2s ease-in-out infinite; }
    .lg-mark span:nth-child(1){ height:14px; background:#C94A2A; animation-delay:0s; }
    .lg-mark span:nth-child(2){ height:22px; background:#D4A843; animation-delay:.15s; }
    .lg-mark span:nth-child(3){ height:30px; background:#F5EFE0; animation-delay:.3s; }
    .lg-mark span:nth-child(4){ height:22px; background:#D4A843; animation-delay:.45s; }
    .lg-mark span:nth-child(5){ height:14px; background:#C94A2A; animation-delay:.6s; }
    .lg-btn { transition:transform .15s ease, box-shadow .15s ease, background .15s ease; }
    .lg-btn:not(:disabled):hover { transform:translateY(-2px); box-shadow:0 10px 28px rgba(0,0,0,.5); }
    .lg-btn:not(:disabled):active { transform:translateY(0); box-shadow:0 4px 14px rgba(0,0,0,.4); }
  `}</style>;
}

export default Style;
