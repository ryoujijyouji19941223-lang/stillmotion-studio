import {
  canvasPointToSource,
  evaluateMotion,
  normalizeMotionRegion,
  normalizeSceneMotion,
  rectFromPoints,
  sourceRectToCanvas
} from './src/v0.2/partial-motion.mjs';

const EFFECTS = [
  ['rain','雨'], ['wind','風'], ['leaves','葉っぱ'], ['glow','木漏れ日'],
  ['butterflies','蝶'], ['sparkles','光の粒'], ['snow','雪'], ['dust','ほこり']
];

const SAMPLE_TEXTS = [
  'まると おともだち',
  'ある まちに、\nこいぬの まるが\nすんでいました。\n\nまるは おともだちと\nあそぶのが だいすきです。',
  'きょうも まるは、\nるんるん こうえんへ\nむかいます。\n\n「みんなと あそぶの、\nたのしみだな！」',
  'こうえんには、\nぴょんくんと\nぴーちゃんがいました。\n\nでも、\nみぃちゃんの すがたが\nありません。',
  '「みぃちゃんは\nきてないの？」\n\nまるが きくと、\nぴょんくんが いいました。\n\n「きょうは\nおねつが あるんだって」',
  'まるは さっそく、\nみぃちゃんの おみまいに\nいくことにしました。\n\n「だいじょうぶかなあ」',
  '「みぃちゃん、\nだいじょうぶ？」\n\nみぃちゃんは\nちいさなこえで、\n「おみずが のみたいの」\nと いいました。',
  'まるは おみずを\nいれてあげました。\n\n「ありがとう……」\n\nみぃちゃんは ほっとして、\nすやすや ねむりました。',
  'ある じめじめした ひ。\nまるが おかいものの\nかえりみちを\nあるいていると、\nざあざあ あめが\nふってきました。',
  'きの したには、\nぴょんくんが いました。\n\n「まるくん！\nぼくも かさに\nいれておくれ！」',
  '「いっしょに かえろう！」\n\nまるが いうと、\nぴょんくんは にっこり。\n\nにもつを はんぶん\nもってくれました。',
  'つよい かぜの\nふいた よるが すぎ、\nあさに なりました。\n\nまるが おさんぽをしていると、\nかなしい かおをした\nぴーちゃんが いました。\n\n「おうちが こわれちゃったの」',
  'まるは もりを\nかけまわって、\nこえだを たくさん\nあつめました。\n\nぴーちゃんは\nやわらかい くさを\nあつめました。',
  'ふたりで\nいっしょうけんめい、\nあたらしい おうちを\nつくりました。\n\n「ありがとう！」\n\nぴーちゃんは\nおはなの かんむりを\nくれました。',
  'とても いい\nおてんきの ひ。\n\nまるは おべんとうを\nもって、\nこうえんへ\nやってきました。\n\n「みんなで たべよう！」',
  'みんなで すわって、\n「いただきます！」\nと いおうとした そのとき――\n\nびゅうううっ！\n\nつよい かぜが\nふいてきました。',
  'コップが ころころ。\nナプキンが ひらひら。\nつつみも とんでいきます。\n\nぴょんくんは\nコップを ひろい、\nみぃちゃんは\nナプキンを つかまえました。\n\nぴーちゃんは\nとんでいった つつみを\nじょうずに くちばしで\nつかまえてくれました。',
  'みんなで にっこり。\nこんどこそ、\n「いただきます！」\n\nいっしょに あそんで、\nこまっていたら そばにいく。\n\nいっしょに わらって、\nおはなしして、\nたのしいことが いっぱい。\n\nまると、たいせつな\nおともだち。\n\nあしたは なにをして\nあそぼうかな。'
];

const SAMPLE_EFFECTS = [
  ['glow','sparkles'], ['glow'], ['glow'], ['leaves'], ['leaves'], ['glow'],
  ['glow'], ['glow'], ['rain'], ['rain'], ['rain'], ['wind','leaves'],
  ['leaves'], ['glow','leaves'], ['glow','butterflies'], ['wind','leaves'],
  ['wind','leaves'], ['glow','butterflies']
];

function estimateDuration(text){
  const n = (text || '').replace(/\s/g,'').length;
  return Math.max(4, Math.min(35, +(n / 5.2 + 1.8).toFixed(1)));
}

const state = {
  project: {
    formatVersion: 1,
    title: 'まると おともだち',
    width: 720,
    height: 960,
    fps: 30,
    bgmVolume: 0.35,
    scenes: SAMPLE_TEXTS.map((text, i) => ({
      id: crypto.randomUUID(),
      name: i === 0 ? '表紙' : `${i+1}ページ`,
      image: `sample/maru/${String(i+1).padStart(2,'0')}.webp`,
      imageObjectUrl: null,
      narration: text,
      duration: estimateDuration(text),
      camera: 'none',
      textLock: true,
      effects: SAMPLE_EFFECTS[i],
      effectStrength: i === 15 || i === 16 ? 0.9 : 0.55,
      motionRegions: i===11?[{
        id:'sample-tree-canopy',name:'木の葉（見本）',enabled:true,zIndex:0,
        mask:{kind:'rectangle',width:960,height:1440,rect:{x:430,y:0,width:530,height:370},source:null,feather:12,invert:false},
        motion:{type:'sway',amplitude:.18,speed:.25,phase:0,axis:'x',pivot:{x:.82,y:1}}
      }]:[],
      runtime: { narrationFile:null, ambientFile:null }
    }))
  },
  selected: 0,
  images: new Map(),
  particles: new Map(),
  playing: false,
  playToken: 0,
  bgmFile: null,
  audioPreview: [],
  selectedMotionRegionId: null,
  selectingRegion: false,
  selectionSession: null,
  selectionDraft: null,
  exporting: false
};

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');

function currentScene(){ return state.project.scenes[state.selected]; }
function currentMotionRegion(){
  return (currentScene()?.motionRegions || []).find(region => region.id === state.selectedMotionRegionId) || null;
}

function seeded(seed){
  let s = seed >>> 0;
  return () => ((s = Math.imul(1664525, s) + 1013904223 >>> 0) / 4294967296);
}
function hashString(str){ let h=2166136261; for(const ch of str){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)} return h>>>0; }
function particleSet(scene){
  if(state.particles.has(scene.id)) return state.particles.get(scene.id);
  const r = seeded(hashString(scene.id));
  const p = {
    rain: Array.from({length:180},()=>({x:r(),y:r(),len:.018+r()*.035,speed:.5+r()*1.2,alpha:.25+r()*.55})),
    leaves: Array.from({length:34},()=>({x:r(),y:r(),size:.008+r()*.014,speed:.025+r()*.045,drift:(r()-.5)*.12,rot:r()*6.28,phase:r()*6.28})),
    snow: Array.from({length:90},()=>({x:r(),y:r(),size:.002+r()*.006,speed:.02+r()*.04,phase:r()*6.28})),
    dust: Array.from({length:65},()=>({x:r(),y:r(),size:.001+r()*.004,phase:r()*6.28,alpha:.12+r()*.35})),
    butterflies: Array.from({length:5},()=>({x:.55+r()*.4,y:.25+r()*.55,size:.01+r()*.014,phase:r()*6.28,speed:.025+r()*.025}))
  };
  state.particles.set(scene.id,p); return p;
}

async function loadImage(src){
  if(!src) return null;
  if(state.images.has(src)) return state.images.get(src);
  const img = new Image(); img.decoding='async';
  const p = new Promise((res,rej)=>{ img.onload=()=>res(img); img.onerror=rej; });
  img.src=src; state.images.set(src,p); return p;
}

function coverPlacement(img,w,h,scene,t){
  const sw=img.naturalWidth, sh=img.naturalHeight;
  let base = Math.max(w/sw,h/sh);
  let scale=base, dx=0, dy=0;
  if(!scene.textLock){
    const cam=scene.camera;
    if(cam==='zoom-in') scale*=1+0.045*t;
    if(cam==='zoom-out') scale*=1.045-0.045*t;
    if(cam==='float') scale*=1.012+Math.sin(t*Math.PI*2)*.004;
  }
  const dw=sw*scale, dh=sh*scale;
  let x=(w-dw)/2, y=(h-dh)/2;
  if(!scene.textLock){
    if(scene.camera==='pan-left') dx = (t-.5)*w*.055;
    if(scene.camera==='pan-right') dx = (.5-t)*w*.055;
    if(scene.camera==='float'){dx=Math.sin(t*Math.PI*2)*w*.008;dy=Math.cos(t*Math.PI*2)*h*.006}
  }
  return {x:x+dx,y:y+dy,width:dw,height:dh,scale};
}

function drawCover(img,w,h,scene,t){
  const placement=coverPlacement(img,w,h,scene,t);
  ctx.drawImage(img,placement.x,placement.y,placement.width,placement.height);
  return placement;
}

function regionSourceRect(region,img){
  if(region.mask.kind!=='rectangle'||!region.mask.rect)return null;
  const fx=img.naturalWidth/Math.max(1,region.mask.width);
  const fy=img.naturalHeight/Math.max(1,region.mask.height);
  const raw=region.mask.rect;
  const x=Math.max(0,Math.min(img.naturalWidth,raw.x*fx));
  const y=Math.max(0,Math.min(img.naturalHeight,raw.y*fy));
  return {
    x,
    y,
    width:Math.max(0,Math.min(img.naturalWidth-x,raw.width*fx)),
    height:Math.max(0,Math.min(img.naturalHeight-y,raw.height*fy))
  };
}

function drawPartialMotions(img,scene,placement,elapsedSeconds){
  for(const rawRegion of scene.motionRegions||[]){
    const region=normalizeMotionRegion(rawRegion);
    if(!region.enabled)continue;
    const source=regionSourceRect(region,img);
    if(!source||source.width<1||source.height<1)continue;
    const dest=sourceRectToCanvas(source,placement);
    const motion=evaluateMotion(region,elapsedSeconds);
    const pivotX=dest.x+dest.width*region.motion.pivot.x;
    const pivotY=dest.y+dest.height*region.motion.pivot.y;

    ctx.save();
    ctx.beginPath();
    ctx.rect(dest.x-1,dest.y-1,dest.width+2,dest.height+2);
    ctx.clip();
    ctx.globalAlpha*=motion.opacity;
    ctx.translate(
      pivotX+motion.translateX*dest.width,
      pivotY+motion.translateY*dest.height
    );
    ctx.rotate(motion.rotation*Math.PI/180);
    ctx.scale(motion.scaleX,motion.scaleY);
    ctx.drawImage(
      img,
      source.x,source.y,source.width,source.height,
      -dest.width*region.motion.pivot.x,
      -dest.height*region.motion.pivot.y,
      dest.width,dest.height
    );
    ctx.restore();
  }
}

function drawEffects(scene,t,w,h){
  const P=particleSet(scene), str=scene.effectStrength ?? .55;
  for(const effect of scene.effects || []){
    ctx.save();
    if(effect==='rain'){
      ctx.strokeStyle=`rgba(205,230,255,${.35+.35*str})`; ctx.lineWidth=Math.max(1,w/520);
      for(const d of P.rain){
        const y=((d.y+t*d.speed*2)%1)*h, x=((d.x+t*.04)%1)*w;
        ctx.globalAlpha=d.alpha*str; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-w*.008,y+d.len*h);ctx.stroke();
      }
      ctx.globalAlpha=.08*str; ctx.fillStyle='#6da7d9';ctx.fillRect(0,0,w,h);
    }
    if(effect==='wind'){
      ctx.strokeStyle=`rgba(255,255,255,${.22+.35*str})`; ctx.lineWidth=Math.max(1,w/500);
      for(let i=0;i<10;i++){
        const yy=((i*.103+t*.35)%1)*h; const xx=((t*.9+i*.17)%1)*w-w*.25;
        ctx.beginPath();ctx.moveTo(xx,yy);ctx.bezierCurveTo(xx+w*.08,yy-h*.018,xx+w*.17,yy+h*.018,xx+w*.25,yy);ctx.stroke();
      }
    }
    if(effect==='leaves'){
      for(const d of P.leaves){
        const yy=((d.y+t*d.speed*3)%1)*h; const xx=((d.x+t*d.drift+Math.sin(t*5+d.phase)*.02)%1)*w;
        ctx.save();ctx.translate(xx,yy);ctx.rotate(d.rot+t*2);ctx.globalAlpha=.45+.45*str;ctx.fillStyle=iColor(d.phase);
        ctx.beginPath();ctx.ellipse(0,0,d.size*w,d.size*w*.45,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
    if(effect==='glow'){
      const a=(.06+.05*Math.sin(t*Math.PI*2))*str;
      const g=ctx.createRadialGradient(w*.7,h*.18,0,w*.7,h*.18,w*.75);g.addColorStop(0,`rgba(255,244,183,${a*2})`);g.addColorStop(1,'rgba(255,244,183,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }
    if(effect==='sparkles'){
      for(let i=0;i<25;i++){const rr=seeded(i*999+hashString(scene.id)); const x=rr()*w,y=rr()*h;const a=(.1+.4*Math.abs(Math.sin(t*5+i)))*str;ctx.fillStyle=`rgba(255,248,210,${a})`;ctx.beginPath();ctx.arc(x,y,1+rr()*2.5,0,6.28);ctx.fill()}
    }
    if(effect==='snow'){
      ctx.fillStyle='white';for(const d of P.snow){const y=((d.y+t*d.speed*2)%1)*h;const x=(d.x+Math.sin(t*4+d.phase)*.02)*w;ctx.globalAlpha=.35+.55*str;ctx.beginPath();ctx.arc(x,y,d.size*w,0,6.28);ctx.fill()}
    }
    if(effect==='dust'){
      ctx.fillStyle='#fff4c4';for(const d of P.dust){const x=(d.x+Math.sin(t*2+d.phase)*.01)*w,y=(d.y+Math.cos(t*1.6+d.phase)*.01)*h;ctx.globalAlpha=d.alpha*str;ctx.beginPath();ctx.arc(x,y,d.size*w,0,6.28);ctx.fill()}
    }
    if(effect==='butterflies'){
      for(const d of P.butterflies){const x=(d.x+Math.sin(t*3+d.phase)*.035)*w,y=(d.y+Math.cos(t*2.2+d.phase)*.025)*h;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*4+d.phase)*.25);ctx.fillStyle=`rgba(255,211,65,${.55+.35*str})`;const s=d.size*w;ctx.beginPath();ctx.ellipse(-s*.35,0,s*.42,s*.6,-.4,0,6.28);ctx.ellipse(s*.35,0,s*.42,s*.6,.4,0,6.28);ctx.fill();ctx.restore()}
    }
    ctx.restore();
  }
}
function iColor(phase){return ['#6f9d4a','#a4b94a','#d29a42','#7ca35b'][Math.floor((phase/6.28)*4)%4]}

function drawRegionGuide(rect,label,active){
  ctx.save();
  ctx.fillStyle=active?'rgba(76,184,255,.16)':'rgba(76,184,255,.07)';
  ctx.fillRect(rect.x,rect.y,rect.width,rect.height);
  ctx.strokeStyle=active?'#7bd2ff':'rgba(123,210,255,.65)';
  ctx.lineWidth=Math.max(2,canvas.width/360);
  ctx.setLineDash(active?[]:[9,7]);
  ctx.strokeRect(rect.x,rect.y,rect.width,rect.height);
  ctx.setLineDash([]);
  ctx.font=`${Math.max(12,canvas.width/48)}px sans-serif`;
  const text=String(label||'動かす範囲');
  const textWidth=ctx.measureText(text).width;
  const labelHeight=Math.max(20,canvas.width/30);
  const labelY=Math.max(0,rect.y-labelHeight);
  ctx.fillStyle=active?'rgba(19,105,154,.95)':'rgba(32,62,82,.9)';
  ctx.fillRect(rect.x,labelY,textWidth+14,labelHeight);
  ctx.fillStyle='#fff';
  ctx.fillText(text,rect.x+7,labelY+labelHeight*.72);
  ctx.restore();
}

function drawMotionGuides(img,scene,placement){
  for(const rawRegion of scene.motionRegions||[]){
    const region=normalizeMotionRegion(rawRegion);
    const source=regionSourceRect(region,img);
    if(!source)continue;
    drawRegionGuide(sourceRectToCanvas(source,placement),region.name,region.id===state.selectedMotionRegionId);
  }
  if(state.selectionDraft){
    drawRegionGuide(sourceRectToCanvas(state.selectionDraft,placement),'ここを動かす',true);
  }
}

async function renderFrame(scene, norm){
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#111';ctx.fillRect(0,0,w,h);
  const t=Math.max(0,Math.min(1,norm));let img=null,placement=null;
  try{img=await loadImage(scene.imageObjectUrl||scene.image);if(img){placement=drawCover(img,w,h,scene,t);drawPartialMotions(img,scene,placement,t*scene.duration)}}catch(e){drawMissing(scene)}
  drawEffects(scene,t,w,h);
  if(img&&placement&&!state.playing&&!state.exporting)drawMotionGuides(img,scene,placement);
}
function drawMissing(scene){ctx.fillStyle='#222';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#bbb';ctx.font='22px sans-serif';ctx.fillText('画像を追加してください',30,50)}

function renderSceneList(){
  const root=$('sceneList');root.innerHTML='';
  state.project.scenes.forEach((s,i)=>{
    const el=document.createElement('div');el.className='scene-card'+(i===state.selected?' active':'');
    const img=document.createElement('img');img.src=s.imageObjectUrl||s.image||'';
    const mid=document.createElement('div');const motionMeta=(s.motionRegions||[]).length?` · 部分${s.motionRegions.length}`:'';mid.innerHTML=`<div class="title">${escapeHtml(s.name||`Scene ${i+1}`)}</div><div class="meta">${s.duration.toFixed(1)}秒 · ${(s.effects||[]).map(effectLabel).join(' / ')||'効果なし'}${motionMeta}</div>`;
    const order=document.createElement('div');order.className='order';
    const up=document.createElement('button');up.textContent='▲';up.onclick=(e)=>{e.stopPropagation();moveScene(i,-1)};
    const dn=document.createElement('button');dn.textContent='▼';dn.onclick=(e)=>{e.stopPropagation();moveScene(i,1)};
    order.append(up,dn);el.append(img,mid,order);el.onclick=()=>selectScene(i);root.append(el);
  });
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function effectLabel(key){return (EFFECTS.find(x=>x[0]===key)||[key,key])[1]}
function moveScene(i,d){const j=i+d;if(j<0||j>=state.project.scenes.length)return;const a=state.project.scenes;[a[i],a[j]]=[a[j],a[i]];state.selected=j;renderSceneList();syncControls();renderFrame(currentScene(),0)}
function selectScene(i){cancelRegionSelection();state.selected=Math.max(0,Math.min(i,state.project.scenes.length-1));state.selectedMotionRegionId=null;stopPlayback();renderSceneList();syncControls();renderFrame(currentScene(),0)}

function setSelectionMode(enabled){
  state.selectingRegion=!!enabled;
  state.selectionSession=null;
  state.selectionDraft=null;
  canvas.classList.toggle('selecting-region',state.selectingRegion);
  $('selectRegionBtn').textContent=state.selectingRegion?'選択をやめる':'＋ 範囲を選ぶ';
  $('selectionNotice').hidden=!state.selectingRegion;
  renderFrame(currentScene(),+$('scrubber').value/1000);
}
function cancelRegionSelection(){if(state.selectingRegion||state.selectionDraft)setSelectionMode(false)}

function syncMotionControls(scene){
  scene.motionRegions=Array.isArray(scene.motionRegions)?scene.motionRegions:[];
  if(!scene.motionRegions.some(region=>region.id===state.selectedMotionRegionId)){
    state.selectedMotionRegionId=scene.motionRegions[0]?.id||null;
  }
  const select=$('motionRegionSelect');select.innerHTML='';
  scene.motionRegions.forEach((region,index)=>{
    const option=document.createElement('option');option.value=region.id;option.textContent=region.name||`範囲 ${index+1}`;select.append(option);
  });
  const region=currentMotionRegion();
  $('motionEmpty').hidden=!!region;
  $('motionEditor').hidden=!region;
  if(region){
    select.value=region.id;
    $('motionEnabled').checked=region.enabled!==false;
    $('motionTypeSelect').value=region.motion?.type||'sway';
    $('motionStrength').value=region.motion?.amplitude??.25;
    $('motionSpeed').value=region.motion?.speed??.4;
    $('motionStrengthValue').textContent=`${Math.round((region.motion?.amplitude??.25)*100)}%`;
    $('motionSpeedValue').textContent=`${Math.round((region.motion?.speed??.4)*100)}%`;
  }
  canvas.classList.toggle('selecting-region',state.selectingRegion);
  $('selectRegionBtn').textContent=state.selectingRegion?'選択をやめる':'＋ 範囲を選ぶ';
  $('selectionNotice').hidden=!state.selectingRegion;
}

function syncControls(){
  const s=currentScene(); if(!s) return;
  $('sceneName').value=s.name||'';$('narrationText').value=s.narration||'';$('durationInput').value=s.duration;$('cameraSelect').value=s.camera||'none';$('textLock').checked=!!s.textLock;$('effectStrength').value=s.effectStrength??.55;
  [...document.querySelectorAll('[data-effect]')].forEach(el=>el.checked=(s.effects||[]).includes(el.dataset.effect));
  $('narrationAudioName').textContent=s.runtime?.narrationFile?.name||'未設定';$('ambientAudioName').textContent=s.runtime?.ambientFile?.name||'未設定';$('bgmAudioName').textContent=state.bgmFile?.name||'未設定';$('bgmVolume').value=state.project.bgmVolume??.35;
  $('sceneStatus').textContent=`${state.selected+1} / ${state.project.scenes.length}  ${s.name}`;$('timeLabel').textContent=`0.0 / ${s.duration.toFixed(1)} 秒`;$('scrubber').value=0;
  syncMotionControls(s);
}

function setupEffectsUI(){const root=$('effectChecks');for(const [key,label] of EFFECTS){const lab=document.createElement('label');lab.className='effect-chip';const cb=document.createElement('input');cb.type='checkbox';cb.dataset.effect=key;cb.onchange=()=>{const s=currentScene();s.effects=[...document.querySelectorAll('[data-effect]:checked')].map(x=>x.dataset.effect);renderSceneList();renderFrame(s,+$('scrubber').value/1000)};lab.append(cb,document.createTextNode(label));root.append(lab)}}

function inferEffects(text){
  text=text||'';const out=[];
  if(/雨|ざあ|傘|じめじめ/.test(text))out.push('rain');
  if(/風|びゅう|飛|とんで/.test(text))out.push('wind','leaves');
  if(/森|こえだ|草/.test(text)&&!out.includes('leaves'))out.push('leaves');
  if(/晴|いい おてんき|あさ|朝|公園|こうえん/.test(text))out.push('glow');
  if(/花|おはな|楽|たのしい/.test(text))out.push('sparkles');
  if(/蝶|ちょう/.test(text))out.push('butterflies');
  return [...new Set(out)].slice(0,3);
}

function canvasPoint(event){
  const rect=canvas.getBoundingClientRect();
  return {
    x:(event.clientX-rect.left)*canvas.width/rect.width,
    y:(event.clientY-rect.top)*canvas.height/rect.height
  };
}

async function beginRegionSelection(event){
  if(!state.selectingRegion||state.selectionSession)return;
  if(event.pointerType==='mouse'&&event.button!==0)return;
  event.preventDefault();
  const scene=currentScene();
  try{
    const img=await loadImage(scene.imageObjectUrl||scene.image);
    if(!state.selectingRegion)return;
    if(!img)throw new Error('image missing');
    const t=+$('scrubber').value/1000;
    const placement=coverPlacement(img,canvas.width,canvas.height,scene,t);
    const imageSize={width:img.naturalWidth,height:img.naturalHeight};
    const start=canvasPointToSource(canvasPoint(event),placement,imageSize);
    state.selectionSession={pointerId:event.pointerId,sceneId:scene.id,start,placement,imageSize};
    state.selectionDraft={x:start.x,y:start.y,width:0,height:0};
    canvas.setPointerCapture?.(event.pointerId);
    await renderFrame(scene,t);
  }catch{
    alert('画像を読み込めないため、範囲を選択できません。');
    setSelectionMode(false);
  }
}

function updateRegionSelection(event){
  const session=state.selectionSession;
  if(!session||session.pointerId!==event.pointerId||session.sceneId!==currentScene()?.id)return;
  event.preventDefault();
  const point=canvasPointToSource(canvasPoint(event),session.placement,session.imageSize);
  state.selectionDraft=rectFromPoints(session.start,point);
  renderFrame(currentScene(),+$('scrubber').value/1000);
}

function finishRegionSelection(event){
  const session=state.selectionSession;
  if(!session||session.pointerId!==event.pointerId)return;
  updateRegionSelection(event);
  const rect=state.selectionDraft;
  state.selectionSession=null;
  if(!rect||rect.width<8||rect.height<8){
    state.selectionDraft=null;
    $('selectionNotice').textContent='範囲が小さすぎます。画像の上を、もう少し大きくドラッグしてください。';
    renderFrame(currentScene(),+$('scrubber').value/1000);
    return;
  }
  const scene=currentScene();
  const index=(scene.motionRegions||[]).length;
  const region=normalizeMotionRegion({
    id:crypto.randomUUID(),
    name:`動かす範囲 ${index+1}`,
    enabled:true,
    zIndex:index,
    mask:{
      kind:'rectangle',
      width:session.imageSize.width,
      height:session.imageSize.height,
      rect,
      feather:6,
      invert:false
    },
    motion:{type:'sway',amplitude:.25,speed:.4,phase:0,axis:'x',pivot:{x:.5,y:1}}
  },index);
  scene.motionRegions ||= [];
  scene.motionRegions.push(region);
  state.selectedMotionRegionId=region.id;
  setSelectionMode(false);
  syncMotionControls(scene);
  renderFrame(scene,+$('scrubber').value/1000);
}

function removeCurrentMotionRegion(){
  const scene=currentScene();
  const index=(scene.motionRegions||[]).findIndex(region=>region.id===state.selectedMotionRegionId);
  if(index<0)return;
  scene.motionRegions.splice(index,1);
  state.selectedMotionRegionId=scene.motionRegions[Math.min(index,scene.motionRegions.length-1)]?.id||null;
  syncMotionControls(scene);
  renderFrame(scene,+$('scrubber').value/1000);
}

function updateMotionControl(mutator){
  const region=currentMotionRegion();if(!region)return;
  mutator(region);
  renderFrame(currentScene(),+$('scrubber').value/1000);
}

function bindControls(){
  $('sceneName').oninput=e=>{currentScene().name=e.target.value;renderSceneList()};
  $('narrationText').oninput=e=>{currentScene().narration=e.target.value};
  $('durationInput').oninput=e=>{currentScene().duration=Math.max(1,+e.target.value||1);renderSceneList()};
  $('cameraSelect').onchange=e=>{currentScene().camera=e.target.value;renderFrame(currentScene(),+$('scrubber').value/1000)};
  $('textLock').onchange=e=>{currentScene().textLock=e.target.checked;renderFrame(currentScene(),+$('scrubber').value/1000)};
  $('effectStrength').oninput=e=>{currentScene().effectStrength=+e.target.value;renderFrame(currentScene(),+$('scrubber').value/1000)};
  $('autoDurationBtn').onclick=()=>{const s=currentScene();s.duration=estimateDuration(s.narration);$('durationInput').value=s.duration;renderSceneList()};
  $('autoEffectBtn').onclick=()=>{const s=currentScene();s.effects=inferEffects(s.narration);syncControls();renderSceneList();renderFrame(s,0)};
  $('selectRegionBtn').onclick=()=>{
    $('selectionNotice').textContent='プレビュー画像の上をドラッグしてください。もう一度ボタンを押すと中止します。';
    setSelectionMode(!state.selectingRegion);
  };
  $('motionRegionSelect').onchange=e=>{state.selectedMotionRegionId=e.target.value;syncMotionControls(currentScene());renderFrame(currentScene(),+$('scrubber').value/1000)};
  $('motionEnabled').onchange=e=>updateMotionControl(region=>region.enabled=e.target.checked);
  $('motionTypeSelect').onchange=e=>updateMotionControl(region=>{region.motion.type=e.target.value;region.motion.pivot=e.target.value==='sway'?{x:.5,y:1}:{x:.5,y:.5}});
  $('motionStrength').oninput=e=>{const value=+e.target.value;$('motionStrengthValue').textContent=`${Math.round(value*100)}%`;updateMotionControl(region=>region.motion.amplitude=value)};
  $('motionSpeed').oninput=e=>{const value=+e.target.value;$('motionSpeedValue').textContent=`${Math.round(value*100)}%`;updateMotionControl(region=>region.motion.speed=value)};
  $('previewMotionBtn').onclick=previewCurrentMotion;
  $('removeRegionBtn').onclick=removeCurrentMotionRegion;
  canvas.addEventListener('pointerdown',beginRegionSelection);
  canvas.addEventListener('pointermove',updateRegionSelection);
  canvas.addEventListener('pointerup',finishRegionSelection);
  canvas.addEventListener('pointercancel',()=>{state.selectionSession=null;state.selectionDraft=null;renderFrame(currentScene(),+$('scrubber').value/1000)});
  $('scrubber').oninput=e=>{const v=+e.target.value/1000;renderFrame(currentScene(),v);$('timeLabel').textContent=`${(v*currentScene().duration).toFixed(1)} / ${currentScene().duration.toFixed(1)} 秒`};
  $('prevBtn').onclick=()=>selectScene(state.selected-1);$('nextBtn').onclick=()=>selectScene(state.selected+1);
  $('playSceneBtn').onclick=()=>playScenes([state.selected]);$('playAllBtn').onclick=()=>playScenes([...state.project.scenes.keys()]);
  $('speakBtn').onclick=()=>speakCurrent();
  $('narrationAudio').onchange=e=>{ensureRuntime(currentScene()).narrationFile=e.target.files[0]||null;syncControls()};
  $('ambientAudio').onchange=e=>{ensureRuntime(currentScene()).ambientFile=e.target.files[0]||null;syncControls()};
  $('bgmAudio').onchange=e=>{state.bgmFile=e.target.files[0]||null;syncControls()};
  $('bgmVolume').oninput=e=>state.project.bgmVolume=+e.target.value;
  $('resolutionSelect').onchange=e=>setResolution(e.target.value);
  $('removeSceneBtn').onclick=removeCurrentScene;$('addSceneBtn').onclick=addBlankScene;
  $('importImagesBtn').onclick=()=>$('imageInput').click();$('imageInput').onchange=e=>addImages([...e.target.files]);
  $('saveProjectBtn').onclick=saveProjectJson;$('importProjectBtn').onclick=()=>$('projectInput').click();$('projectInput').onchange=e=>loadProjectJson(e.target.files[0]);
  $('exportBtn').onclick=exportWebM;
}
function ensureRuntime(s){if(!s.runtime)s.runtime={narrationFile:null,ambientFile:null};return s.runtime}
function setResolution(v){const [w,h]=v.split('x').map(Number);state.project.width=w;state.project.height=h;canvas.width=w;canvas.height=h;renderFrame(currentScene(),+$('scrubber').value/1000)}
function addBlankScene(){state.project.scenes.push({id:crypto.randomUUID(),name:`シーン${state.project.scenes.length+1}`,image:'',imageObjectUrl:null,narration:'',duration:5,camera:'none',textLock:true,effects:[],effectStrength:.55,motionRegions:[],runtime:{narrationFile:null,ambientFile:null}});selectScene(state.project.scenes.length-1)}
function removeCurrentScene(){if(state.project.scenes.length<=1)return;state.project.scenes.splice(state.selected,1);state.selected=Math.min(state.selected,state.project.scenes.length-1);selectScene(state.selected)}
function addImages(files){for(const f of files){const url=URL.createObjectURL(f);state.project.scenes.push({id:crypto.randomUUID(),name:f.name.replace(/\.[^.]+$/,''),image:'',imageObjectUrl:url,narration:'',duration:5,camera:'none',textLock:true,effects:[],effectStrength:.55,motionRegions:[],runtime:{narrationFile:null,ambientFile:null}})}selectScene(state.project.scenes.length-files.length)}

function stopPlayback(){state.playToken++;state.playing=false;for(const a of state.audioPreview){try{a.pause()}catch{}}state.audioPreview=[]}
async function previewCurrentMotion(){
  if(!currentMotionRegion())return;
  stopPlayback();const token=state.playToken;state.playing=true;
  const scene=currentScene(),previewSeconds=Math.min(3.5,scene.duration),started=performance.now();
  while(token===state.playToken){
    const elapsed=(performance.now()-started)/1000;
    const sceneTime=Math.min(elapsed,previewSeconds);
    const norm=sceneTime/scene.duration;
    await renderFrame(scene,norm);
    $('scrubber').value=norm*1000;
    $('timeLabel').textContent=`${sceneTime.toFixed(1)} / ${scene.duration.toFixed(1)} 秒`;
    if(elapsed>=previewSeconds)break;
    await sleep(1000/30);
  }
  if(token!==state.playToken)return;
  state.playing=false;
  renderFrame(scene,previewSeconds/scene.duration);
}
async function playScenes(indices){stopPlayback();const token=state.playToken;state.playing=true;let bgm=null;if(state.bgmFile){bgm=new Audio(URL.createObjectURL(state.bgmFile));bgm.loop=true;bgm.volume=state.project.bgmVolume;bgm.play().catch(()=>{});state.audioPreview.push(bgm)}
  for(const idx of indices){if(token!==state.playToken)return;state.selected=idx;renderSceneList();syncControls();const s=currentScene();const started=performance.now();playSceneAudioPreview(s,bgm);while(token===state.playToken){const elapsed=(performance.now()-started)/1000;const n=Math.min(1,elapsed/s.duration);await renderFrame(s,n);$('scrubber').value=n*1000;$('timeLabel').textContent=`${Math.min(elapsed,s.duration).toFixed(1)} / ${s.duration.toFixed(1)} 秒`;if(n>=1)break;await sleep(1000/30)}}
  if(bgm)bgm.pause();state.playing=false;renderFrame(currentScene(),1);
}
function playSceneAudioPreview(s,bgm){
  const files=[s.runtime?.narrationFile,s.runtime?.ambientFile].filter(Boolean);if(bgm)bgm.volume=s.runtime?.narrationFile?state.project.bgmVolume*.42:state.project.bgmVolume;
  for(const f of files){const a=new Audio(URL.createObjectURL(f));a.volume=f===s.runtime?.narrationFile?1:.55;a.play().catch(()=>{});state.audioPreview.push(a)}
  if(!s.runtime?.ambientFile && (s.effects||[]).includes('rain')) startWebAudioAmbient('rain',s.duration);
  if(!s.runtime?.ambientFile && (s.effects||[]).includes('wind')) startWebAudioAmbient('wind',Math.min(s.duration,3.5));
}
function speakCurrent(){if(!('speechSynthesis'in window))return alert('このブラウザは音声読み上げに対応していません');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(currentScene().narration);u.lang='ja-JP';u.rate=.92;speechSynthesis.speak(u)}
let previewAudioCtx=null;
function startWebAudioAmbient(kind,duration){try{previewAudioCtx ||= new AudioContext();const c=previewAudioCtx;const b=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const src=c.createBufferSource();src.buffer=b;src.loop=true;const filter=c.createBiquadFilter(),gain=c.createGain();if(kind==='rain'){filter.type='highpass';filter.frequency.value=1800;gain.gain.value=.04}else{filter.type='lowpass';filter.frequency.value=500;gain.gain.value=.06}src.connect(filter).connect(gain).connect(c.destination);src.start();src.stop(c.currentTime+duration)}catch{}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function serializableProject(){return {...state.project,scenes:state.project.scenes.map(({runtime,imageObjectUrl,...s})=>({...s,imageObjectUrl:null}))}}
function saveProjectJson(){const blob=new Blob([JSON.stringify(serializableProject(),null,2)],{type:'application/json'});downloadBlob(blob,'stillmotion-project.json')}
async function loadProjectJson(file){if(!file)return;try{const p=JSON.parse(await file.text());if(!Array.isArray(p.scenes))throw new Error('scenes がありません');p.formatVersion=Number.isFinite(+p.formatVersion)?+p.formatVersion:1;p.scenes=p.scenes.map(s=>normalizeSceneMotion({...s,id:s.id||crypto.randomUUID(),runtime:{narrationFile:null,ambientFile:null},imageObjectUrl:null}));state.project={...state.project,...p};state.selected=0;state.selectedMotionRegionId=null;setResolution(`${state.project.width||720}x${state.project.height||960}`);renderSceneList();syncControls();renderFrame(currentScene(),0)}catch(e){alert('JSONを読み込めませんでした: '+e.message)}}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}

async function decodeFile(ctx,file){if(!file)return null;return ctx.decodeAudioData(await file.arrayBuffer())}
function makeNoiseBuffer(ctx){const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
async function exportWebM(){
  if(!window.MediaRecorder||!canvas.captureStream)return alert('このブラウザでは動画書き出しを使えません。Chrome / Edgeを使ってください。');
  stopPlayback();state.exporting=true;$('exportBtn').disabled=true;$('exportStatus').textContent='準備中…';$('exportProgress').value=0;await renderFrame(currentScene(),0);
  const audioCtx=new AudioContext();const mix=audioCtx.createMediaStreamDestination();const master=audioCtx.createGain();master.gain.value=.92;master.connect(mix);
  const videoStream=canvas.captureStream(state.project.fps||30);const tracks=[...videoStream.getVideoTracks(),...mix.stream.getAudioTracks()];const stream=new MediaStream(tracks);
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(MediaRecorder.isTypeSupported)||'';const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:6_000_000}:undefined);const chunks=[];rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);const stopped=new Promise(r=>rec.onstop=r);rec.start(1000);
  let bgmSrc=null,bgmGain=null;
  if(state.bgmFile){try{const buf=await decodeFile(audioCtx,state.bgmFile);bgmSrc=audioCtx.createBufferSource();bgmSrc.buffer=buf;bgmSrc.loop=true;bgmGain=audioCtx.createGain();bgmGain.gain.value=state.project.bgmVolume;bgmSrc.connect(bgmGain).connect(master);bgmSrc.start()}catch(e){console.warn(e)}}
  const total=state.project.scenes.reduce((a,s)=>a+s.duration,0);let done=0;
  for(let i=0;i<state.project.scenes.length;i++){
    const s=state.project.scenes[i];state.selected=i;renderSceneList();syncControls();
    const local=[];
    try{
      if(s.runtime?.narrationFile){const b=await decodeFile(audioCtx,s.runtime.narrationFile);const src=audioCtx.createBufferSource(),g=audioCtx.createGain();src.buffer=b;g.gain.value=1;src.connect(g).connect(master);src.start();local.push(src);if(bgmGain)bgmGain.gain.setTargetAtTime(state.project.bgmVolume*.38,audioCtx.currentTime,.08)} else if(bgmGain)bgmGain.gain.setTargetAtTime(state.project.bgmVolume,audioCtx.currentTime,.08);
      if(s.runtime?.ambientFile){const b=await decodeFile(audioCtx,s.runtime.ambientFile);const src=audioCtx.createBufferSource(),g=audioCtx.createGain();src.buffer=b;g.gain.value=.5;src.connect(g).connect(master);src.start();local.push(src)} else {
        for(const kind of ['rain','wind']) if((s.effects||[]).includes(kind)){const src=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();src.buffer=makeNoiseBuffer(audioCtx);src.loop=true;if(kind==='rain'){f.type='highpass';f.frequency.value=1700;g.gain.value=.035}else{f.type='lowpass';f.frequency.value=450;g.gain.value=.045}src.connect(f).connect(g).connect(master);src.start();local.push(src)}
      }
    }catch(e){console.warn('audio',e)}
    const start=performance.now();while(true){const elapsed=(performance.now()-start)/1000;const n=Math.min(1,elapsed/s.duration);await renderFrame(s,n);const all=done+Math.min(elapsed,s.duration);$('exportProgress').value=all/total;$('exportStatus').textContent=`書き出し中 ${Math.round(all/total*100)}% — ${i+1}/${state.project.scenes.length}`;if(n>=1)break;await sleep(1000/(state.project.fps||30))}
    done+=s.duration;for(const src of local){try{src.stop()}catch{}}
  }
  if(bgmSrc)try{bgmSrc.stop()}catch{};rec.stop();await stopped;await audioCtx.close();const blob=new Blob(chunks,{type:mime||'video/webm'});downloadBlob(blob,`${state.project.title||'stillmotion'}.webm`);state.exporting=false;$('exportStatus').textContent='完了。WebMを保存しました。';$('exportProgress').value=1;$('exportBtn').disabled=false;renderFrame(currentScene(),1);
}

function init(){setupEffectsUI();bindControls();setResolution('720x960');renderSceneList();syncControls();renderFrame(currentScene(),0)}
init();
