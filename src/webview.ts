import * as vscode from 'vscode';

export function getWebviewHtml(extensionUri: vscode.Uri, webview: vscode.Webview): string {
  const mediaUri = (f: string) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', f));
  const symbolImages: Record<string, string> = {
    claude: mediaUri('claude.png'), codex: mediaUri('codex.png'), gemini: mediaUri('gemini.png'),
    xai: mediaUri('xai.png'), deepseek: mediaUri('deepseek.png'), qwen: mediaUri('qwen.png'),
    zai: mediaUri('zai.png'), minimax: mediaUri('minimax.png'), nvidia: mediaUri('nvidia.png'),
    mistral: mediaUri('mistral.png'),
  };
  const imgMapJson = JSON.stringify(symbolImages);
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${webview.cspSource}; script-src 'unsafe-inline';">
<style>${CSS}</style></head><body>
<div class="maquina" id="maquina">
<div class="marquesina"><div class="luces" id="luces"></div><h1>QUEMATOKENS</h1><div class="luces" id="luces2"></div></div>
<div class="jackpot-display" id="jackpot-display"><span class="jackpot-label">JACKPOT</span><span class="jackpot-amount" id="jackpot-amount">500</span></div>
<div class="cuerpo"><div class="panel-carretes"><div class="ventana">
<div class="carrete" id="carrete-0"><div class="tira"></div></div>
<div class="carrete" id="carrete-1"><div class="tira"></div></div>
<div class="carrete" id="carrete-2"><div class="tira"></div></div>
<div class="linea-premio"></div></div></div>
<div class="palanca-zona"><div class="palanca" id="palanca"><div class="brazo" id="brazo"><div class="vara"></div><div class="bola"></div></div><div class="base-palanca"></div></div></div></div>
<div class="panel-inferior">
<div class="display"><span class="etiqueta">CREDITOS</span><span class="valor" id="creditos">--</span></div>
<div class="mensaje" id="mensaje">Tira de la palanca</div>
<div class="display premio"><span class="etiqueta">RECORD</span><span class="valor" id="record">0</span></div></div>
<div class="controles">
<div class="control-apuesta">
<button class="boton-control" id="apuesta-menos">&minus;</button>
<div class="display compacto"><span class="etiqueta">APUESTA</span><span class="valor" id="apuesta">5</span></div>
<button class="boton-control" id="apuesta-mas">+</button></div>
<button class="boton-control spin-btn" id="btn-spin">&#9654;</button>
<button class="boton-control ancho" id="recargar">+100</button>
<button class="boton-control" id="info">i</button>
<button class="boton-control" id="silencio"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 9 h4 l5 -5 v16 l-5 -5 H4 z" fill="currentColor"/><path class="ondas" d="M16 8 q3 4 0 8 M18.5 6 q4.5 6 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="tachado oculto" d="M16 9 l6 6 M22 9 l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
<div class="stats-bar"><span id="stat-spins">Tiradas: 0</span><span id="stat-wins">Vic: 0</span><span id="stat-rtp">RTP: 0%</span><span id="stat-streak">Racha: 0</span></div>
<div class="tabla-pagos oculto" id="tabla-pagos"><div class="tabla-cabecera"><span id="tabla-titulo">Premios</span><button class="boton-control" id="cerrar-tabla">&times;</button></div><div class="tabla-filas" id="tabla-filas"></div><p class="tabla-nota">10% de cada apuesta alimenta el bote. Los tokens de tu IA tambien.</p></div>
<div class="particles" id="particles"></div>
<div class="providers-panel"><div class="providers-header" id="providers-toggle"><span>Tokens IA &rarr; Bote</span><span class="providers-arrow" id="providers-arrow">&#9660;</span></div><div class="providers-body collapsed" id="providers-body"><div class="providers-summary"><div class="providers-stat"><span class="providers-stat-label">Hoy</span><span class="providers-stat-value" id="stat-today-total">0</span></div><div class="providers-stat"><span class="providers-stat-label">Total</span><span class="providers-stat-value" id="stat-alltime-total">0</span></div><div class="providers-stat"><span class="providers-stat-label">In/Out</span><span class="providers-stat-value" id="stat-today-inout">0/0</span></div></div><div class="providers-list" id="providers-list"></div></div></div>
</div>
<script>${getScript(imgMapJson)}</script>
</body></html>`;
}

const CSS = `
:root{--rojo:#b3202c;--rojo-o:#7e1019;--dorado:#e8b94a;--dorado-c:#f6dd9a;--crema:#f7efe0;--sombra:rgba(0,0,0,.45);--alto:78px;--purple:#7c3aed}
*{margin:0;padding:0;box-sizing:border-box}
body{width:100%;max-width:500px;margin:0 auto;background:#1a1423;font-family:Georgia,"Times New Roman",serif;user-select:none;padding:8px}
.maquina{position:relative;background:linear-gradient(180deg,var(--rojo),var(--rojo-o));border:6px solid var(--dorado);border-radius:18px;padding:10px 12px 14px;box-shadow:inset 0 2px 8px rgba(255,255,255,.25),0 8px 22px var(--sombra);overflow:hidden}
.marquesina{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--rojo-o);border:3px solid var(--dorado);border-radius:12px;padding:6px 10px;margin-bottom:8px;overflow:hidden}
.marquesina h1{flex:1;text-align:center;color:var(--dorado-c);font-size:17px;letter-spacing:3px;text-shadow:0 2px 3px var(--sombra);white-space:nowrap}
.luces{display:flex;gap:5px;flex-shrink:0}
.luz{width:9px;height:9px;border-radius:50%;background:#5a4a20}
.luz.on{background:var(--dorado-c);box-shadow:0 0 7px var(--dorado-c)}
.jackpot-display{display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(180deg,#1a0a00,#2a1500);border:3px solid var(--dorado);border-radius:12px;padding:8px 16px;margin-bottom:10px;position:relative;overflow:hidden}
.jackpot-label{color:var(--dorado);font-size:12px;letter-spacing:4px;font-weight:bold}
.jackpot-amount{color:#fff;font-family:"Courier New",monospace;font-size:32px;font-weight:bold;text-shadow:0 0 10px var(--dorado),0 0 20px rgba(232,185,74,.5);letter-spacing:2px}
.jackpot-display.hot .jackpot-amount{animation:jpPulse 1s ease-in-out infinite}
@keyframes jpPulse{0%,100%{text-shadow:0 0 10px var(--dorado),0 0 20px rgba(232,185,74,.5)}50%{text-shadow:0 0 20px var(--dorado),0 0 40px rgba(232,185,74,.8),0 0 60px rgba(232,185,74,.3)}}
.jackpot-display.feeding .jackpot-amount{animation:jpFeed .3s ease}
@keyframes jpFeed{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
.cuerpo{display:flex;align-items:center;gap:8px}
.panel-carretes{flex:1;background:var(--dorado);border-radius:12px;padding:8px;box-shadow:inset 0 -3px 6px rgba(0,0,0,.3)}
.ventana{position:relative;display:flex;gap:6px;background:#111;border-radius:8px;padding:6px;height:calc(var(--alto) + 12px);overflow:hidden}
.carrete{flex:1;position:relative;overflow:hidden;background:linear-gradient(180deg,#cfc8b8,var(--crema) 25%,#fff 50%,var(--crema) 75%,#cfc8b8);border-radius:5px;height:var(--alto)}
.tira{position:absolute;left:0;width:100%;will-change:transform}
.celda{height:var(--alto);display:flex;align-items:center;justify-content:center}
.celda img{width:52px;height:52px;object-fit:contain}
.linea-premio{position:absolute;left:4px;right:4px;top:50%;height:2px;background:rgba(179,32,44,.55);pointer-events:none}
.palanca-zona{width:58px;display:flex;justify-content:center}
.palanca{position:relative;height:130px;width:44px;cursor:grab}
.palanca.bloqueada{cursor:not-allowed;opacity:.75}
.brazo{position:absolute;bottom:26px;left:50%;width:12px;height:88px;margin-left:-6px;transform-origin:bottom center;transition:transform .12s ease-out}
.brazo.soltada{transition:transform .45s cubic-bezier(.2,1.6,.4,1)}
.vara{position:absolute;bottom:0;left:3px;width:6px;height:100%;background:linear-gradient(90deg,#888,#ddd,#888);border-radius:3px}
.bola{position:absolute;top:-18px;left:-8px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#e96a6a,var(--rojo) 60%,var(--rojo-o));box-shadow:0 3px 6px var(--sombra)}
.base-palanca{position:absolute;bottom:0;left:50%;width:34px;height:30px;margin-left:-17px;background:linear-gradient(180deg,#c9a23a,#8a6c20);border-radius:8px 8px 4px 4px;box-shadow:0 3px 5px var(--sombra)}
.panel-inferior{display:flex;align-items:stretch;gap:8px;margin-top:10px}
.display{background:#111;border:2px solid var(--dorado);border-radius:8px;padding:5px 10px;text-align:center;min-width:86px}
.display .etiqueta{display:block;color:var(--dorado);font-size:9px;letter-spacing:2px}
.display .valor{display:block;color:#ffd9d9;font-family:"Courier New",monospace;font-size:22px;font-weight:bold}
.display.premio .valor{color:#7CFC8a}
.mensaje{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dorado-c);font-size:14px;font-style:italic;text-align:center}
.mensaje.gano{color:#ffe98a;font-style:normal;font-weight:bold;animation:parpadeo .4s steps(2) 6}
.mensaje.jackpot-msg{color:#ffd700;font-size:16px;animation:parpadeo .3s steps(2) 10}
@keyframes parpadeo{from{opacity:1}to{opacity:.25}}
.controles{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}
.control-apuesta{display:flex;align-items:center;gap:6px}
.display.compacto{min-width:70px;padding:3px 8px}
.display.compacto .valor{font-size:18px}
.boton-control{background:var(--dorado);border:none;border-radius:8px;min-width:34px;height:34px;font-family:inherit;font-size:17px;font-weight:bold;color:var(--rojo-o);cursor:pointer;display:flex;align-items:center;justify-content:center}
.boton-control:hover{background:var(--dorado-c)}
.boton-control:disabled{opacity:.45;cursor:not-allowed}
.boton-control.ancho{padding:0 16px}
.spin-btn{background:linear-gradient(180deg,#e04040,#b3202c);color:#fff;font-size:20px;min-width:44px}
.spin-btn:hover{background:linear-gradient(180deg,#f05050,#c03030)}
.stats-bar{display:flex;justify-content:space-around;background:#111;border:2px solid var(--dorado);border-radius:8px;padding:4px 8px;margin-top:8px;font-family:"Courier New",monospace;font-size:10px;color:#999;letter-spacing:.5px}
.stats-bar span{white-space:nowrap}
.tabla-pagos{position:absolute;inset:8px;background:rgba(17,10,12,.96);border:3px solid var(--dorado);border-radius:12px;padding:10px 14px;display:flex;flex-direction:column;z-index:10}
.tabla-pagos.oculto{display:none}
.tabla-cabecera{display:flex;align-items:center;justify-content:space-between;color:var(--dorado-c);font-size:16px;font-weight:bold;letter-spacing:1px;margin-bottom:8px}
.tabla-cabecera .boton-control{min-width:28px;height:28px;font-size:15px}
.tabla-filas{flex:1;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;align-content:start}
.fila-pago{display:flex;align-items:center;justify-content:space-between;gap:6px;background:rgba(255,255,255,.06);border-radius:6px;padding:3px 8px}
.fila-pago .combo{display:flex;align-items:center;gap:2px}
.fila-pago img{width:17px;height:17px;object-fit:contain;background:var(--crema);border-radius:3px;padding:1px}
.fila-pago .importe{color:#7CFC8a;font-family:"Courier New",monospace;font-size:14px;font-weight:bold}
.fila-pago.gordo{border:1px solid var(--dorado);background:rgba(232,185,74,.16)}
.fila-pago.gordo .importe{color:var(--dorado-c)}
.fila-pago.segundo{border:1px solid #9a9a9a;background:rgba(200,200,200,.12)}
.fila-pago.segundo .importe{color:#dcdcdc}
.fila-pago.jackpot-row{border:2px solid #ffd700;background:rgba(255,215,0,.2);grid-column:1/-1}
.fila-pago.jackpot-row .importe{color:#ffd700;font-size:16px}
.tabla-nota{margin-top:8px;color:var(--dorado);font-size:11px;font-style:italic;text-align:center}
.oculto{display:none}
.particles{position:absolute;inset:0;pointer-events:none;z-index:20;overflow:hidden}
.particle{position:absolute;width:8px;height:8px;border-radius:50%;animation:particleFall 1.5s ease-in forwards}
@keyframes particleFall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(300px) rotate(720deg);opacity:0}}
@keyframes machineShake{0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-4px)}20%,40%,60%,80%{transform:translateX(4px)}}
.maquina.shake{animation:machineShake .5s ease-in-out}
.providers-panel{margin-top:10px;background:#111;border:2px solid var(--dorado);border-radius:10px;overflow:hidden}
.providers-header{display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:var(--purple);color:var(--dorado-c);font-size:11px;font-weight:bold;letter-spacing:1px;cursor:pointer}
.providers-arrow{font-size:10px;transition:transform .2s}
.providers-arrow.collapsed{transform:rotate(-90deg)}
.providers-body{padding:8px 10px}
.providers-body.collapsed{display:none}
.providers-summary{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}
.providers-stat{flex:1;background:rgba(255,255,255,.04);border-radius:6px;padding:4px 6px;text-align:center}
.providers-stat-label{display:block;color:var(--dorado);font-size:9px;letter-spacing:1px}
.providers-stat-value{display:block;color:#ffd9d9;font-family:"Courier New",monospace;font-size:14px;font-weight:bold}
.providers-list{display:flex;flex-direction:column;gap:4px;max-height:150px;overflow-y:auto}
.provider-row{display:flex;align-items:center;gap:8px;padding:3px 6px;border-radius:6px;background:rgba(255,255,255,.03)}
.provider-row:hover{background:rgba(255,255,255,.06)}
.provider-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.provider-icon{width:18px;height:18px;object-fit:contain;flex-shrink:0}
.provider-name{flex:1;color:#ccc;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.provider-tokens{color:var(--dorado-c);font-family:"Courier New",monospace;font-size:12px;font-weight:bold}
`;

function getScript(imgMapJson: string): string {
  return `
const SYMBOLS=['mistral','nvidia','minimax','zai','qwen','deepseek','xai','gemini','codex','claude'];
const APUESTAS=[5,10,25,50,100];
const START_CREDITS=1000;
const BASE=APUESTAS[0];
const FREQ={mistral:5,nvidia:3,minimax:2,zai:2,qwen:2,deepseek:2,xai:1,gemini:1,codex:1,claude:1};
const IMG=${imgMapJson};
const PCOLORS={openai:'#10a37f',anthropic:'#d4a574',google:'#4285f4',xai:'#fff',deepseek:'#4d6bfe',qwen:'#6f42c1',zhipu:'#00bfa5',minimax:'#e74c3c',nvidia:'#76b900',mistral:'#ff7000',unknown:'#888'};
const PICONS={openai:'codex',anthropic:'claude',google:'gemini',xai:'xai',deepseek:'deepseek',qwen:'qwen',zhipu:'zai',minimax:'minimax',nvidia:'nvidia',mistral:'mistral',unknown:'codex'};

function buildReel(order){const r=[];for(const s of order)for(let i=0;i<FREQ[s];i++)r.push(s);return r}
function shuffle(arr,seed){const c=[...arr];let st=seed;for(let i=c.length-1;i>0;i--){st=(st*1103515245+12345)%2147483648;const j=st%(i+1);[c[i],c[j]]=[c[j],c[i]]}return c}
const REELS=[
  shuffle(buildReel(['mistral','nvidia','minimax','zai','qwen','deepseek','xai','gemini','codex','claude']),7),
  shuffle(buildReel(['nvidia','mistral','qwen','minimax','claude','zai','gemini','deepseek','codex','xai']),20),
  shuffle(buildReel(['minimax','qwen','mistral','deepseek','nvidia','zai','codex','xai','gemini','claude']),33)
];
function doSpin(){return REELS.map(r=>Math.floor(Math.random()*r.length))}
const TAB3={claude:0,codex:150,gemini:100,xai:75,deepseek:60,qwen:40,zai:30,minimax:20,nvidia:15,mistral:10};
function payout(sym,bet=BASE){const m=bet/BASE;const[a,b,c]=sym;if(a===b&&b===c)return TAB3[a]*m;const mi=sym.filter(s=>s==='mistral').length;if(mi===2)return 5*m;if(mi===1)return 2*m;return 0}

// Sound
let actx=null,muted=false;
function ac(){if(!actx)actx=new AudioContext();if(actx.state==='suspended')actx.resume();return actx}
function tone(f,d,t='square',v=.06,dl=0){if(muted)return;try{const c=ac(),o=c.createOscillator(),g=c.createGain(),t0=c.currentTime+dl;o.type=t;o.frequency.value=f;g.gain.setValueAtTime(v,t0);g.gain.exponentialRampToValueAtTime(.001,t0+d);o.connect(g).connect(c.destination);o.start(t0);o.stop(t0+d)}catch(e){}}
function sLever(){tone(180,.08,'square',.08);tone(110,.12,'square',.08,.06)}
function sStop(){tone(320,.06,'triangle',.09)}
function sWin(n){const ns=n>=100?[523,659,784,1047,784,1047,1319]:[523,659,784,1047];ns.forEach((f,i)=>tone(f,.18,'triangle',.09,i*.12))}
function sJackpot(){[523,659,784,1047,784,1047,1319,1568,1319,1568,2093].forEach((f,i)=>tone(f,.2,'triangle',.12,i*.1))}
function sLose(){tone(150,.2,'sawtooth',.04)}
function sRefill(){tone(440,.1,'sine',.06);tone(554,.1,'sine',.06,.1);tone(659,.1,'sine',.06,.2);tone(880,.15,'sine',.08,.3)}
function sJpGrow(){tone(1200,.05,'sine',.04)}

// State
const H=78,REP=7,TURNS=[2,3,4],DUR=[1100,1600,2100];
const $=id=>document.getElementById(id);
const tiras=[...document.querySelectorAll('.tira')];
let credits=START_CREDITS,rec=0,betIdx=0,spinning=false,idx=[0,0,0];
let totalSpins=0,totalBet=0,totalWon=0,wins=0,losses=0,bigWin=0,jackpotsWon=0,streak=0,bestStreak=0;
let jackpot=500;
const bet=()=>APUESTAS[betIdx];

function mountReels(){tiras.forEach((t,i)=>{const c=[];for(let r=0;r<REP;r++)for(const s of REELS[i])c.push('<div class="celda"><img src="'+IMG[s]+'" alt="'+s+'"></div>');t.innerHTML=c.join('');place(t,idx[i])})}
function place(t,i){t.style.transition='none';t.style.transform='translateY('+(-i*H)+'px)'}
function spinReel(n,dest,dur){return new Promise(r=>{const t=tiras[n],len=REELS[n].length,cur=idx[n],adv=TURNS[n]*len+((dest-cur+len)%len),fin=cur+adv;t.getBoundingClientRect();t.style.transition='transform '+dur+'ms cubic-bezier(.15,.6,.25,1)';t.style.transform='translateY('+(-fin*H)+'px)';t.addEventListener('transitionend',()=>{idx[n]=dest;place(t,dest);sStop();r()},{once:true})})}

function paint(){
  $('creditos').textContent=credits.toLocaleString();
  $('record').textContent=rec.toLocaleString();
  $('apuesta').textContent=bet();
  $('jackpot-amount').textContent=jackpot.toLocaleString();
  const jd=$('jackpot-display');
  jd.classList.toggle('hot',jackpot>5000);
  $('stat-spins').textContent='Tiradas:'+totalSpins;
  $('stat-wins').textContent='Vic:'+wins;
  const rtp=totalBet>0?((totalWon/totalBet)*100).toFixed(1):'0';
  $('stat-rtp').textContent='RTP:'+rtp+'%';
  $('stat-streak').textContent='Racha:'+streak;
}

function save(){
  const vscode=typeof acquireVsCodeApi!=='undefined'?acquireVsCodeApi():null;
  if(!vscode)return;
  vscode.postMessage({command:'saveState',credits,record,betIndex:betIdx,totalSpins,totalTokensSpent:totalBet,jackpot,
    gameStats:{wins,losses,biggestWin:bigWin,jackpotsWon,streak,bestStreak,totalBet,totalWon}});
  vscode.postMessage({command:'updateStatus',tokens:totalBet});
}

async function tirar(){
  if(spinning)return;
  const b=bet();
  if(credits<b){
    // Second chance!
    $('mensaje').textContent='Segunda oportunidad...';
    $('mensaje').className='mensaje jackpot-msg';
    sRefill();
    await new Promise(r=>setTimeout(r,1500));
    credits=100;
    $('mensaje').textContent='100 tokens gratis. A juega!';
    $('mensaje').className='mensaje';
    paint();
  }
  spinning=true;
  $('palanca').classList.add('bloqueada');
  $('apuesta-menos').disabled=true;$('apuesta-mas').disabled=true;$('btn-spin').disabled=true;
  $('mensaje').classList.remove('gano','jackpot-msg');
  $('mensaje').textContent='Girando...';
  credits-=b;
  const jpCut=Math.floor(b*.1);
  jackpot+=jpCut;
  totalBet+=b;totalSpins++;streak=0;
  paint();sLever();
  const res=doSpin();
  await Promise.all(res.map((d,i)=>spinReel(i,d,DUR[i])));
  const sym=res.map((d,i)=>REELS[i][d]);
  // Check jackpot: 3x claude
  const isJackpot=sym[0]==='claude'&&sym[1]==='claude'&&sym[2]==='claude';
  let prize=0;
  if(isJackpot){
    prize=jackpot;
    jackpot=500;
    jackpotsWon++;
    $('mensaje').textContent='JACKPOT! +'+prize.toLocaleString();
    $('mensaje').className='mensaje jackpot-msg';
    sJackpot();
    spawnParticles();
    $('maquina').classList.add('shake');
    setTimeout(()=>$('maquina').classList.remove('shake'),500);
  } else {
    prize=payout(sym,b);
    if(prize>0){
      if(prize>rec)rec=prize;
      if(prize>bigWin)bigWin=prize;
      $('mensaje').textContent='PREMIO! +'+prize;
      $('mensaje').classList.add('gano');
      sWin(prize);
      if(prize>=50){$('maquina').classList.add('shake');setTimeout(()=>$('maquina').classList.remove('shake'),500)}
      blinkLights();
    } else {
      $('mensaje').textContent='Otra vez sera...';
      sLose();
    }
  }
  if(prize>0){credits+=prize;totalWon+=prize;wins++;streak++;if(streak>bestStreak)bestStreak=streak}else{losses++}
  paint();save();
  spinning=false;
  $('palanca').classList.remove('bloqueada');
  $('apuesta-menos').disabled=false;$('apuesta-mas').disabled=false;$('btn-spin').disabled=false;
}

function spawnParticles(){
  const c=$('particles');
  const colors=['#ffd700','#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ff9ff3','#feca57','#ff4757'];
  for(let i=0;i<40;i++){
    const p=document.createElement('div');p.className='particle';
    p.style.left=Math.random()*100+'%';p.style.top=Math.random()*30+'%';
    p.style.background=colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDelay=Math.random()*.5+'s';
    p.style.animationDuration=(1+Math.random())+'s';
    p.style.width=(4+Math.random()*8)+'px';p.style.height=p.style.width;
    c.appendChild(p);setTimeout(()=>p.remove(),2500);
  }
}

// Lever
let dragging=false,yStart=0,prog=0;
const brazo=$('brazo'),palanca=$('palanca');
function paintArm(p){brazo.style.transform='scaleY('+(1-2*p)+')'}
palanca.addEventListener('pointerdown',e=>{if(spinning)return;dragging=true;yStart=e.clientY;brazo.classList.remove('soltada');palanca.setPointerCapture(e.pointerId)});
palanca.addEventListener('pointermove',e=>{if(!dragging)return;prog=Math.min(1,Math.max(0,(e.clientY-yStart)/80));paintArm(prog)});
palanca.addEventListener('pointerup',()=>{if(!dragging)return;dragging=false;const click=prog<.15;releaseArm(click)});
function releaseArm(click){const go=()=>{brazo.classList.add('soltada');paintArm(0);tirar()};if(click&&!spinning){brazo.classList.add('soltada');paintArm(1);setTimeout(go,250)}else if(prog>.55){go()}else{brazo.classList.add('soltada');paintArm(0)}prog=0}

// Spin button
$('btn-spin').addEventListener('click',()=>{if(!spinning)tirar()});

// Lights
function mountLights(){for(const id of['luces','luces2'])$(id).innerHTML='<div class="luz"></div>'.repeat(5);let f=0;setInterval(()=>{f=1-f;document.querySelectorAll('.luz').forEach((l,i)=>l.classList.toggle('on',i%2===f))},600)}
function blinkLights(){const ls=document.querySelectorAll('.luz');let c=0;const id=setInterval(()=>{ls.forEach(l=>l.classList.toggle('on'));if(++c>9)clearInterval(id)},120)}

// Controls
$('apuesta-menos').addEventListener('click',()=>{if(spinning)return;if(betIdx>0){betIdx--;paint();save()}});
$('apuesta-mas').addEventListener('click',()=>{if(spinning)return;if(betIdx<APUESTAS.length-1){betIdx++;paint();save()}});
$('recargar').addEventListener('click',()=>{credits+=100;paint();if(!spinning)$('mensaje').textContent='Tokens recargados';save()});
$('silencio').addEventListener('click',()=>{muted=!muted;$('silencio').querySelector('.ondas').classList.toggle('oculto',muted);$('silencio').querySelector('.tachado').classList.toggle('oculto',!muted)});

// Payout table
function mountTable(){
  $('tabla-titulo').textContent='Premios (apuesta '+bet()+')';
  const rows=[{s:'claude',pr:'JACKPOT',v:3,jp:true}];
  for(const s of['codex','gemini','xai','deepseek','qwen','zai','minimax','nvidia','mistral'])
    rows.push({s,pr:payout([s,s,s],bet()),v:3,jp:false});
  rows.push({s:'mistral',pr:payout(['mistral','mistral','x'],bet()),v:2,jp:false});
  rows.push({s:'mistral',pr:payout(['mistral','x','y'],bet()),v:1,jp:false});
  $('tabla-filas').innerHTML=rows.map(({s,pr,v,jp},i)=>{
    const imgs='<img src="'+IMG[s]+'" alt="'+s+'">'.repeat(v)+(v<3?'<span style="color:#666;font-size:12px">+</span>'.repeat(3-v):'');
    const cls=jp?'jackpot-row':i===1?'gordo':i===2?'segundo':'';
    return '<div class="fila-pago '+cls+'"><span class="combo">'+imgs+'</span><span class="importe">'+(typeof pr==='string'?pr:pr)+'</span></div>';
  }).join('');
}
$('info').addEventListener('click',()=>{mountTable();$('tabla-pagos').classList.remove('oculto')});
$('cerrar-tabla').addEventListener('click',()=>$('tabla-pagos').classList.add('oculto'));

// Provider panel
$('providers-toggle').addEventListener('click',()=>{$('providers-body').classList.toggle('collapsed');$('providers-arrow').classList.toggle('collapsed')});
function fmtN(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return String(n)}
function renderProviders(today,allTime){
  const tt=(today.totalInput||0)+(today.totalOutput||0);
  const at=(allTime.inputTokens||0)+(allTime.outputTokens||0);
  $('stat-today-total').textContent=fmtN(tt);
  $('stat-alltime-total').textContent=fmtN(at);
  $('stat-today-inout').textContent=fmtN(today.totalInput||0)+'/'+fmtN(today.totalOutput||0);
  const provs=today.providers||{};
  const sorted=Object.entries(provs).sort((a,b)=>(b[1].totalOutput||0)-(a[1].totalOutput||0));
  const list=$('providers-list');
  if(!sorted.length){list.innerHTML='<div style="color:#666;font-size:11px;text-align:center;padding:8px">Sin actividad aun</div>';return}
  list.innerHTML=sorted.map(([id,u])=>{
    const c=PCOLORS[id]||'#888';const ik=PICONS[id]||'codex';const url=IMG[ik]||'';
    const out=u.totalOutput||0;const inp=u.totalInput||0;if(!out&&!inp)return'';
    return '<div class="provider-row"><div class="provider-dot" style="background:'+c+';box-shadow:0 0 4px '+c+'"></div>'+(url?'<img class="provider-icon" src="'+url+'">':'')+'<span class="provider-name">'+(u.providerName||id)+'</span><span class="provider-tokens">'+fmtN(out)+'</span></div>';
  }).filter(Boolean).join('');
}

// VSCode messages
const vscode=typeof acquireVsCodeApi!=='undefined'?acquireVsCodeApi():null;
window.addEventListener('message',e=>{
  const m=e.data;if(!m||!m.command)return;
  switch(m.command){
    case'init':
      if(typeof m.credits==='number')credits=m.credits;
      if(typeof m.record==='number')rec=m.record;
      if(typeof m.betIndex==='number'&&m.betIndex>=0&&m.betIndex<APUESTAS.length)betIdx=m.betIndex;
      if(typeof m.totalSpins==='number')totalSpins=m.totalSpins;
      if(typeof m.jackpot==='number')jackpot=m.jackpot;
      if(m.gameStats){const g=m.gameStats;wins=g.wins||0;losses=g.losses||0;bigWin=g.biggestWin||0;jackpotsWon=g.jackpotsWon||0;streak=g.streak||0;bestStreak=g.bestStreak||0;totalBet=g.totalBet||0;totalWon=g.totalWon||0}
      paint();mountReels();mountLights();paintArm(0);
      if(credits<bet())$('mensaje').textContent='Tira de la palanca!';
      break;
    case'spin':if(!spinning)tirar();break;
    case'reset':
      credits=START_CREDITS;rec=0;betIdx=0;totalSpins=0;totalBet=0;totalWon=0;
      wins=0;losses=0;bigWin=0;jackpotsWon=0;streak=0;bestStreak=0;jackpot=500;
      paint();mountReels();$('mensaje').textContent='Reiniciado. A jugar!';break;
    case'updateTokenStats':renderProviders(m.todayUsage||{},m.allTimeTotal||{});break;
    case'aiTokensFed':
      if(typeof m.tokens==='number'&&m.tokens>0){
        jackpot+=m.tokens;
        const jd=$('jackpot-display');jd.classList.add('feeding');setTimeout(()=>jd.classList.remove('feeding'),300);
        sJpGrow();paint();save();
      }break;
  }
});

if(!vscode){paint();mountReels();mountLights();paintArm(0)}
`;
}
