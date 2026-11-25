(() => {
"use strict";
const $ = (s) => document.querySelector(s);
const COLORS = { skills:"#c06ad8", tools:"#4aa3ff", worlds:"#f0983c", notes:"#58d08a", files:"#8a97a0" };
const state = { mode:"ring", st:"idle", level:0, voice:true, reflex:true, history:[], speaking:false, name:"Jarvis" };

/* ---------------------------------------------------------- status */
function setState(s){ state.st = s; document.body.dataset.state = s; $("#statetxt").textContent = s.toUpperCase(); }
async function loadStatus(){
  try{
    const r = await (await fetch("/api/status")).json();
    state.name = r.name;
    $("#modelpill").textContent = r.ollama ? "◆ " + r.model.toUpperCase() : "◆ OLLAMA OFFLINE";
    if(!r.ollama) say("Ollama isn't running. Start it with 'ollama serve', then refresh.", "e");
    else if(!r.models.length) say("No models installed. Run: ollama pull qwen3.5:9b", "e");
  }catch(e){ $("#modelpill").textContent = "◆ SERVER OFFLINE"; }
}

/* ---------------------------------------------------------- chat log */
function say(text, cls){ const p = document.createElement("p"); p.className = cls || "a"; p.textContent = text;
  $("#log").appendChild(p); $("#log").scrollTop = 1e9; return p; }

/* ---------------------------------------------------------- speech out */
const synth = window.speechSynthesis;
let voiceObj = null;
function pickVoice(){
  const vs = synth ? synth.getVoices() : [];
  voiceObj = vs.find(v => /en-GB.*(Male|Daniel|Arthur)/i.test(v.name+v.lang)) ||
             vs.find(v => /Daniel|Google UK English Male|Microsoft (Ryan|George)/i.test(v.name)) ||
             vs.find(v => /^en/i.test(v.lang)) || null;
}
if(synth){ pickVoice(); synth.onvoiceschanged = pickVoice; }
let speakQ = 0;
function speak(text){
  if(!state.voice || !synth || !text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  if(voiceObj) u.voice = voiceObj; u.rate = 1.03; u.pitch = 0.92;
  u.onstart = () => { speakQ++; state.speaking = true; setState("speaking"); };
  u.onend = u.onerror = () => { speakQ--; if(speakQ <= 0){ speakQ = 0; state.speaking = false; if(state.st==="speaking") setState("idle"); } };
  synth.speak(u);
}
function stopSpeaking(){ if(synth){ synth.cancel(); speakQ = 0; state.speaking = false; } }

/* ---------------------------------------------------------- ask */
let busy = false;
async function ask(text){
  text = text.trim(); if(!text || busy) return;
  stopSpeaking(); busy = true; setState("thinking");
  say(text, "u"); state.history.push({role:"user", content:text});
  const bubble = say("…", "a"); let full = "", spoken = 0;
  try{
    const res = await fetch("/api/chat", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({messages: state.history, reflex: state.reflex})});
    const rd = res.body.getReader(), dec = new TextDecoder(); let buf = "";
    while(true){
      const {value, done} = await rd.read(); if(done) break;
      buf += dec.decode(value, {stream:true});
      let i; while((i = buf.indexOf("\n")) >= 0){
        const line = buf.slice(0, i).trim(); buf = buf.slice(i+1); if(!line) continue;
        const d = JSON.parse(line);
        if(d.error){ bubble.className = "e"; bubble.textContent = d.error; setState("error"); busy = false; return; }
        if(d.t){ full += d.t;
          const clean = full.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trimStart();
          bubble.textContent = clean;
          // speak sentence by sentence as they arrive
          const m = clean.slice(spoken).match(/^[\s\S]*?[.!?](\s|$)/);
          if(m){ speak(m[0]); spoken += m[0].length; }
          $("#log").scrollTop = 1e9; }
      }
    }
    const clean = full.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
    if(clean.length > spoken) speak(clean.slice(spoken));
    state.history.push({role:"assistant", content:clean});
    if(!state.speaking) setState("idle");
    if(/remember|note/i.test(text)) refreshGraph();
  }catch(e){ bubble.className = "e"; bubble.textContent = "Connection lost: " + e.message; setState("error"); }
  busy = false;
}
$("#send").onclick = () => { ask($("#in").value); $("#in").value = ""; };
$("#in").addEventListener("keydown", e => { if(e.key === "Enter"){ ask($("#in").value); $("#in").value = ""; } });

/* ---------------------------------------------------------- speech in */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
if(SR){
  rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
  rec.onresult = (e) => { let t = ""; for(const r of e.results) t += r[0].transcript; $("#in").value = t;
    if(e.results[e.results.length-1].isFinal){ ask(t); $("#in").value = ""; } };
  rec.onend = () => { listening = false; $("#mic").classList.remove("on"); if(state.st==="listening") setState("idle"); };
  rec.onerror = () => { listening = false; $("#mic").classList.remove("on"); };
}
$("#mic").onclick = () => {
  if(!rec){ say("Speech recognition isn't supported in this browser. Use Chrome or Edge.", "e"); return; }
  if(listening){ rec.stop(); return; }
  stopSpeaking(); listening = true; $("#mic").classList.add("on"); setState("listening"); rec.start();
};

/* ---------------------------------------------------------- toggles */
function toggle(id, cb){ const el = $(id); el.onclick = () => { const on = !el.classList.contains("on");
  el.classList.toggle("on", on); el.lastElementChild.textContent = on ? "on" : "off"; cb(on); }; }
toggle("#t-holo", on => document.body.classList.toggle("holo", on));
toggle("#t-voice", on => { state.voice = on; if(!on) stopSpeaking(); });
toggle("#t-reflex", on => state.reflex = on);
toggle("#t-eyes", async on => {
  document.body.classList.toggle("eyes", on);
  const v = $("#cam");
  if(on){ try{ v.srcObject = await navigator.mediaDevices.getUserMedia({video:true}); }
          catch(e){ say("Camera blocked or unavailable.", "e"); $("#t-eyes").click(); } }
  else if(v.srcObject){ v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; }
});
document.querySelectorAll(".pill.mode").forEach(p => p.onclick = () => {
  document.querySelectorAll(".pill.mode").forEach(x => x.classList.remove("on")); p.classList.add("on"); state.mode = p.dataset.mode; });

/* ---------------------------------------------------------- orb */
const orb = $("#orb"), oc = orb.getContext("2d");
function fit(c){ const r = c.getBoundingClientRect(), d = devicePixelRatio || 1; c.width = r.width*d; c.height = r.height*d; return d; }
let od = fit(orb); addEventListener("resize", () => od = fit(orb));
const stCol = () => ({idle:"#3df2d0", thinking:"#f2b63d", speaking:"#3df2d0", listening:"#5aa8ff", error:"#ff5a5a"})[state.st];
let t0 = 0;

function drawRing(c, w, col, t){
  c.lineCap = "round"; c.translate(w/2, w/2); const R = w*0.46;
  const spin = state.st === "thinking" ? 3 : 1;
  for(let i = 0; i < 3; i++){
    c.save(); c.rotate(t*0.0004*spin*(i%2 ? -1 : 1)*(i+1)); c.strokeStyle = col; c.globalAlpha = .75 - i*.18; c.lineWidth = 2.2;
    c.setLineDash([R*0.12, R*0.05 + i*4]); c.beginPath(); c.arc(0, 0, R - i*14, 0, Math.PI*2); c.stroke(); c.restore();
  }
  c.setLineDash([]); c.strokeStyle = "#f2b63d"; c.lineWidth = 4; c.globalAlpha = .95;
  c.beginPath(); c.arc(0, 0, R*0.68, Math.PI*0.15, Math.PI*(0.15 + 0.9*(0.5 + 0.5*Math.sin(t*.0012)))); c.stroke();
  // reactive core
  const lv = state.level; c.globalAlpha = .9; c.strokeStyle = col; c.lineWidth = 2;
  c.beginPath(); c.arc(0, 0, R*0.38 + lv*10, 0, Math.PI*2); c.stroke();
  const g = c.createRadialGradient(0,0,0,0,0,R*0.36); g.addColorStop(0, col+"cc"); g.addColorStop(1, col+"10");
  c.fillStyle = g; c.globalAlpha = .7; c.beginPath(); c.arc(0,0,R*0.36 + lv*8,0,Math.PI*2); c.fill();
  c.globalAlpha = 1; c.fillStyle = "#eafffb"; c.font = `600 ${w*0.045}px ui-monospace,monospace`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("J.A.R.V.I.S.", 0, 0);
}
const V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
function drawCube(c, w, col, t){
  c.translate(w/2, w/2); c.strokeStyle = col; c.lineWidth = 2; const s = w*(0.2 + state.level*0.03), a = t*0.0006*(state.st==="thinking"?3:1), b = a*0.7;
  const P = V.map(([x,y,z]) => { let X = x*Math.cos(a) - z*Math.sin(a), Z = x*Math.sin(a) + z*Math.cos(a);
    let Y = y*Math.cos(b) - Z*Math.sin(b); Z = y*Math.sin(b) + Z*Math.cos(b); const f = 3/(3 + Z*0.5); return [X*s*f, Y*s*f]; });
  for(const k of [1, .55]){ c.globalAlpha = k; c.save(); c.scale(k===1?1:.55, k===1?1:.55);
    c.beginPath(); E.forEach(([i,j]) => { c.moveTo(...P[i]); c.lineTo(...P[j]); }); c.stroke(); c.restore(); }
  c.globalAlpha = 1; P.forEach(p => { c.beginPath(); c.arc(p[0], p[1], 3, 0, 7); c.fillStyle = col; c.fill(); });
}
function drawFace(c, w, col, t){
  c.translate(w/2, w/2); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, w*0.44, 0, 7); c.globalAlpha = .4; c.stroke(); c.globalAlpha = 1;
  const blink = (t % 4200) < 140 ? 0.12 : 1, ey = w*0.04*blink + 1;
  [-1, 1].forEach(sx => { c.beginPath(); c.ellipse(sx*w*0.15, -w*0.08, w*0.045, ey*(state.st==="thinking"?0.6:1.2), 0, 0, 7); c.fill(); });
  const open = state.speaking ? 4 + state.level*w*0.07 : (state.st==="thinking" ? 2 : 3);
  c.beginPath(); c.moveTo(-w*0.14, w*0.15); c.quadraticCurveTo(0, w*0.15 + open*2 + (state.speaking?0:6), w*0.14, w*0.15);
  if(state.speaking){ c.quadraticCurveTo(0, w*0.15 - open*1.2, -w*0.14, w*0.15); c.globalAlpha = .35; c.fill(); c.globalAlpha = 1; }
  c.stroke();
}
function orbLoop(t){
  state.level += (((state.speaking ? 0.5 + 0.5*Math.abs(Math.sin(t*0.017)*Math.sin(t*0.005)) : state.st==="thinking" ? 0.25 : 0.08)) - state.level)*0.2;
  const w = orb.width; oc.setTransform(1,0,0,1,0,0); oc.clearRect(0,0,w,w); oc.save();
  const col = stCol(); ({ring:drawRing, cube:drawCube, face:drawFace})[state.mode](oc, w, col, t); oc.restore();
  requestAnimationFrame(orbLoop);
}
requestAnimationFrame(orbLoop);

/* ---------------------------------------------------------- knowledge graph */
const gc = $("#graph"), g = gc.getContext("2d"); let gd = fit(gc), nodes = [], links = [], hover = null;
addEventListener("resize", () => gd = fit(gc));
async function refreshGraph(){
  try{
    const d = await (await fetch("/api/graph")).json();
    const old = new Map(nodes.map(n => [n.id, n]));
    nodes = d.nodes.map(n => { const o = old.get(n.id); const W = innerWidth, H = innerHeight;
      return Object.assign(n, o ? {x:o.x, y:o.y, vx:0, vy:0} : {x: W*0.25 + (Math.random()-.5)*300, y: H*0.4 + (Math.random()-.5)*300, vx:0, vy:0}); });
    links = d.links;
    $("#counts").innerHTML = ["skills","tools","worlds","notes","files"].map(k =>
      `<div><i style="background:${COLORS[k]}"></i>${k[0].toUpperCase()+k.slice(1)}<b>${d.counts[k]}</b></div>`).join("");
  }catch(e){}
}
function physics(){
  const W = innerWidth, H = innerHeight, cx = W*0.3, cy = H*0.42;
  for(let i = 0; i < nodes.length; i++){ const a = nodes[i];
    for(let j = i+1; j < nodes.length; j++){ const b = nodes[j]; let dx = a.x-b.x, dy = a.y-b.y, d2 = dx*dx+dy*dy+30;
      if(d2 > 40000) continue; const f = 900/d2, d = Math.sqrt(d2); dx = dx/d*f; dy = dy/d*f; a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy; }
    a.vx += (cx-a.x)*0.0008; a.vy += (cy-a.y)*0.0008; }
  for(const [i,j] of links){ const a = nodes[i], b = nodes[j]; if(!a||!b) continue;
    const dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx,dy)+.01, f = (d-(a.hub||b.hub?70:45))*0.012;
    a.vx += dx/d*f; a.vy += dy/d*f; b.vx -= dx/d*f; b.vy -= dy/d*f; }
  for(const n of nodes){ n.vx *= .82; n.vy *= .82; n.x += n.vx; n.y += n.vy; }
}
function graphLoop(){
  physics(); const d = gd; g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,innerWidth,innerHeight);
  g.lineWidth = 0.6; g.strokeStyle = "rgba(61,242,208,.18)"; g.beginPath();
  for(const [i,j] of links){ const a = nodes[i], b = nodes[j]; if(a&&b){ g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); } } g.stroke();
  for(const n of nodes){ const r = n.hub ? 7 : 4; g.fillStyle = COLORS[n.type] || "#fff"; g.globalAlpha = n===hover ? 1 : .85;
    g.beginPath(); g.arc(n.x, n.y, r, 0, 7); g.fill(); }
  g.globalAlpha = .8; g.font = "10px ui-monospace,monospace"; g.fillStyle = "#cffff5";
  for(const n of nodes){ if(n.hub || n===hover) g.fillText(n.label.slice(0,28), n.x+9, n.y+3); }
  requestAnimationFrame(graphLoop);
}
addEventListener("mousemove", e => { hover = null; for(const n of nodes){ if(Math.hypot(n.x-e.clientX, n.y-e.clientY) < 9){ hover = n; break; } } });
addEventListener("keydown", e => { if(e.key === "Escape") stopSpeaking(); });

loadStatus(); refreshGraph(); graphLoop(); setInterval(refreshGraph, 20000);
say("Systems online. Ask me anything, or say “remember …” to teach me something.");
})();
