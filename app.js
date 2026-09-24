import {
  calculateImagePlacement,
  canvasPointToSource,
  evaluateMotion,
  normalizeMotionRegion,
  normalizeSceneMotion,
  polygonBounds,
  rectFromPoints,
  sourceRectToCanvas
} from './src/v0.2/partial-motion.mjs';
import {
  durationForNarration,
  normalizeEffectSettings
} from './src/v0.2/editor-settings.mjs';
import { readWorkZip, writeWorkZip } from './src/v0.2/work-archive.mjs';

const EFFECTS = [
  ['rain','雨'], ['wind','風'], ['leaves','葉っぱ'], ['glow','木漏れ日'],
  ['butterflies','蝶'], ['sparkles','光の粒'], ['snow','雪'], ['dust','ほこり']
];
const EFFECT_KEYS = EFFECTS.map(([key]) => key);
const CAMERA_HELP = {
  none:'画像全体は固定します。選択した部分や雨・光などの効果だけが動きます。',
  'zoom-in':'ページの最初から最後に向かって、画像全体を少しずつ拡大します。',
  'zoom-out':'ページの最初から最後に向かって、画像全体を少しずつ縮小します。',
  'pan-left':'ページの間に、画像全体を右側から左側へゆっくり動かします。',
  'pan-right':'ページの間に、画像全体を左側から右側へゆっくり動かします。',
  float:'画像全体を上下左右へごく小さく漂わせます。'
};
const MOTION_HELP = {
  sway:'左右なら傾く動き、上下なら上下運動、斜めなら両方を組み合わせます。木、髪、しっぽ向けです。',
  drift:'選んだ部分の位置そのものが、選んだ方向へゆっくり往復します。雲、霧、小物向けです。',
  ripple:'横に広がりながら縦に縮む動きを繰り返します。水面や布向けです。',
  flicker:'大きさと透明度が細かく変わります。炎、照明、光向けです。',
  breathe:'縦方向を中心に、ゆっくり膨らんだり縮んだりします。胸や胴体向けです。'
};

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
      followNarrationDuration: true,
      narrationDuration: null,
      narrationVolume: 1,
      ambientVolume: 0.55,
      ambientDuration: estimateDuration(text),
      imageFit: 'cover',
      camera: 'none',
      textLock: true,
      effects: SAMPLE_EFFECTS[i],
      effectStrength: i === 15 || i === 16 ? 0.9 : 0.55,
      effectSettings: {},
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
  maskCache: new Map(),
  playing: false,
  playToken: 0,
  bgmFile: null,
  audioPreview: [],
  generatedAmbient: [],
  selectedMotionRegionId: null,
  selectedEffectKey: null,
  maskPreview: false,
  selectingRegion: false,
  selectionKind: 'rectangle',
  selectionSession: null,
  selectionDraft: null,
  history: [],
  future: [],
  historyTimer: null,
  restoringHistory: false,
  voiceRecorder: null,
  voiceStream: null,
  voiceChunks: [],
  recordingSceneId: null,
  voiceMessage: '',
  exporting: false
};

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');

function currentScene(){ return state.project.scenes[state.selected]; }
function currentMotionRegion(){
  return (currentScene()?.motionRegions || []).find(region => region.id === state.selectedMotionRegionId) || null;
}

function ensureEffectSettings(scene){
  scene.effectSettings=normalizeEffectSettings(scene,EFFECT_KEYS);
  return scene.effectSettings;
}

function effectSetting(scene,key){
  return ensureEffectSettings(scene)[key]||{strength:.55,speed:.5};
}

function captureHistorySnapshot(){
  return {
    data:JSON.stringify({project:serializableProject(),selected:state.selected,selectedMotionRegionId:state.selectedMotionRegionId}),
    media:new Map(state.project.scenes.map(scene=>[scene.id,{runtime:scene.runtime,imageObjectUrl:scene.imageObjectUrl}]))
  };
}

function syncHistoryButtons(){
  $('undoBtn').disabled=state.history.length<=1;
  $('redoBtn').disabled=!state.future.length;
}

function commitHistory(){
  if(state.restoringHistory)return;
  clearTimeout(state.historyTimer);state.historyTimer=null;
  const snapshot=captureHistorySnapshot();
  if(state.history.at(-1)?.data===snapshot.data)return syncHistoryButtons();
  state.history.push(snapshot);
  if(state.history.length>50)state.history.shift();
  state.future=[];
  syncHistoryButtons();
}

function queueHistoryCommit(){
  clearTimeout(state.historyTimer);
  state.historyTimer=setTimeout(commitHistory,320);
}

function resetHistory(){
  clearTimeout(state.historyTimer);state.historyTimer=null;
  state.history=[captureHistorySnapshot()];state.future=[];syncHistoryButtons();
}

function restoreHistorySnapshot(snapshot){
  const parsed=JSON.parse(snapshot.data);
  state.restoringHistory=true;
  state.project=parsed.project;
  state.project.scenes=state.project.scenes.map(scene=>{
    const media=snapshot.media.get(scene.id);
    return normalizeSceneMotion({...scene,imageObjectUrl:media?.imageObjectUrl||null,runtime:media?.runtime||{narrationFile:null,ambientFile:null}});
  });
  state.selected=Math.max(0,Math.min(parsed.selected,state.project.scenes.length-1));
  state.selectedMotionRegionId=parsed.selectedMotionRegionId;
  state.maskCache.clear();
  setSelectionMode(false);
  setResolution(`${state.project.width||720}x${state.project.height||960}`);
  renderSceneList();syncControls();renderFrame(currentScene(),0);
  state.restoringHistory=false;
  syncHistoryButtons();
}

function undo(){
  if(state.historyTimer)commitHistory();
  if(state.history.length<=1)return;
  state.future.push(state.history.pop());
  restoreHistorySnapshot(state.history.at(-1));
}

function redo(){
  if(state.historyTimer)commitHistory();
  const snapshot=state.future.pop();if(!snapshot)return;
  state.history.push(snapshot);restoreHistorySnapshot(snapshot);
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
    dust: Array.from({length:90},()=>({x:r(),y:r(),size:.002+r()*.005,phase:r()*6.28,alpha:.28+r()*.42})),
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
  let base = calculateImagePlacement(
    {width:sw,height:sh},
    {width:w,height:h},
    scene.imageFit
  ).scale;
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
    if(scene.camera==='pan-left') dx = (.5-t)*w*.055;
    if(scene.camera==='pan-right') dx = (t-.5)*w*.055;
    if(scene.camera==='float'){dx=Math.sin(t*Math.PI*2)*w*.008;dy=Math.cos(t*Math.PI*2)*h*.006}
  }
  return {x:x+dx,y:y+dy,width:dw,height:dh,scale};
}

function drawContainedBackdrop(img,w,h){
  const backdrop=calculateImagePlacement(
    {width:img.naturalWidth,height:img.naturalHeight},
    {width:w,height:h},
    'cover'
  );
  ctx.save();
  ctx.filter='blur(24px) brightness(0.68) saturate(0.82)';
  const bleed=1.08;
  const width=backdrop.width*bleed,height=backdrop.height*bleed;
  ctx.drawImage(img,(w-width)/2,(h-height)/2,width,height);
  ctx.restore();
  ctx.fillStyle='rgba(8,18,24,.16)';
  ctx.fillRect(0,0,w,h);
}

function drawCover(img,w,h,scene,t){
  if(scene.imageFit==='contain')drawContainedBackdrop(img,w,h);
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

function regionSourceGeometry(region,img){
  const fx=img.naturalWidth/Math.max(1,region.mask.width);
  const fy=img.naturalHeight/Math.max(1,region.mask.height);
  let bounds=null,points=null,rect=null;
  if(region.mask.kind==='rectangle'){
    rect=regionSourceRect(region,img);
    bounds=rect;
  }else if(region.mask.kind==='polygon'&&region.mask.points.length>=3){
    points=region.mask.points.map(point=>({x:point.x*fx,y:point.y*fy}));
    bounds=polygonBounds(points);
  }
  if(!bounds)return null;
  const strokes=(region.mask.strokes||[]).map(stroke=>({
    mode:stroke.mode,
    size:stroke.size*(fx+fy)/2,
    points:stroke.points.map(point=>({x:point.x*fx,y:point.y*fy}))
  }));
  for(const stroke of strokes){
    if(stroke.mode!=='add')continue;
    const radius=stroke.size/2;
    for(const point of stroke.points){
      const left=Math.max(0,point.x-radius),top=Math.max(0,point.y-radius);
      const right=Math.min(img.naturalWidth,point.x+radius),bottom=Math.min(img.naturalHeight,point.y+radius);
      const x=Math.min(bounds.x,left),y=Math.min(bounds.y,top);
      bounds={x,y,width:Math.max(bounds.x+bounds.width,right)-x,height:Math.max(bounds.y+bounds.height,bottom)-y};
    }
  }
  return {bounds,points,rect,strokes,scale:(fx+fy)/2};
}

function traceCanvasPolygon(points,placement){
  if(!points?.length)return;
  ctx.moveTo(placement.x+points[0].x*placement.scale,placement.y+points[0].y*placement.scale);
  for(let i=1;i<points.length;i++){
    ctx.lineTo(placement.x+points[i].x*placement.scale,placement.y+points[i].y*placement.scale);
  }
  ctx.closePath();
}

function traceStroke(context,stroke,offsetX=0,offsetY=0){
  if(!stroke.points.length)return;
  context.beginPath();
  const first=stroke.points[0];
  if(stroke.points.length===1){
    context.arc(first.x-offsetX,first.y-offsetY,stroke.size/2,0,Math.PI*2);
    context.fill();
    return;
  }
  context.moveTo(first.x-offsetX,first.y-offsetY);
  for(let i=1;i<stroke.points.length;i++)context.lineTo(stroke.points[i].x-offsetX,stroke.points[i].y-offsetY);
  context.stroke();
}

function maskedRegionLayer(img,region){
  const geometry=regionSourceGeometry(region,img);if(!geometry)return null;
  const feather=(region.mask.feather||0)*geometry.scale;
  const x=Math.max(0,Math.floor(geometry.bounds.x-feather*2));
  const y=Math.max(0,Math.floor(geometry.bounds.y-feather*2));
  const right=Math.min(img.naturalWidth,Math.ceil(geometry.bounds.x+geometry.bounds.width+feather*2));
  const bottom=Math.min(img.naturalHeight,Math.ceil(geometry.bounds.y+geometry.bounds.height+feather*2));
  const bounds={x,y,width:Math.max(1,right-x),height:Math.max(1,bottom-y)};
  const signature=`${img.currentSrc||img.src}|${img.naturalWidth}x${img.naturalHeight}|${JSON.stringify(region.mask)}`;
  const cached=state.maskCache.get(region.id);
  if(cached?.signature===signature)return cached.value;

  const mask=document.createElement('canvas');mask.width=Math.ceil(bounds.width);mask.height=Math.ceil(bounds.height);
  const mctx=mask.getContext('2d');mctx.fillStyle='#fff';mctx.strokeStyle='#fff';mctx.lineCap='round';mctx.lineJoin='round';
  if(geometry.points){
    mctx.beginPath();mctx.moveTo(geometry.points[0].x-x,geometry.points[0].y-y);
    for(let i=1;i<geometry.points.length;i++)mctx.lineTo(geometry.points[i].x-x,geometry.points[i].y-y);
    mctx.closePath();mctx.fill();
  }else if(geometry.rect){
    mctx.fillRect(geometry.rect.x-x,geometry.rect.y-y,geometry.rect.width,geometry.rect.height);
  }
  for(const stroke of geometry.strokes){
    mctx.globalCompositeOperation=stroke.mode==='erase'?'destination-out':'source-over';
    mctx.lineWidth=stroke.size;mctx.fillStyle='#fff';mctx.strokeStyle='#fff';traceStroke(mctx,stroke,x,y);
  }
  mctx.globalCompositeOperation='source-over';
  let finalMask=mask;
  if(feather>0){
    const softened=document.createElement('canvas');softened.width=mask.width;softened.height=mask.height;
    const sctx=softened.getContext('2d');sctx.filter=`blur(${Math.max(1,feather)}px)`;sctx.drawImage(mask,0,0);sctx.filter='none';sctx.drawImage(mask,0,0);finalMask=softened;
  }
  const layer=document.createElement('canvas');layer.width=mask.width;layer.height=mask.height;
  const lctx=layer.getContext('2d');lctx.drawImage(img,bounds.x,bounds.y,bounds.width,bounds.height,0,0,layer.width,layer.height);lctx.globalCompositeOperation='destination-in';lctx.drawImage(finalMask,0,0);
  const rawBackground=document.createElement('canvas');rawBackground.width=mask.width;rawBackground.height=mask.height;
  const rctx=rawBackground.getContext('2d');
  const strip=Math.max(4,Math.min(48,Math.round(Math.min(bounds.width,bounds.height)*.12)));
  const samples=[];
  if(bounds.x>0)samples.push({sx:Math.max(0,bounds.x-strip),sy:bounds.y,sw:Math.min(strip,bounds.x),sh:bounds.height});
  if(bounds.x+bounds.width<img.naturalWidth)samples.push({sx:bounds.x+bounds.width,sy:bounds.y,sw:Math.min(strip,img.naturalWidth-bounds.x-bounds.width),sh:bounds.height});
  if(bounds.y>0)samples.push({sx:bounds.x,sy:Math.max(0,bounds.y-strip),sw:bounds.width,sh:Math.min(strip,bounds.y)});
  if(bounds.y+bounds.height<img.naturalHeight)samples.push({sx:bounds.x,sy:bounds.y+bounds.height,sw:bounds.width,sh:Math.min(strip,img.naturalHeight-bounds.y-bounds.height)});
  samples.forEach((sample,index)=>{rctx.globalAlpha=index?Math.max(.25,.62/index):1;rctx.drawImage(img,sample.sx,sample.sy,Math.max(1,sample.sw),Math.max(1,sample.sh),0,0,rawBackground.width,rawBackground.height)});
  if(!samples.length)rctx.drawImage(img,bounds.x,bounds.y,bounds.width,bounds.height,0,0,rawBackground.width,rawBackground.height);
  const background=document.createElement('canvas');background.width=mask.width;background.height=mask.height;
  const bctx=background.getContext('2d');bctx.filter=`blur(${Math.max(10,Math.min(36,strip*.7))}px)`;bctx.drawImage(rawBackground,0,0);bctx.filter='none';bctx.globalCompositeOperation='destination-in';bctx.drawImage(finalMask,0,0);
  const value={canvas:layer,mask:finalMask,background,bounds,geometry};state.maskCache.set(region.id,{signature,value});return value;
}

function drawBackgroundFills(img,scene,placement){
  for(const rawRegion of scene.motionRegions||[]){
    const region=normalizeMotionRegion(rawRegion);if(!region.enabled||!region.backgroundFill)continue;
    const masked=maskedRegionLayer(img,region);if(!masked)continue;
    const dest=sourceRectToCanvas(masked.bounds,placement);
    ctx.drawImage(masked.background,dest.x,dest.y,dest.width,dest.height);
  }
}

function drawMaskPreview(img,placement){
  ctx.fillStyle='#05070a';ctx.fillRect(0,0,canvas.width,canvas.height);
  const raw=currentMotionRegion();if(!raw)return;
  const masked=maskedRegionLayer(img,normalizeMotionRegion(raw));if(!masked)return;
  const dest=sourceRectToCanvas(masked.bounds,placement);
  ctx.drawImage(masked.mask,dest.x,dest.y,dest.width,dest.height);
}

function drawPartialMotions(img,scene,placement,elapsedSeconds){
  for(const rawRegion of scene.motionRegions||[]){
    const region=normalizeMotionRegion(rawRegion);
    if(!region.enabled)continue;
    const masked=maskedRegionLayer(img,region);
    if(!masked||masked.bounds.width<1||masked.bounds.height<1)continue;
    const source=masked.bounds;
    const dest=sourceRectToCanvas(source,placement);
    const motion=evaluateMotion(region,elapsedSeconds);
    const pivotX=dest.x+dest.width*region.motion.pivot.x;
    const pivotY=dest.y+dest.height*region.motion.pivot.y;

    ctx.save();
    ctx.globalAlpha*=motion.opacity;
    ctx.translate(
      pivotX+motion.translateX*dest.width,
      pivotY+motion.translateY*dest.height
    );
    ctx.rotate(motion.rotation*Math.PI/180);
    ctx.scale(motion.scaleX,motion.scaleY);
    ctx.drawImage(
      masked.canvas,
      -dest.width*region.motion.pivot.x,
      -dest.height*region.motion.pivot.y,
      dest.width,dest.height
    );
    ctx.restore();
  }
}

function drawEffects(scene,t,w,h){
  const P=particleSet(scene);
  for(const effect of scene.effects || []){
    const setting=effectSetting(scene,effect),str=setting.strength;
    if(str<=0)continue;
    const et=t*(.25+setting.speed*1.75);
    ctx.save();
    if(effect==='rain'){
      ctx.strokeStyle=`rgba(205,230,255,${.35+.35*str})`; ctx.lineWidth=Math.max(1,w/520);
      for(const d of P.rain){
        const y=((d.y+et*d.speed*2)%1)*h, x=((d.x+et*.04)%1)*w;
        ctx.globalAlpha=d.alpha*str; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-w*.008,y+d.len*h);ctx.stroke();
      }
      ctx.globalAlpha=.08*str; ctx.fillStyle='#6da7d9';ctx.fillRect(0,0,w,h);
    }
    if(effect==='wind'){
      ctx.strokeStyle=`rgba(255,255,255,${.22+.35*str})`; ctx.lineWidth=Math.max(1,w/500);
      for(let i=0;i<10;i++){
        const yy=((i*.103+et*.35)%1)*h; const xx=((et*.9+i*.17)%1)*w-w*.25;
        ctx.beginPath();ctx.moveTo(xx,yy);ctx.bezierCurveTo(xx+w*.08,yy-h*.018,xx+w*.17,yy+h*.018,xx+w*.25,yy);ctx.stroke();
      }
    }
    if(effect==='leaves'){
      for(const d of P.leaves){
        const yy=((d.y+et*d.speed*3)%1)*h; const xx=((d.x+et*d.drift+Math.sin(et*5+d.phase)*.02)%1)*w;
        ctx.save();ctx.translate(xx,yy);ctx.rotate(d.rot+et*2);ctx.globalAlpha=.45+.45*str;ctx.fillStyle=iColor(d.phase);
        ctx.beginPath();ctx.ellipse(0,0,d.size*w,d.size*w*.45,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
    if(effect==='glow'){
      const pulse=.78+.22*Math.sin(et*Math.PI*2);
      const a=(.13+.13*str)*pulse;
      ctx.globalCompositeOperation='screen';
      const g=ctx.createRadialGradient(w*.72,h*.12,0,w*.72,h*.12,w*.78);g.addColorStop(0,`rgba(255,248,188,${a*1.8})`);g.addColorStop(.42,`rgba(255,225,126,${a*.65})`);g.addColorStop(1,'rgba(255,244,183,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      ctx.save();ctx.translate(w*.72,h*.08);ctx.rotate(-.5);
      const beam=ctx.createLinearGradient(0,0,w*.7,0);beam.addColorStop(0,`rgba(255,249,205,${a*.72})`);beam.addColorStop(1,'rgba(255,249,205,0)');ctx.fillStyle=beam;
      for(let i=-2;i<=2;i++){ctx.save();ctx.rotate(i*.13);ctx.fillRect(0,-w*.026,w*.78,w*.052);ctx.restore()}ctx.restore();
    }
    if(effect==='sparkles'){
      ctx.globalCompositeOperation='screen';
      for(let i=0;i<38;i++){const rr=seeded(i*999+hashString(scene.id));const x=rr()*w,y=rr()*h,r=2+rr()*4.5;const a=(.25+.7*Math.abs(Math.sin(et*5+i)))*(.45+.55*str);ctx.fillStyle=`rgba(255,246,173,${a*.32})`;ctx.beginPath();ctx.arc(x,y,r*2.4,0,6.28);ctx.fill();ctx.strokeStyle=`rgba(255,255,224,${a})`;ctx.lineWidth=Math.max(1,w/720);ctx.beginPath();ctx.moveTo(x-r*1.8,y);ctx.lineTo(x+r*1.8,y);ctx.moveTo(x,y-r*1.8);ctx.lineTo(x,y+r*1.8);ctx.stroke();ctx.fillStyle=`rgba(255,255,240,${a})`;ctx.beginPath();ctx.arc(x,y,r*.55,0,6.28);ctx.fill()}
    }
    if(effect==='snow'){
      ctx.fillStyle='white';for(const d of P.snow){const y=((d.y+et*d.speed*2)%1)*h;const x=(d.x+Math.sin(et*4+d.phase)*.02)*w;ctx.globalAlpha=.35+.55*str;ctx.beginPath();ctx.arc(x,y,d.size*w,0,6.28);ctx.fill()}
    }
    if(effect==='dust'){
      ctx.globalCompositeOperation='screen';for(const d of P.dust){const x=(d.x+Math.sin(et*2+d.phase)*.018)*w,y=(d.y+Math.cos(et*1.6+d.phase)*.014)*h;const a=d.alpha*(.4+.75*str);ctx.globalAlpha=a*.28;ctx.fillStyle='#ffe9a8';ctx.beginPath();ctx.arc(x,y,d.size*w*2.3,0,6.28);ctx.fill();ctx.globalAlpha=a;ctx.fillStyle='#fff7d6';ctx.beginPath();ctx.arc(x,y,d.size*w,0,6.28);ctx.fill()}
    }
    if(effect==='butterflies'){
      for(const d of P.butterflies){const x=(d.x+Math.sin(et*3+d.phase)*.035)*w,y=(d.y+Math.cos(et*2.2+d.phase)*.025)*h;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(et*4+d.phase)*.25);ctx.fillStyle=`rgba(255,211,65,${.55+.35*str})`;const s=d.size*w;ctx.beginPath();ctx.ellipse(-s*.35,0,s*.42,s*.6,-.4,0,6.28);ctx.ellipse(s*.35,0,s*.42,s*.6,.4,0,6.28);ctx.fill();ctx.restore()}
    }
    ctx.restore();
  }
}
function iColor(phase){return ['#6f9d4a','#a4b94a','#d29a42','#7ca35b'][Math.floor((phase/6.28)*4)%4]}

function drawRegionGuide(geometry,label,active,placement){
  const rect=geometry.bounds;
  ctx.save();
  ctx.beginPath();
  if(geometry.points)traceCanvasPolygon(geometry.points,placement);
  else ctx.rect(rect.x,rect.y,rect.width,rect.height);
  ctx.fillStyle=active?'rgba(76,184,255,.16)':'rgba(76,184,255,.07)';
  ctx.fill();
  ctx.strokeStyle=active?'#7bd2ff':'rgba(123,210,255,.65)';
  ctx.lineWidth=Math.max(2,canvas.width/360);
  ctx.setLineDash(active?[]:[9,7]);
  ctx.stroke();
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

function drawBrushGuide(stroke,placement){
  if(!stroke?.points?.length)return;
  const scaled={...stroke,size:stroke.size*placement.scale,points:stroke.points.map(point=>({x:placement.x+point.x*placement.scale,y:placement.y+point.y*placement.scale}))};
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=scaled.size;ctx.strokeStyle=stroke.mode==='erase'?'rgba(255,107,107,.72)':'rgba(71,211,171,.72)';ctx.fillStyle=ctx.strokeStyle;traceStroke(ctx,scaled);ctx.restore();
}

function drawMotionGuides(img,scene,placement){
  for(const rawRegion of scene.motionRegions||[]){
    const region=normalizeMotionRegion(rawRegion);
    const source=regionSourceGeometry(region,img);
    if(!source)continue;
    drawRegionGuide({
      bounds:sourceRectToCanvas(source.bounds,placement),
      points:source.points
    },region.name,region.id===state.selectedMotionRegionId,placement);
    if(region.id===state.selectedMotionRegionId){
      const fx=img.naturalWidth/Math.max(1,region.mask.width),fy=img.naturalHeight/Math.max(1,region.mask.height);
      for(const stroke of region.mask.strokes||[])drawBrushGuide({mode:stroke.mode,size:stroke.size*(fx+fy)/2,points:stroke.points.map(point=>({x:point.x*fx,y:point.y*fy}))},placement);
    }
  }
  if(state.selectionDraft){
    const draft=state.selectionDraft;
    if(draft.kind==='brush')drawBrushGuide(draft,placement);
    else{
      const bounds=draft.kind==='polygon'?polygonBounds(draft.points):draft.rect;
      drawRegionGuide({
        bounds:sourceRectToCanvas(bounds,placement),
        points:draft.kind==='polygon'?draft.points:null
      },'ここを動かす',true,placement);
    }
  }
}

async function renderFrame(scene, norm){
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#111';ctx.fillRect(0,0,w,h);
  const t=Math.max(0,Math.min(1,norm));let img=null,placement=null;
  try{img=await loadImage(scene.imageObjectUrl||scene.image);if(img){
    if(state.maskPreview){placement=coverPlacement(img,w,h,scene,t);drawMaskPreview(img,placement)}
    else{placement=drawCover(img,w,h,scene,t);drawBackgroundFills(img,scene,placement);drawPartialMotions(img,scene,placement,t*scene.duration)}
  }}catch(e){drawMissing(scene)}
  if(!state.maskPreview)drawEffects(scene,t,w,h);
  if(img&&placement&&!state.maskPreview&&!state.playing&&!state.exporting)drawMotionGuides(img,scene,placement);
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
function moveScene(i,d){const j=i+d;if(j<0||j>=state.project.scenes.length)return;const a=state.project.scenes;[a[i],a[j]]=[a[j],a[i]];state.selected=j;renderSceneList();syncControls();renderFrame(currentScene(),0);commitHistory()}
function selectScene(i){stopNarrationRecording();cancelRegionSelection();state.maskPreview=false;state.selected=Math.max(0,Math.min(i,state.project.scenes.length-1));state.selectedMotionRegionId=null;state.selectedEffectKey=null;state.voiceMessage='';stopPlayback();renderSceneList();syncControls();renderFrame(currentScene(),0)}

function setMaskPreview(enabled){
  state.maskPreview=!!enabled&&!!currentMotionRegion();
  $('maskPreviewBtn').textContent=state.maskPreview?'画像表示に戻る':'◐ マスクだけ確認';
  $('maskPreviewBtn').classList.toggle('primary',state.maskPreview);
  $('maskPreviewHelp').hidden=!state.maskPreview;
  renderFrame(currentScene(),+$('scrubber').value/1000);
}

function setSelectionMode(enabled,kind=state.selectionKind){
  state.selectingRegion=!!enabled;
  state.selectionKind=['rectangle','polygon','brush-add','brush-erase'].includes(kind)?kind:'rectangle';
  state.selectionSession=null;
  state.selectionDraft=null;
  canvas.classList.toggle('selecting-region',state.selectingRegion);
  $('selectRegionBtn').textContent=state.selectingRegion&&state.selectionKind==='rectangle'?'選択をやめる':'＋ 四角で選ぶ';
  $('selectFreeRegionBtn').textContent=state.selectingRegion&&state.selectionKind==='polygon'?'選択をやめる':'＋ 自由に囲む';
  $('selectRegionBtn').classList.toggle('primary',state.selectingRegion&&state.selectionKind==='rectangle');
  $('selectFreeRegionBtn').classList.toggle('primary',state.selectingRegion&&state.selectionKind==='polygon');
  $('addBrushBtn').textContent=state.selectingRegion&&state.selectionKind==='brush-add'?'ブラシをやめる':'＋ ブラシで足す';
  $('eraseBrushBtn').textContent=state.selectingRegion&&state.selectionKind==='brush-erase'?'ブラシをやめる':'－ ブラシで消す';
  $('addBrushBtn').classList.toggle('primary',state.selectingRegion&&state.selectionKind==='brush-add');
  $('eraseBrushBtn').classList.toggle('primary',state.selectingRegion&&state.selectionKind==='brush-erase');
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
  if(!region)state.maskPreview=false;
  $('motionEmpty').hidden=!!region;
  $('motionEditor').hidden=!region;
  if(region){
    select.value=region.id;
    $('activeMotionRegion').textContent=`いまは「${region.name}」だけを編集中です`;
    $('motionRegionName').value=region.name||'';
    $('motionEnabled').checked=region.enabled!==false;
    $('backgroundFill').checked=region.backgroundFill!==false;
    $('motionTypeSelect').value=region.motion?.type||'sway';
    $('motionAxisSelect').value=region.motion?.axis||'x';
    $('motionStrength').value=region.motion?.amplitude??.25;
    $('motionSpeed').value=region.motion?.speed??.4;
    $('motionStrengthValue').textContent=`${Math.round((region.motion?.amplitude??.25)*100)}%`;
    $('motionSpeedValue').textContent=`${Math.round((region.motion?.speed??.4)*100)}%`;
    const motionType=region.motion?.type||'sway';
    $('motionTypeHelp').textContent=MOTION_HELP[motionType]||'';
    $('motionAxisRow').hidden=!['sway','drift'].includes(motionType);
  }
  canvas.classList.toggle('selecting-region',state.selectingRegion);
  $('selectRegionBtn').textContent=state.selectingRegion&&state.selectionKind==='rectangle'?'選択をやめる':'＋ 四角で選ぶ';
  $('selectFreeRegionBtn').textContent=state.selectingRegion&&state.selectionKind==='polygon'?'選択をやめる':'＋ 自由に囲む';
  $('selectRegionBtn').classList.toggle('primary',state.selectingRegion&&state.selectionKind==='rectangle');
  $('selectFreeRegionBtn').classList.toggle('primary',state.selectingRegion&&state.selectionKind==='polygon');
  $('addBrushBtn').textContent=state.selectingRegion&&state.selectionKind==='brush-add'?'ブラシをやめる':'＋ ブラシで足す';
  $('eraseBrushBtn').textContent=state.selectingRegion&&state.selectionKind==='brush-erase'?'ブラシをやめる':'－ ブラシで消す';
  $('addBrushBtn').classList.toggle('primary',state.selectingRegion&&state.selectionKind==='brush-add');
  $('eraseBrushBtn').classList.toggle('primary',state.selectingRegion&&state.selectionKind==='brush-erase');
  $('selectionNotice').hidden=!state.selectingRegion;
  $('maskPreviewBtn').textContent=state.maskPreview?'画像表示に戻る':'◐ マスクだけ確認';
  $('maskPreviewBtn').classList.toggle('primary',state.maskPreview);
  $('maskPreviewHelp').hidden=!state.maskPreview;
}

function syncCameraControls(scene){
  const locked=!!scene.textLock;
  $('cameraSelect').disabled=locked;
  const notice=$('cameraNotice');notice.classList.toggle('locked',locked);
  notice.textContent=locked
    ?'いまは「文字を守る」がオンなので、画像全体のカメラ移動は停止しています。使う場合は下のチェックを外してください。'
    :(CAMERA_HELP[scene.camera||'none']||CAMERA_HELP.none);
}

function syncEffectControls(scene){
  const settings=ensureEffectSettings(scene);
  const enabled=(scene.effects||[]).filter(key=>EFFECT_KEYS.includes(key));
  if(!enabled.includes(state.selectedEffectKey))state.selectedEffectKey=enabled[0]||null;
  const select=$('effectSelect');select.innerHTML='';
  for(const key of enabled){
    const option=document.createElement('option');option.value=key;option.textContent=effectLabel(key);select.append(option);
  }
  const hasEffect=!!state.selectedEffectKey;
  $('effectEditor').hidden=!hasEffect;$('effectEmpty').hidden=hasEffect;
  if(!hasEffect)return;
  select.value=state.selectedEffectKey;
  const setting=settings[state.selectedEffectKey];
  $('effectStrength').value=setting.strength;$('effectSpeed').value=setting.speed;
  $('effectStrengthValue').textContent=`${Math.round(setting.strength*100)}%`;
  $('effectSpeedValue').textContent=`${Math.round(setting.speed*100)}%`;
}

function syncNarrationDurationControls(scene){
  const seconds=Number(scene.narrationDuration);
  const hasDuration=Number.isFinite(seconds)&&seconds>0;
  $('followNarrationDuration').checked=scene.followNarrationDuration!==false;
  $('fitNarrationDurationBtn').disabled=!hasDuration;
  const status=$('narrationDurationStatus');status.classList.remove('ready','warning');
  if(!hasDuration){status.textContent='音声を入れると、ここに声とページの長さが表示されます。';return}
  const clipped=seconds>scene.duration;
  status.textContent=`声 ${seconds.toFixed(1)}秒 ／ ページ ${scene.duration.toFixed(1)}秒${clipped?' — 声が途中で切れます':''}`;
  status.classList.add(clipped?'warning':'ready');
}

function syncControls(){
  const s=currentScene(); if(!s) return;
  s.ambientDuration=Math.max(.5,Math.min(s.duration,s.ambientDuration??s.duration));
  $('sceneName').value=s.name||'';$('narrationText').value=s.narration||'';$('durationInput').value=s.duration;$('imageFitSelect').value=s.imageFit==='contain'?'contain':'cover';$('cameraSelect').value=s.camera||'none';$('textLock').checked=!!s.textLock;
  [...document.querySelectorAll('[data-effect]')].forEach(el=>el.checked=(s.effects||[]).includes(el.dataset.effect));
  $('narrationAudioName').textContent=s.runtime?.narrationFile?.name||'未設定';$('ambientAudioName').textContent=s.runtime?.ambientFile?.name||'未設定';$('bgmAudioName').textContent=state.bgmFile?.name||'未設定';$('bgmVolume').value=state.project.bgmVolume??.35;
  $('narrationVolume').value=s.narrationVolume??1;$('narrationVolumeValue').textContent=`${Math.round((s.narrationVolume??1)*100)}%`;
  $('ambientVolume').value=s.ambientVolume??.55;$('ambientVolumeValue').textContent=`${Math.round((s.ambientVolume??.55)*100)}%`;
  $('ambientDuration').value=s.ambientDuration;
  $('sceneStatus').textContent=`${state.selected+1} / ${state.project.scenes.length}  ${s.name}`;$('timeLabel').textContent=`0.0 / ${s.duration.toFixed(1)} 秒`;$('scrubber').value=0;
  syncVoiceControls();
  syncMotionControls(s);
  syncCameraControls(s);
  syncEffectControls(s);
  syncNarrationDurationControls(s);
}

function syncVoiceControls(){
  const file=currentScene()?.runtime?.narrationFile||null;
  const recording=state.voiceRecorder?.state==='recording';
  $('recordNarrationBtn').disabled=recording;
  $('recordNarrationBtn').classList.toggle('recording',recording);
  $('recordNarrationBtn').textContent=recording?'● 録音中…':'● 録音開始';
  $('stopNarrationBtn').disabled=!recording;
  $('previewNarrationBtn').disabled=recording||!file;
  $('downloadNarrationBtn').disabled=recording||!file;
  $('clearNarrationBtn').disabled=recording||!file;
  $('recordingStatus').textContent=recording?'声を録音しています。読み終わったら「停止」を押してください。':state.voiceMessage||(file?`このシーンでは「${file.name}」を使います。`:'シーンごとにマイクで録音できます。');
}

function setSceneDuration(scene,duration){
  const previous=scene.duration;
  scene.duration=Math.max(1,Math.min(120,+duration||1));
  if(scene.ambientDuration==null||scene.ambientDuration>=previous)scene.ambientDuration=scene.duration;
  else scene.ambientDuration=Math.min(scene.ambientDuration,scene.duration);
}

async function readAudioDuration(file){
  if(!file)return null;
  try{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(AudioContextClass){
      const audioContext=new AudioContextClass();
      const buffer=await audioContext.decodeAudioData(await file.arrayBuffer());
      const duration=buffer.duration;
      await audioContext.close();
      if(Number.isFinite(duration)&&duration>0)return duration;
    }
  }catch(error){console.warn('audio duration decode',error)}
  return new Promise(resolve=>{
    const url=URL.createObjectURL(file),audio=new Audio();
    const finish=value=>{URL.revokeObjectURL(url);resolve(Number.isFinite(value)&&value>0?value:null)};
    const timer=setTimeout(()=>finish(null),5000);
    audio.preload='metadata';audio.onloadedmetadata=()=>{clearTimeout(timer);finish(audio.duration)};audio.onerror=()=>{clearTimeout(timer);finish(null)};audio.src=url;
  });
}

function fitNarrationDuration(scene){
  const fitted=durationForNarration(scene.narrationDuration,.4);
  if(fitted==null)return false;
  setSceneDuration(scene,fitted);
  return true;
}

async function attachNarrationFile(scene,file,message='音声ファイルを設定しました。'){
  ensureRuntime(scene).narrationFile=file||null;
  scene.narrationDuration=file?await readAudioDuration(file):null;
  const adjusted=file&&scene.followNarrationDuration!==false&&fitNarrationDuration(scene);
  if(currentScene()?.id===scene.id){
    state.voiceMessage=file?`${message}${adjusted?` ページを${scene.duration.toFixed(1)}秒に合わせました。`:''}`:'';
    syncControls();renderSceneList();renderFrame(scene,0);
  }
  commitHistory();
}

async function startNarrationRecording(){
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){state.voiceMessage='このブラウザではマイク録音を利用できません。Chrome / Edgeを使ってください。';syncVoiceControls();return}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    const mimeType=['audio/webm;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type))||'';
    const recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);
    state.voiceStream=stream;state.voiceRecorder=recorder;state.voiceChunks=[];state.recordingSceneId=currentScene().id;state.voiceMessage='';
    recorder.ondataavailable=event=>{if(event.data.size)state.voiceChunks.push(event.data)};
    recorder.onstop=async()=>{
      const type=recorder.mimeType||'audio/webm';
      const recordedSceneId=state.recordingSceneId;
      if(state.voiceChunks.length){
        const blob=new Blob(state.voiceChunks,{type});
        const scene=state.project.scenes.find(item=>item.id===recordedSceneId);
        if(scene){
          const file=new File([blob],`narration-${scene.id.slice(0,8)}.webm`,{type});
          await attachNarrationFile(scene,file,`「${scene.name}」の声を録音しました。`);
        }
      }
      for(const track of state.voiceStream?.getTracks()||[])track.stop();
      state.voiceRecorder=null;state.voiceStream=null;state.voiceChunks=[];state.recordingSceneId=null;syncControls();
    };
    recorder.start(250);syncVoiceControls();
  }catch(error){state.voiceMessage=error?.name==='NotAllowedError'?'マイクの使用が許可されませんでした。ブラウザのマイク許可をオンにしてください。':'マイクを開始できませんでした。別のマイクまたは音声ファイルを試してください。';syncVoiceControls()}
}

function stopNarrationRecording(){
  if(state.voiceRecorder?.state==='recording')state.voiceRecorder.stop();
}

function previewNarrationRecording(){
  const file=currentScene()?.runtime?.narrationFile;if(!file)return;
  stopPlayback();const url=URL.createObjectURL(file),audio=new Audio(url);audio.volume=currentScene().narrationVolume??1;audio.onended=()=>URL.revokeObjectURL(url);audio.play().catch(()=>{URL.revokeObjectURL(url);state.voiceMessage='音声を再生できませんでした。';syncVoiceControls()});state.audioPreview.push(audio);
}

function downloadNarrationRecording(){
  const file=currentScene()?.runtime?.narrationFile;if(!file)return;
  downloadBlob(file,file.name||`narration-${currentScene().id.slice(0,8)}.webm`);
  state.voiceMessage='音声を端末へ保存しました。';syncVoiceControls();
}

function clearNarrationRecording(){
  const scene=currentScene(),runtime=ensureRuntime(scene);runtime.narrationFile=null;scene.narrationDuration=null;state.voiceMessage='このシーンの音声を外しました。';syncControls();commitHistory();
}

function setupEffectsUI(){const root=$('effectChecks');for(const [key,label] of EFFECTS){const lab=document.createElement('label');lab.className='effect-chip';const cb=document.createElement('input');cb.type='checkbox';cb.dataset.effect=key;cb.onchange=()=>{const s=currentScene();s.effects=[...document.querySelectorAll('[data-effect]:checked')].map(x=>x.dataset.effect);ensureEffectSettings(s);state.selectedEffectKey=cb.checked?key:(s.effects[0]||null);syncEffectControls(s);renderSceneList();renderFrame(s,+$('scrubber').value/1000);commitHistory()};lab.append(cb,document.createTextNode(label));root.append(lab)}}

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
    const isBrush=state.selectionKind.startsWith('brush-');
    const region=isBrush?currentMotionRegion():null;
    if(isBrush&&!region)throw new Error('region missing');
    state.selectionSession={pointerId:event.pointerId,sceneId:scene.id,regionId:region?.id||null,start,placement,imageSize,kind:state.selectionKind};
    state.selectionDraft=isBrush
      ?{kind:'brush',mode:state.selectionKind==='brush-erase'?'erase':'add',size:+$('brushSize').value||36,points:[start]}
      :state.selectionKind==='polygon'
      ?{kind:'polygon',points:[start]}
      :{kind:'rectangle',rect:{x:start.x,y:start.y,width:0,height:0}};
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
  if(session.kind==='polygon'||session.kind.startsWith('brush-')){
    const points=state.selectionDraft?.points||[];
    const last=points[points.length-1];
    if(!last||Math.hypot(point.x-last.x,point.y-last.y)>=5/session.placement.scale){
      points.push(point);
    }
    state.selectionDraft=session.kind==='polygon'
      ?{kind:'polygon',points}
      :{...state.selectionDraft,points};
  }else{
    state.selectionDraft={kind:'rectangle',rect:rectFromPoints(session.start,point)};
  }
  renderFrame(currentScene(),+$('scrubber').value/1000);
}

function finishRegionSelection(event){
  const session=state.selectionSession;
  if(!session||session.pointerId!==event.pointerId)return;
  updateRegionSelection(event);
  const draft=state.selectionDraft;
  state.selectionSession=null;
  if(draft?.kind==='brush'){
    const scene=currentScene();
    const region=(scene.motionRegions||[]).find(item=>item.id===session.regionId);
    if(region&&draft.points.length){
      const fx=region.mask.width/session.imageSize.width,fy=region.mask.height/session.imageSize.height;
      region.mask.strokes ||= [];
      region.mask.strokes.push({mode:draft.mode,size:draft.size*(fx+fy)/2,points:draft.points.map(point=>({x:point.x*fx,y:point.y*fy}))});
      state.maskCache.delete(region.id);
      commitHistory();
    }
    setSelectionMode(false);syncMotionControls(scene);renderFrame(scene,+$('scrubber').value/1000);return;
  }
  const bounds=draft?.kind==='polygon'?polygonBounds(draft.points):draft?.rect;
  if(!bounds||bounds.width<8||bounds.height<8||(draft.kind==='polygon'&&draft.points.length<3)){
    state.selectionDraft=null;
    $('selectionNotice').textContent='範囲が小さすぎます。画像の上を、もう少し大きくドラッグしてください。';
    renderFrame(currentScene(),+$('scrubber').value/1000);
    return;
  }
  const scene=currentScene();
  const index=(scene.motionRegions||[]).length;
  const isPolygon=draft.kind==='polygon';
  const region=normalizeMotionRegion({
    id:crypto.randomUUID(),
    name:`${isPolygon?'自由範囲':'四角範囲'} ${index+1}`,
    enabled:true,
    zIndex:index,
    mask:{
      kind:isPolygon?'polygon':'rectangle',
      width:session.imageSize.width,
      height:session.imageSize.height,
      rect:isPolygon?null:draft.rect,
      points:isPolygon?draft.points:[],
      feather:6,
      invert:false
    },
    motion:{type:'sway',amplitude:.25,speed:.4,phase:(index*.173)%1,axis:'x',pivot:{x:.5,y:1}}
  },index);
  scene.motionRegions ||= [];
  scene.motionRegions.push(region);
  state.selectedMotionRegionId=region.id;
  state.maskCache.delete(region.id);
  commitHistory();
  setSelectionMode(false);
  syncMotionControls(scene);
  renderFrame(scene,+$('scrubber').value/1000);
}

function removeCurrentMotionRegion(){
  const scene=currentScene();
  const index=(scene.motionRegions||[]).findIndex(region=>region.id===state.selectedMotionRegionId);
  if(index<0)return;
  scene.motionRegions.splice(index,1);
  state.maskCache.delete(state.selectedMotionRegionId);
  state.selectedMotionRegionId=scene.motionRegions[Math.min(index,scene.motionRegions.length-1)]?.id||null;
  syncMotionControls(scene);
  renderFrame(scene,+$('scrubber').value/1000);
  commitHistory();
}

function updateMotionControl(mutator){
  const region=currentMotionRegion();if(!region)return;
  mutator(region);
  state.maskCache.delete(region.id);
  renderFrame(currentScene(),+$('scrubber').value/1000);
  queueHistoryCommit();
}

function bindControls(){
  $('sceneName').oninput=e=>{currentScene().name=e.target.value;renderSceneList();queueHistoryCommit()};
  $('narrationText').oninput=e=>{currentScene().narration=e.target.value;queueHistoryCommit()};
  $('durationInput').oninput=e=>{const scene=currentScene();setSceneDuration(scene,e.target.value);$('ambientDuration').value=scene.ambientDuration;syncNarrationDurationControls(scene);renderSceneList();queueHistoryCommit()};
  $('imageFitSelect').onchange=e=>{currentScene().imageFit=e.target.value==='contain'?'contain':'cover';renderFrame(currentScene(),+$('scrubber').value/1000);commitHistory()};
  $('cameraSelect').onchange=e=>{currentScene().camera=e.target.value;syncCameraControls(currentScene());renderFrame(currentScene(),+$('scrubber').value/1000);commitHistory()};
  $('textLock').onchange=e=>{currentScene().textLock=e.target.checked;syncCameraControls(currentScene());renderFrame(currentScene(),+$('scrubber').value/1000);commitHistory()};
  $('effectSelect').onchange=e=>{state.selectedEffectKey=e.target.value;syncEffectControls(currentScene());renderFrame(currentScene(),+$('scrubber').value/1000)};
  $('effectStrength').oninput=e=>{const value=+e.target.value,key=state.selectedEffectKey;if(!key)return;ensureEffectSettings(currentScene())[key].strength=value;$('effectStrengthValue').textContent=`${Math.round(value*100)}%`;renderFrame(currentScene(),+$('scrubber').value/1000);queueHistoryCommit()};
  $('effectSpeed').oninput=e=>{const value=+e.target.value,key=state.selectedEffectKey;if(!key)return;ensureEffectSettings(currentScene())[key].speed=value;$('effectSpeedValue').textContent=`${Math.round(value*100)}%`;renderFrame(currentScene(),+$('scrubber').value/1000);queueHistoryCommit()};
  $('autoDurationBtn').onclick=()=>{const s=currentScene();setSceneDuration(s,estimateDuration(s.narration));$('durationInput').value=s.duration;$('ambientDuration').value=s.ambientDuration;syncNarrationDurationControls(s);renderSceneList();commitHistory()};
  $('autoEffectBtn').onclick=()=>{const s=currentScene();s.effects=inferEffects(s.narration);syncControls();renderSceneList();renderFrame(s,0);commitHistory()};
  $('selectRegionBtn').onclick=()=>{
    const active=state.selectingRegion&&state.selectionKind==='rectangle';
    $('selectionNotice').textContent='画像の上をドラッグして四角く囲みます。';
    setSelectionMode(!active,'rectangle');
  };
  $('selectFreeRegionBtn').onclick=()=>{
    const active=state.selectingRegion&&state.selectionKind==='polygon';
    $('selectionNotice').textContent='動かしたい物の輪郭を、指やマウスで一周なぞってください。';
    setSelectionMode(!active,'polygon');
  };
  $('addBrushBtn').onclick=()=>{
    const active=state.selectingRegion&&state.selectionKind==='brush-add';
    $('selectionNotice').textContent='足したい部分を指やマウスで塗ってください。緑色が追加です。';
    setSelectionMode(!active,'brush-add');
  };
  $('eraseBrushBtn').onclick=()=>{
    const active=state.selectingRegion&&state.selectionKind==='brush-erase';
    $('selectionNotice').textContent='除きたい部分を指やマウスで塗ってください。赤色が削除です。';
    setSelectionMode(!active,'brush-erase');
  };
  $('brushSize').oninput=e=>$('brushSizeValue').textContent=`${Math.round(+e.target.value)} px`;
  $('motionRegionSelect').onchange=e=>{state.selectedMotionRegionId=e.target.value;syncMotionControls(currentScene());renderFrame(currentScene(),+$('scrubber').value/1000)};
  $('motionRegionName').oninput=e=>{const name=e.target.value||'名前なしの範囲';updateMotionControl(region=>region.name=name);const option=[...$('motionRegionSelect').options].find(item=>item.value===state.selectedMotionRegionId);if(option)option.textContent=name;$('activeMotionRegion').textContent=`いまは「${name}」だけを編集中です`;renderSceneList()};
  $('maskPreviewBtn').onclick=()=>{cancelRegionSelection();setMaskPreview(!state.maskPreview)};
  $('motionEnabled').onchange=e=>updateMotionControl(region=>region.enabled=e.target.checked);
  $('backgroundFill').onchange=e=>updateMotionControl(region=>region.backgroundFill=e.target.checked);
  $('motionTypeSelect').onchange=e=>{updateMotionControl(region=>{region.motion.type=e.target.value;region.motion.pivot=e.target.value==='sway'?{x:.5,y:1}:{x:.5,y:.5}});syncMotionControls(currentScene())};
  $('motionAxisSelect').onchange=e=>updateMotionControl(region=>region.motion.axis=e.target.value);
  $('motionStrength').oninput=e=>{const value=+e.target.value;$('motionStrengthValue').textContent=`${Math.round(value*100)}%`;updateMotionControl(region=>region.motion.amplitude=value)};
  $('motionSpeed').oninput=e=>{const value=+e.target.value;$('motionSpeedValue').textContent=`${Math.round(value*100)}%`;updateMotionControl(region=>region.motion.speed=value)};
  $('previewMotionBtn').onclick=previewCurrentMotion;
  $('removeRegionBtn').onclick=removeCurrentMotionRegion;
  canvas.addEventListener('pointerdown',beginRegionSelection);
  canvas.addEventListener('pointermove',updateRegionSelection);
  canvas.addEventListener('pointerup',finishRegionSelection);
  canvas.addEventListener('pointercancel',()=>setSelectionMode(false));
  $('scrubber').oninput=e=>{const v=+e.target.value/1000;renderFrame(currentScene(),v);$('timeLabel').textContent=`${(v*currentScene().duration).toFixed(1)} / ${currentScene().duration.toFixed(1)} 秒`};
  $('prevBtn').onclick=()=>selectScene(state.selected-1);$('nextBtn').onclick=()=>selectScene(state.selected+1);
  $('playSceneBtn').onclick=()=>playScenes([state.selected]);$('playAllBtn').onclick=()=>playScenes([...state.project.scenes.keys()]);
  $('speakBtn').onclick=()=>speakCurrent();
  $('recordNarrationBtn').onclick=startNarrationRecording;$('stopNarrationBtn').onclick=stopNarrationRecording;$('previewNarrationBtn').onclick=previewNarrationRecording;$('downloadNarrationBtn').onclick=downloadNarrationRecording;$('clearNarrationBtn').onclick=clearNarrationRecording;
  $('narrationAudio').onchange=e=>attachNarrationFile(currentScene(),e.target.files[0]||null);
  $('followNarrationDuration').onchange=e=>{currentScene().followNarrationDuration=e.target.checked;if(e.target.checked&&fitNarrationDuration(currentScene())){syncControls();renderSceneList()}commitHistory()};
  $('fitNarrationDurationBtn').onclick=()=>{const scene=currentScene();if(!fitNarrationDuration(scene))return;state.voiceMessage=`ページを声に合わせて${scene.duration.toFixed(1)}秒にしました。`;syncControls();renderSceneList();commitHistory()};
  $('ambientAudio').onchange=e=>{ensureRuntime(currentScene()).ambientFile=e.target.files[0]||null;syncControls()};
  $('narrationVolume').oninput=e=>{const value=+e.target.value;currentScene().narrationVolume=value;$('narrationVolumeValue').textContent=`${Math.round(value*100)}%`;queueHistoryCommit()};
  $('ambientVolume').oninput=e=>{const value=+e.target.value;currentScene().ambientVolume=value;$('ambientVolumeValue').textContent=`${Math.round(value*100)}%`;queueHistoryCommit()};
  $('ambientDuration').oninput=e=>{currentScene().ambientDuration=Math.max(.5,Math.min(currentScene().duration,+e.target.value||currentScene().duration));e.target.value=currentScene().ambientDuration;queueHistoryCommit()};
  $('bgmAudio').onchange=e=>{state.bgmFile=e.target.files[0]||null;syncControls()};
  $('bgmVolume').oninput=e=>{state.project.bgmVolume=+e.target.value;queueHistoryCommit()};
  $('resolutionSelect').onchange=e=>{setResolution(e.target.value);commitHistory()};
  $('removeSceneBtn').onclick=removeCurrentScene;$('addSceneBtn').onclick=addBlankScene;
  $('importImagesBtn').onclick=()=>$('imageInput').click();$('imageInput').onchange=e=>addImages([...e.target.files]);
  $('saveWorkBtn').onclick=saveWorkArchive;
  $('openWorkBtn').onclick=()=>$('workInput').click();
  $('workInput').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(file)await loadWorkArchive(file)};
  $('saveProjectBtn').onclick=saveProjectJson;$('importProjectBtn').onclick=()=>$('projectInput').click();$('projectInput').onchange=e=>loadProjectJson(e.target.files[0]);
  $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
  document.addEventListener('keydown',event=>{const tag=document.activeElement?.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo()}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo()}});
  $('exportBtn').onclick=exportWebM;
}
function ensureRuntime(s){if(!s.runtime)s.runtime={narrationFile:null,ambientFile:null};return s.runtime}
function setResolution(v){const [w,h]=v.split('x').map(Number);state.project.width=w;state.project.height=h;canvas.width=w;canvas.height=h;renderFrame(currentScene(),+$('scrubber').value/1000)}
function addBlankScene(){state.project.scenes.push({id:crypto.randomUUID(),name:`シーン${state.project.scenes.length+1}`,image:'',imageObjectUrl:null,narration:'',duration:5,followNarrationDuration:true,narrationDuration:null,narrationVolume:1,ambientVolume:.55,ambientDuration:5,imageFit:'cover',camera:'none',textLock:true,effects:[],effectStrength:.55,effectSettings:{},motionRegions:[],runtime:{narrationFile:null,ambientFile:null}});selectScene(state.project.scenes.length-1);commitHistory()}
function removeCurrentScene(){if(state.project.scenes.length<=1)return;state.project.scenes.splice(state.selected,1);state.selected=Math.min(state.selected,state.project.scenes.length-1);selectScene(state.selected);commitHistory()}
function addImages(files){if(!files.length)return;for(const f of files){const url=URL.createObjectURL(f);state.project.scenes.push({id:crypto.randomUUID(),name:f.name.replace(/\.[^.]+$/,''),image:'',imageObjectUrl:url,narration:'',duration:5,followNarrationDuration:true,narrationDuration:null,narrationVolume:1,ambientVolume:.55,ambientDuration:5,imageFit:'cover',camera:'none',textLock:true,effects:[],effectStrength:.55,effectSettings:{},motionRegions:[],runtime:{narrationFile:null,ambientFile:null}})}selectScene(state.project.scenes.length-files.length);commitHistory()}

function stopPlayback(){state.playToken++;state.playing=false;for(const a of state.audioPreview){try{a.pause()}catch{}}state.audioPreview=[];for(const src of state.generatedAmbient){try{src.stop()}catch{}}state.generatedAmbient=[]}
async function previewCurrentMotion(){
  if(!currentMotionRegion())return;
  if(state.voiceRecorder?.state==='recording')return alert('先に声の録音を停止してください。');
  setMaskPreview(false);
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
async function playScenes(indices){if(state.voiceRecorder?.state==='recording')return alert('先に声の録音を停止してください。');setMaskPreview(false);stopPlayback();const token=state.playToken;state.playing=true;let bgm=null;if(state.bgmFile){bgm=new Audio(URL.createObjectURL(state.bgmFile));bgm.loop=true;bgm.volume=state.project.bgmVolume;bgm.play().catch(()=>{});state.audioPreview.push(bgm)}
  for(const idx of indices){if(token!==state.playToken)return;state.selected=idx;renderSceneList();syncControls();const s=currentScene();const started=performance.now();const sceneAudios=playSceneAudioPreview(s,bgm);while(token===state.playToken){const elapsed=(performance.now()-started)/1000;for(const item of sceneAudios)if(elapsed>=item.stopAt&&!item.audio.paused)item.audio.pause();const n=Math.min(1,elapsed/s.duration);await renderFrame(s,n);$('scrubber').value=n*1000;$('timeLabel').textContent=`${Math.min(elapsed,s.duration).toFixed(1)} / ${s.duration.toFixed(1)} 秒`;if(n>=1)break;await sleep(1000/30)}for(const item of sceneAudios)item.audio.pause()}
  if(bgm)bgm.pause();state.playing=false;renderFrame(currentScene(),1);
}
function playSceneAudioPreview(s,bgm){
  const started=[];if(bgm)bgm.volume=s.runtime?.narrationFile?state.project.bgmVolume*.42:state.project.bgmVolume;
  if(s.runtime?.narrationFile){const a=new Audio(URL.createObjectURL(s.runtime.narrationFile));a.volume=s.narrationVolume??1;a.play().catch(()=>{});state.audioPreview.push(a);started.push({audio:a,stopAt:s.duration})}
  const ambientDuration=Math.max(.5,Math.min(s.duration,s.ambientDuration??s.duration));
  if(s.runtime?.ambientFile){const a=new Audio(URL.createObjectURL(s.runtime.ambientFile));a.loop=true;a.volume=s.ambientVolume??.55;a.play().catch(()=>{});state.audioPreview.push(a);started.push({audio:a,stopAt:ambientDuration})}
  if(!s.runtime?.ambientFile && (s.effects||[]).includes('rain')) startWebAudioAmbient('rain',ambientDuration,s.ambientVolume??.55);
  if(!s.runtime?.ambientFile && (s.effects||[]).includes('wind')) startWebAudioAmbient('wind',ambientDuration,s.ambientVolume??.55);
  return started;
}
function speakCurrent(){if(!('speechSynthesis'in window))return alert('このブラウザは音声読み上げに対応していません');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(currentScene().narration);u.lang='ja-JP';u.rate=.92;u.volume=currentScene().narrationVolume??1;speechSynthesis.speak(u)}
let previewAudioCtx=null;
function startWebAudioAmbient(kind,duration,volume){try{previewAudioCtx ||= new AudioContext();const c=previewAudioCtx;const b=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const src=c.createBufferSource();src.buffer=b;src.loop=true;const filter=c.createBiquadFilter(),gain=c.createGain();if(kind==='rain'){filter.type='highpass';filter.frequency.value=1800;gain.gain.value=.06*volume}else{filter.type='lowpass';filter.frequency.value=500;gain.gain.value=.08*volume}src.connect(filter).connect(gain).connect(c.destination);state.generatedAmbient.push(src);src.onended=()=>{state.generatedAmbient=state.generatedAmbient.filter(item=>item!==src)};src.start();src.stop(c.currentTime+duration)}catch{}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function serializableProject(){return {...state.project,scenes:state.project.scenes.map(({runtime,imageObjectUrl,...s})=>({...s,imageObjectUrl:null}))}}
function saveProjectJson(){const blob=new Blob([JSON.stringify(serializableProject(),null,2)],{type:'application/json'});downloadBlob(blob,'stillmotion-project.json')}

function mediaEntry(index,kind,file){
  const name=file?.name||`${kind}-${index+1}`;
  const ext=name.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0]||(kind==='image'?'.png':'.bin');
  return {path:`media/${String(index+1).padStart(3,'0')}-${kind}${ext}`,name,type:file.type|| (kind==='image'?'image/png':'application/octet-stream')};
}

async function saveWorkArchive(){
  if(state.voiceRecorder?.state==='recording')return alert('先に声の録音を停止してください。');
  const button=$('saveWorkBtn');button.disabled=true;$('workStatus').textContent='画像と音声をまとめています…';
  try{
    const project=serializableProject();
    const manifest={format:'stillmotion-work',version:1,project,selected:state.selected,assets:{scenes:[],bgm:null}};
    const entries=[];
    for(const [index,scene] of state.project.scenes.entries()){
      const assets={image:null,narration:null,ambient:null};
      const source=scene.imageObjectUrl||scene.image;
      if(source){
        let image;
        try{const response=await fetch(source);if(!response.ok)throw new Error('missing');image=await response.blob();if(!image.size)throw new Error('empty')}
        catch{throw new Error(`${index+1}ページ目の画像を読めません。画像をもう一度追加してください。`)}
        const extension={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/avif':'.avif','image/svg+xml':'.svg'}[image.type];
        if(!extension)throw new Error(`${index+1}ページ目の画像の形式を確認できません。画像をもう一度追加してください。`);
        const name=scene.imageObjectUrl?`page-${index+1}${extension}`:source.split('/').pop().split('?')[0];
        const meta=mediaEntry(index,'image',{name,type:image.type});
        assets.image=meta;entries.push({path:meta.path,blob:image});
      }
      for(const kind of ['narration','ambient']){
        const file=scene.runtime?.[`${kind}File`];if(!file)continue;
        const meta=mediaEntry(index,kind,file);assets[kind]=meta;entries.push({path:meta.path,blob:file});
      }
      manifest.assets.scenes.push(assets);
    }
    if(state.bgmFile){
      const meta=mediaEntry(state.project.scenes.length,'bgm',state.bgmFile);
      manifest.assets.bgm=meta;entries.push({path:meta.path,blob:state.bgmFile});
    }
    entries.unshift({path:'project.json',blob:new Blob([JSON.stringify(manifest)],{type:'application/json'})});
    const archive=await writeWorkZip(entries);
    downloadBlob(archive,'stillmotion-editable.zip');
    $('workStatus').textContent='編集用ZIPのダウンロードを開始しました。保存したファイルは次回「編集用ZIPを開く」から読み込めます。';
  }catch(error){$('workStatus').textContent=`保存できませんでした: ${error.message}`}
  finally{button.disabled=false}
}

async function loadWorkArchive(file){
  if(state.voiceRecorder?.state==='recording')return alert('先に声の録音を停止してください。');
  const button=$('openWorkBtn');button.disabled=true;$('workStatus').textContent='編集用ZIPを読み込んでいます…';
  const urls=[];let applied=false;
  try{
    const files=await readWorkZip(file);
    const manifestBytes=files.get('project.json');
    if(!manifestBytes)throw new Error('project.json がありません。完成動画のZIPは読み込めません。');
    const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));
    if(manifest.format!=='stillmotion-work'||manifest.version!==1||!Array.isArray(manifest.project?.scenes)||!manifest.project.scenes.length||!Array.isArray(manifest.assets?.scenes)||manifest.assets.scenes.length!==manifest.project.scenes.length)throw new Error('StillMotion Studioの編集用ZIPではありません。');
    const loadMedia=(meta,kind)=>{
      if(meta==null)return null;
      if(typeof meta.path!=='string'||!/^media\/[a-zA-Z0-9._-]+$/.test(meta.path)||typeof meta.name!=='string'||typeof meta.type!=='string'||!meta.type.startsWith(kind+'/')||!files.has(meta.path))throw new Error('ZIP内の画像か音声が不足しています。');
      return new File([files.get(meta.path)],meta.name,{type:meta.type});
    };
    const scenes=manifest.project.scenes.map((raw,index)=>{
      const assets=manifest.assets.scenes[index];if(!assets||typeof assets!=='object')throw new Error('シーンの素材一覧が正しくありません。');
      const image=loadMedia(assets.image,'image');
      const narrationFile=loadMedia(assets.narration,'audio');
      const ambientFile=loadMedia(assets.ambient,'audio');
      const imageObjectUrl=image?URL.createObjectURL(image):null;if(imageObjectUrl)urls.push(imageObjectUrl);
      if(raw.image&&!image)throw new Error(`${index+1}ページ目の画像が入っていません。`);
      return {...raw,imageObjectUrl,runtime:{narrationFile,ambientFile}};
    });
    const bgm=loadMedia(manifest.assets.bgm,'audio');
    const project={...manifest.project,scenes};
    if(!window.confirm('現在の編集内容を置き換えて、このZIPの続きを開きますか？\n未保存の変更があれば先に「編集用ZIPを保存」してください。')){
      urls.forEach(url=>URL.revokeObjectURL(url));$('workStatus').textContent='読み込みを中止しました。';return;
    }
    const oldUrls=state.project.scenes.map(scene=>scene.imageObjectUrl).filter(Boolean);
    stopPlayback();state.project=project;applied=true;state.project.scenes=scenes.map(scene=>normalizeSceneMotion({...scene,imageFit:scene.imageFit==='contain'?'contain':'cover'}));
    state.bgmFile=bgm;state.selected=Math.max(0,Math.min(Number(manifest.selected)||0,scenes.length-1));
    state.selectedMotionRegionId=null;state.selectedEffectKey=null;state.voiceMessage='';state.images.clear();state.particles.clear();state.maskCache.clear();state.maskPreview=false;setSelectionMode(false);
    setResolution(`${project.width||720}x${project.height||960}`);renderSceneList();syncControls();renderFrame(currentScene(),0);resetHistory();
    oldUrls.forEach(url=>URL.revokeObjectURL(url));
    $('workStatus').textContent='編集用ZIPを開きました。画像と音声も復元しました。';
  }catch(error){if(!applied)urls.forEach(url=>URL.revokeObjectURL(url));$('workStatus').textContent=`開けませんでした: ${error.message}`}
  finally{button.disabled=false}
}

async function loadProjectJson(file){if(!file)return;try{const p=JSON.parse(await file.text());if(!Array.isArray(p.scenes))throw new Error('scenes がありません');p.formatVersion=Number.isFinite(+p.formatVersion)?+p.formatVersion:1;p.scenes=p.scenes.map(raw=>{const s=normalizeSceneMotion({...raw,id:raw.id||crypto.randomUUID(),imageFit:raw.imageFit==='contain'?'contain':'cover',followNarrationDuration:raw.followNarrationDuration!==false,narrationDuration:Number.isFinite(+raw.narrationDuration)&&+raw.narrationDuration>0?+raw.narrationDuration:null,narrationVolume:Number.isFinite(+raw.narrationVolume)?Math.max(0,Math.min(1,+raw.narrationVolume)):1,ambientVolume:Number.isFinite(+raw.ambientVolume)?Math.max(0,Math.min(1,+raw.ambientVolume)):.55,ambientDuration:Number.isFinite(+raw.ambientDuration)?Math.max(.5,Math.min(+raw.duration||5,+raw.ambientDuration)):(+raw.duration||5),runtime:{narrationFile:null,ambientFile:null},imageObjectUrl:null});s.effectSettings=normalizeEffectSettings(s,EFFECT_KEYS);return s});state.project={...state.project,...p};state.selected=0;state.selectedMotionRegionId=null;state.selectedEffectKey=null;state.maskCache.clear();setResolution(`${state.project.width||720}x${state.project.height||960}`);renderSceneList();syncControls();renderFrame(currentScene(),0);resetHistory()}catch(e){alert('JSONを読み込めませんでした: '+e.message)}}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),60000)}

async function decodeFile(ctx,file){if(!file)return null;return ctx.decodeAudioData(await file.arrayBuffer())}
function makeNoiseBuffer(ctx){const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
async function exportWebM(){
  if(state.voiceRecorder?.state==='recording')return alert('先に声の録音を停止してください。');
  if(!window.MediaRecorder||!canvas.captureStream)return alert('このブラウザでは動画書き出しを使えません。Chrome / Edgeを使ってください。');
  setMaskPreview(false);stopPlayback();state.exporting=true;$('exportBtn').disabled=true;$('exportStatus').textContent='準備中…';$('exportProgress').value=0;await renderFrame(currentScene(),0);
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
      if(s.runtime?.narrationFile){const b=await decodeFile(audioCtx,s.runtime.narrationFile);const src=audioCtx.createBufferSource(),g=audioCtx.createGain();src.buffer=b;g.gain.value=s.narrationVolume??1;src.connect(g).connect(master);src.start();local.push(src);if(bgmGain)bgmGain.gain.setTargetAtTime(state.project.bgmVolume*.38,audioCtx.currentTime,.08)} else if(bgmGain)bgmGain.gain.setTargetAtTime(state.project.bgmVolume,audioCtx.currentTime,.08);
      const ambientDuration=Math.max(.5,Math.min(s.duration,s.ambientDuration??s.duration));
      const ambientVolume=s.ambientVolume??.55;
      if(s.runtime?.ambientFile){const b=await decodeFile(audioCtx,s.runtime.ambientFile);const src=audioCtx.createBufferSource(),g=audioCtx.createGain();src.buffer=b;src.loop=true;g.gain.value=ambientVolume;src.connect(g).connect(master);src.start();src.stop(audioCtx.currentTime+ambientDuration);local.push(src)} else {
        for(const kind of ['rain','wind']) if((s.effects||[]).includes(kind)){const src=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();src.buffer=makeNoiseBuffer(audioCtx);src.loop=true;if(kind==='rain'){f.type='highpass';f.frequency.value=1700;g.gain.value=.06*ambientVolume}else{f.type='lowpass';f.frequency.value=450;g.gain.value=.08*ambientVolume}src.connect(f).connect(g).connect(master);src.start();src.stop(audioCtx.currentTime+ambientDuration);local.push(src)}
      }
    }catch(e){console.warn('audio',e)}
    const start=performance.now();while(true){const elapsed=(performance.now()-start)/1000;const n=Math.min(1,elapsed/s.duration);await renderFrame(s,n);const all=done+Math.min(elapsed,s.duration);$('exportProgress').value=all/total;$('exportStatus').textContent=`書き出し中 ${Math.round(all/total*100)}% — ${i+1}/${state.project.scenes.length}`;if(n>=1)break;await sleep(1000/(state.project.fps||30))}
    done+=s.duration;for(const src of local){try{src.stop()}catch{}}
  }
  if(bgmSrc)try{bgmSrc.stop()}catch{};rec.stop();await stopped;await audioCtx.close();const blob=new Blob(chunks,{type:mime||'video/webm'});downloadBlob(blob,`${state.project.title||'stillmotion'}.webm`);state.exporting=false;$('exportStatus').textContent='完了。WebMを保存しました。';$('exportProgress').value=1;$('exportBtn').disabled=false;renderFrame(currentScene(),1);
}

function init(){setupEffectsUI();bindControls();setResolution('720x960');renderSceneList();syncControls();renderFrame(currentScene(),0);resetHistory()}
init();
