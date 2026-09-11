/* Local V2 arcade. Memory and Mines retain their own game implementations. */
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .home-mosaic.arcade-mode > .home-tile, .home-mosaic.arcade-mode::after { visibility:hidden; }
    .arcade-canvas { position:absolute; inset:0; width:100%; height:100%; z-index:7; touch-action:none; }
    .arcade-console { display:flex; flex-direction:column; flex-wrap:nowrap; align-items:flex-start; align-content:start; min-height:0; gap:7px; padding-top:7px; font:10px/1.4 var(--mono); }
    .arcade-console button { font:inherit; color:var(--accent); border:1px solid var(--hairline); background:transparent; padding:6px 9px; cursor:pointer; }
    #memory-toggle, #mines-toggle, .home-game-console .arcade-launch { box-sizing:border-box; width:126px; min-height:28px; border:1px solid var(--hairline); padding:6px 9px; color:var(--accent); text-align:left; }
    .home-feature:not(:has(.home-mosaic.memory-mode)) #memory-state, #game-divider { display:none; }
    .arcade-console[hidden], .arcade-console [hidden], .arcade-canvas[hidden] { display:none; }
    .arcade-help { flex-basis:100%; color:var(--soft); }
    .arcade-status { flex-basis:100%; color:var(--accent); }
    .tetris-next { display:inline-grid; grid-template-columns:repeat(4,5px); grid-template-rows:repeat(2,5px); gap:1px; margin-left:5px; vertical-align:-1px; }
    .tetris-next > i { width:5px; height:5px; background:transparent; }
    .tetris-next > i.is-filled { background:var(--accent); box-shadow:inset 0 0 3px rgba(255,255,255,.72); }
    .arcade-controls { display:flex; flex-wrap:wrap; gap:6px; padding-top:7px; border-top:1px solid var(--hairline); }
    .arcade-controls button { min-width:40px; min-height:40px; touch-action:manipulation; }
    .arcade-dpad { display:none; }
    .arcade-fullscreen { position:fixed!important; inset:0!important; z-index:10000!important; width:100%!important; height:100dvh!important; max-width:none!important; margin:0!important; padding: max(8px,env(safe-area-inset-top)) 12px max(8px,env(safe-area-inset-bottom))!important; background:var(--paper); display:flex!important; flex-direction:column; align-items:center; justify-content:center; gap:8px; }
    .arcade-fullscreen .home-mosaic { flex:none; width:min(calc(100vw - 24px),calc((100dvh - 180px) * .69))!important; height:auto!important; aspect-ratio:9/13!important; margin:0!important; }
    .home-feature.arcade-fullscreen > :is(.feature-note,.scroll-cue,.home-image) { display:none!important; }
    .arcade-fullscreen .arcade-dpad { display:grid; align-self:center; margin:0; }
    .arcade-fullbar { display:none; }
    .arcade-fullscreen .arcade-fullbar { display:flex; gap:8px; }
    .arcade-fullbar button { min-height:40px; padding:6px 12px; border:1px solid var(--hairline); background:var(--paper); color:var(--accent); font:12px var(--mono); }
    @media (pointer:coarse), (max-width:700px) {
      .arcade-dpad:not([hidden]) { display:grid; grid-template-columns:repeat(3,40px); grid-template-rows:repeat(3,40px); width:120px; height:120px; margin:12px 0 12px auto; overflow:hidden; border:1px solid var(--hairline); border-radius:50%; background:color-mix(in srgb,var(--paper) 88%,var(--hairline)); box-shadow:inset 0 1px 0 color-mix(in srgb,var(--paper) 85%,transparent),0 3px 9px color-mix(in srgb,var(--ink) 10%,transparent); touch-action:none; }
      .arcade-dpad button { border:0; background:transparent; color:var(--accent); font:20px/1 var(--mono); padding:0; touch-action:none; user-select:none; -webkit-user-select:none; }
      .arcade-dpad button:active { background:color-mix(in srgb,var(--accent) 18%,transparent); color:var(--ink); }
      .arcade-dpad [data-action=up] { grid-column:2; grid-row:1; }
      .arcade-dpad [data-action=left] { grid-column:1; grid-row:2; }
      .arcade-dpad [data-action=down] { grid-column:2; grid-row:3; }
      .arcade-dpad [data-action=right] { grid-column:3; grid-row:2; }
      .arcade-dpad [data-action=drop] { grid-column:2; grid-row:2; width:32px; height:32px; align-self:center; justify-self:center; border:1px solid var(--hairline); border-radius:50%; background:var(--paper); font-size:8px; }
    }
    .home-feature:has(.arcade-mode) .home-game-console { display:none; }
    .home-feature:has(.home-mosaic.memory-mode) :is(#mines-toggle,.arcade-launch),
    .home-feature:has(.home-mosaic.mines-mode) .arcade-launch { display:none; }
    @media(max-width:700px) {
      .home-feature:not(.arcade-fullscreen):has(.arcade-mode) > .arcade-dpad { position:absolute; top:var(--pad-top); right:0; margin:0; z-index:8; }
      .home-feature:not(.arcade-fullscreen) .feature-note.arcade-note { display:block!important; margin-top:12px; }
      .home-feature:not(.arcade-fullscreen) .feature-note.arcade-note > p:first-child { box-sizing:border-box; width:calc(100% - 154px); min-height:98px; padding:8px; border:1px solid var(--hairline); font-size:10px; line-height:1.45; }
      .home-feature:not(.arcade-fullscreen) .feature-note.arcade-note > p:nth-child(2) { clear:both; padding-top:10px; }
      .overview-work.show-feature .feature-note > p:first-child { min-height:75px; }
      .home-mosaic.arcade-mode + .scroll-cue + .feature-note #feature-status-copy br { display:initial; }
      .home-feature:not(:has(.home-mosaic.memory-mode,.home-mosaic.mines-mode,.home-mosaic.arcade-mode)) .home-game-console { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; width:100%; }
      .home-feature:not(:has(.home-mosaic.memory-mode,.home-mosaic.mines-mode,.home-mosaic.arcade-mode)) .home-game-console > :is(#memory-toggle,#mines-toggle,.arcade-launch) { display:block; width:100%; min-width:0; padding:7px 5px; font-size:clamp(7px,2.15vw,9px); white-space:nowrap; text-align:center; }
      .arcade-console { min-height:0; }
      .arcade-controls button { min-height:34px; }
      .feature-note.arcade-note { display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 12px; align-content:start; }
      .feature-note.arcade-note > p { display:block!important; min-width:0; max-width:none!important; margin:0!important; }
      .feature-note.arcade-note > p:nth-child(1) { grid-column:1 / -1; grid-row:1; }
      .feature-note.arcade-note > p:nth-child(2) { grid-column:1; grid-row:2; margin-bottom:7px!important; }
      .feature-note.arcade-note > p:nth-child(3) { display:none!important; }
      .feature-note.arcade-note > p:nth-child(4) { grid-column:2; grid-row:2; margin-bottom:7px!important; }
      .feature-note.arcade-note > .arcade-console { grid-column:1 / -1; grid-row:3; width:100%; min-height:0; }
    }
  `;
  document.head.append(style);
  const canvas = document.createElement('canvas');
  canvas.className = 'arcade-canvas'; canvas.hidden = true;
  canvas.setAttribute('aria-label','Game board'); homeMosaic.append(canvas);
  const ctx = canvas.getContext('2d');
  const ui = document.createElement('div'); ui.className = 'arcade-console'; ui.hidden = true;
  ui.innerHTML = `<div class="arcade-status" role="status" hidden></div><div class="arcade-help" hidden></div>
    <div class="arcade-controls" hidden><button data-action="fullscreen">FULLSCREEN</button><button data-action="pause">PAUSE</button><button data-action="reset">RESET</button><button data-action="exit">EXIT</button></div>`;
  featureNote.append(ui);
  const dpad=document.createElement('div');dpad.className='arcade-dpad';dpad.hidden=true;dpad.setAttribute('aria-label','Game directions');
  dpad.innerHTML='<button type="button" data-action="up" aria-label="Up or rotate">↑</button><button type="button" data-action="left" aria-label="Left">←</button><button type="button" data-action="down" aria-label="Down; hold to lower">↓</button><button type="button" data-action="right" aria-label="Right">→</button><button type="button" data-action="drop" aria-label="Drop piece instantly">DROP</button>';
  featureNote.before(dpad);
  const fullbar=document.createElement('div');fullbar.className='arcade-fullbar';fullbar.innerHTML='<button type="button" data-action="pause">PAUSE / RESUME</button><button type="button" data-action="fullscreen">CLOSE FULLSCREEN</button>';featureNote.before(fullbar);
  fullbar.addEventListener('click',e=>{const b=e.target.closest('button');if(b)action(b.dataset.action);});
  let fullScroll=0,oldOverflow='',fullAnchor=null;
  function toggleFullscreen(){
    const opening=!homeFeature.classList.contains('arcade-fullscreen');
    if(opening){fullScroll=scrollY;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';fullAnchor=document.createElement('div');fullAnchor.style.height=homeFeature.getBoundingClientRect().height+'px';homeFeature.before(fullAnchor);document.body.append(homeFeature);}
    homeFeature.classList.toggle('arcade-fullscreen',opening);
    if(!opening){fullAnchor.replaceWith(homeFeature);fullAnchor=null;document.body.style.overflow=oldOverflow;window.scrollTo({top:fullScroll,behavior:'instant'});}
    requestAnimationFrame(resize);
  }
  const gameMenu = featureNote.querySelector('.home-game-console');
  const snakeLaunch = document.createElement('button'); snakeLaunch.type='button'; snakeLaunch.className='arcade-launch'; snakeLaunch.dataset.start='snake'; snakeLaunch.textContent='SNAKE / PLAY';
  const tetrisLaunch = document.createElement('button'); tetrisLaunch.type='button'; tetrisLaunch.className='arcade-launch'; tetrisLaunch.dataset.start='tetris'; tetrisLaunch.textContent='TETRIS / PLAY';
  gameMenu.append(snakeLaunch,tetrisLaunch);
  const status = ui.querySelector('.arcade-status'), help = ui.querySelector('.arcade-help');
  let game = null, busy = false, paused = false, ended = false, frame = 0, last = 0, elapsed = 0, scoreSubmitted = false;
  let cols, rows, snake, direction, turns, food, score, board, piece, bag, next, lines, clearing = [], clearTime = 0;
  let savedNote, savedStatus, savedFormat, savedMinHeight;
  const snakeSkullyMask = [
    '000000101111111000000000','000000111111111110000000','000011111111111111100000','000011111111111111010000',
    '000111111111110111101000','001111111111111111100100','011111010111111110010010','010111111110110111110110',
    '111111111111111111101100','111111111101111111110100','111111111101110011111100','111111111111111011111111',
    '000111000001111111101001','000111000000111110001101','000101110000111110110010','111000111101110011110100',
    '111000010000001110100000','001111110110011110000000','000111111001111101000000','000111110111010000100000',
    '000011111110001111100000','000001001100000111110000','000000000000001001110000','000011001100011111110000',
    '000000000100111101010000','000000000100101111010000','000000001000101010100000','000000000010011110000000',
    '000000011000110100000000','000000000000001000000000','000000001101110000000000','000000000100000000000000'
  ];
  const skullySprites = new Map();
  const shapes = { I:[[0,1],[1,1],[2,1],[3,1]], O:[[1,0],[2,0],[1,1],[2,1]], T:[[1,0],[0,1],[1,1],[2,1]], S:[[1,0],[2,0],[0,1],[1,1]], Z:[[0,0],[1,0],[1,1],[2,1]], J:[[0,0],[0,1],[1,1],[2,1]], L:[[2,0],[0,1],[1,1],[2,1]] };
  function nextPreview(type) {
    const occupied = new Set((shapes[type] || []).map(([x,y])=>`${x}:${y}`));
    return `<span class="tetris-next" aria-label="${type} piece">${Array.from({length:8},(_,index)=>`<i class="${occupied.has(`${index % 4}:${Math.floor(index / 4)}`)?"is-filled":""}"></i>`).join("")}</span>`;
  }
  function note() {
    const state=ended ? (game === 'snake' && snake.length === cols*rows ? 'CLEAR' : 'GAME OVER') : paused ? 'PAUSED' : 'PLAYING';
    status.textContent = `${game.toUpperCase()} / ${state} / ${score}${game === 'tetris' ? ` / ${lines} LINES / NEXT ${next}` : ''}`;
    if (!game) return;
    if (ended && !scoreSubmitted) {
      scoreSubmitted = true;
      window.portfolioScores?.submit(game,score,game === 'tetris' ? lines : 0);
    }
    const record = window.portfolioScores?.get(game) || { score:0, secondary:0 };
    featureStatusCopy.innerHTML = game === 'tetris'
      ? `${state}<br>${score} points · ${lines} lines<br>NEXT ${nextPreview(next)}<br>HIGH SCORE<br>${record.score} points · ${record.secondary} lines`
      : `${state}<br>${score} points<br>HIGH SCORE<br>${record.score} points`;
  }
  function resize() { const r=homeMosaic.getBoundingClientRect(), d=devicePixelRatio||1; canvas.width=Math.round(r.width*d); canvas.height=Math.round(r.height*d); homeFeature.style.setProperty('--pad-top',featureNote.offsetTop+'px'); skullySprites.clear(); if(game) draw(); }
  new ResizeObserver(resize).observe(homeMosaic);
  function randomFood() { const free=[]; for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(!snake.some(p=>p.x===x&&p.y===y))free.push({x,y}); return free[Math.floor(Math.random()*free.length)]; }
  function take() { if(!bag.length) { bag=Object.keys(shapes); for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];} } return bag.pop(); }
  let pieceGeneration=0;
  function spawn() { const type=next; next=take(); piece={id:++pieceGeneration,type,x:3,y:0,cells:shapes[type].map(p=>[...p])}; if(!fits(piece))ended=true; }
  function fits(p) { return p.cells.every(([x,y])=>{x+=p.x;y+=p.y;return x>=0&&x<cols&&y>=0&&y<rows&&!board[y][x];}); }
  function reset() {
    paused=false;ended=false;elapsed=0;last=0;score=0;lines=0;clearing=[];clearTime=0;scoreSubmitted=false;
    if(game==='snake') { snake=[{x:8,y:13},{x:7,y:13},{x:6,y:13}];direction={x:1,y:0};turns=[];food=randomFood(); }
    else { board=Array.from({length:rows},()=>Array(cols).fill(0));bag=[];next=take();spawn(); }
    note();draw();
  }
  function move(dx,dy) { const p={...piece,x:piece.x+dx,y:piece.y+dy};if(fits(p)){piece=p;return true;}return false; }
  function lock() {
    for(const[x,y]of piece.cells)board[piece.y+y][piece.x+x]=1;
    clearing=board.flatMap((r,i)=>r.every(Boolean)?[i]:[]);
    if(clearing.length)clearTime=180;else spawn(); elapsed=0;
  }
  function action(a) {
    if(!game||busy)return;
    if(a==='fullscreen'){toggleFullscreen();return;}
    if(a==='exit'){stop();return;} if(a==='reset'){reset();return;}
    if(a==='pause'){paused=!paused;last=0;note();draw();return;}
    if(paused||ended)return;
    if(game==='snake') {
      const d={left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}}[a];
      const prev=turns.at(-1)||direction;if(d&&turns.length<2&&(d.x!==prev.x||d.y!==prev.y)&&!(d.x===-prev.x&&d.y===-prev.y))turns.push(d);
    } else if(!clearing.length) {
      if(a==='left')move(-1,0);if(a==='right')move(1,0);
      if(a==='down'){if(move(0,1))score++;else lock();elapsed=0;}
      if(a==='up'&&piece.type!=='O') { const center=piece.type==='I'?1.5:1; const cells=piece.cells.map(([x,y])=>[center-(y-center),center+(x-center)]);for(const [dx,dy]of[[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[0,-2]]){const p={...piece,cells,x:piece.x+dx,y:piece.y+dy};if(fits(p)){piece=p;break;}} }
      if(a==='drop'){while(move(0,1))score+=2;lock();}
    }
    note();draw();
  }
  function tick(dt) {
    if(game==='tetris'&&clearing.length){clearTime-=dt;if(clearTime<=0){board=board.filter((_,i)=>!clearing.includes(i));const n=clearing.length;while(board.length<rows)board.unshift(Array(cols).fill(0));score+=[0,100,300,500,800][n]*(1+Math.floor(lines/10));lines+=n;clearing=[];spawn();note();}return;}
    elapsed+=dt;
    const speed=game==='snake'?Math.max(80,190-score*3):Math.max(90,700-Math.floor(lines/10)*65);
    if(elapsed<speed)return;elapsed-=speed;
    if(game==='snake') {
      if(turns.length)direction=turns.shift();
      const head={x:(snake[0].x+direction.x+cols)%cols,y:(snake[0].y+direction.y+rows)%rows};
      const eats=head.x===food.x&&head.y===food.y;
      if(snake.slice(0,eats?snake.length:-1).some(p=>p.x===head.x&&p.y===head.y)){ended=true;note();return;}
      snake.unshift(head);if(eats){score++;food=randomFood();if(!food)ended=true;}else snake.pop();
    } else if(!move(0,1))lock();note();
  }
  function draw() {
    if(!game || (game==='snake' ? !snake : !board || !piece))return;
    const w=canvas.width,h=canvas.height,d=devicePixelRatio||1;
    const squareUnit=Math.min(w/cols,h/rows),cellW=game==='tetris'?w/cols:squareUnit,cellH=game==='tetris'?h/rows:squareUnit;
    const ox=(w-cols*cellW)/2,oy=(h-rows*cellH)/2;
    const css=getComputedStyle(document.documentElement), ink=css.getPropertyValue('--ink').trim(), accent=css.getPropertyValue('--accent').trim(), grid=css.getPropertyValue('--grid-line').trim();
    ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(0,0,0,.16)';ctx.fillRect(0,0,w,h);
    if(game==='tetris'){ctx.fillStyle=grid;for(let x=0;x<=cols;x++)ctx.fillRect(Math.round(ox+x*cellW),oy,d,rows*cellH);for(let y=0;y<=rows;y++)ctx.fillRect(ox,Math.round(oy+y*cellH),cols*cellW,d);}
    const cell=(x,y,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(ox+x*cellW+d,oy+y*cellH+d,cellW-2*d,cellH-2*d);ctx.globalAlpha=1;};
    const glowCell=(x,y,color,alpha=.14)=>{
      const x0=ox+x*cellW+d,y0=oy+y*cellH+d,cw=cellW-2*d,ch=cellH-2*d;
      const glow=ctx.createRadialGradient(x0+cw/2,y0+ch/2,0,x0+cw/2,y0+ch/2,Math.max(cw,ch)*.72);
      glow.addColorStop(0,color);glow.addColorStop(.52,color);glow.addColorStop(1,'transparent');
      ctx.globalAlpha=alpha;ctx.fillStyle=glow;ctx.fillRect(x0,y0,cw,ch);ctx.globalAlpha=1;
    };
    const skullySprite=(color,size)=>{
      const key=`${color}/${Math.round(size)}`;
      if(skullySprites.has(key))return skullySprites.get(key);
      const sprite=document.createElement('canvas'),pixel=Math.max(1,size/snakeSkullyMask.length);
      sprite.width=Math.ceil(snakeSkullyMask[0].length*pixel);sprite.height=Math.ceil(snakeSkullyMask.length*pixel);
      const spriteCtx=sprite.getContext('2d');spriteCtx.fillStyle=color;
      snakeSkullyMask.forEach((row,sy)=>{for(let sx=0;sx<row.length;sx++)if(row[sx]==='1')spriteCtx.fillRect(sx*pixel,sy*pixel,pixel*1.06,pixel*1.06);});
      skullySprites.set(key,sprite);return sprite;
    };
    const skully=(x,y,color,alpha=1)=>{
      const cellX=ox+x*cellW,cellY=oy+y*cellH,pad=Math.min(cellW,cellH)*.14;
      const available=Math.min(cellW,cellH)-pad*2,sprite=skullySprite(color,available);
      const ratio=Math.min(available/sprite.width,available/sprite.height),skullW=sprite.width*ratio,skullH=sprite.height*ratio;
      const startX=cellX+(cellW-skullW)/2,startY=cellY+(cellH-skullH)/2;
      ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,startX,startY,skullW,skullH);ctx.globalAlpha=1;
    };
    if(game==='snake'){snake.forEach((p,i)=>{cell(p.x,p.y,i===0?accent:'#fff',i===0?.9:.18);glowCell(p.x,p.y,'#fff',i===0?.4:.3);skully(p.x,p.y,'#080908',i===0?1:.9);});if(food){cell(food.x,food.y,accent,.9);glowCell(food.x,food.y,'#fff',.4);skully(food.x,food.y,'#080908',1);}}
    else {
      const tetrisBlock=(x,y,alpha=1,active=false)=>{cell(x,y,active?accent:'#fff',alpha*(active?.9:.18));glowCell(x,y,'#fff',alpha*(active?.4:.32));skully(x,y,'#080908',alpha);};
      board.forEach((r,y)=>r.forEach((v,x)=>{if(v)tetrisBlock(x,y,clearing.includes(y)?.32:.92);}));
      if(!clearing.length){
        let ghost={...piece};while(fits({...ghost,y:ghost.y+1}))ghost.y++;
        ghost.cells.forEach(([x,y])=>{cell(ghost.x+x,ghost.y+y,accent,.08);glowCell(ghost.x+x,ghost.y+y,accent,.16);skully(ghost.x+x,ghost.y+y,accent,.34);});
        piece.cells.forEach(([x,y])=>tetrisBlock(piece.x+x,piece.y+y,1,true));
      }
    }
    if(paused||ended){ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(0,0,w,h);ctx.fillStyle=ink;ctx.font=`${16*d}px monospace`;ctx.textAlign='center';ctx.fillText(paused?'PAUSED':'GAME OVER',w/2,h/2);}
  }
  function loop(time) { if(!game)return;const dt=last?Math.min(60,time-last):0;last=time;if(!paused&&!ended&&!busy)tick(dt);draw();frame=requestAnimationFrame(loop); }
  async function start(kind) {
    if(game||busy||homeGameActive()||morphing)return;busy=true;window.arcadeGameActive=true;game=kind;cols=kind==='snake'?18:10;rows=kind==='snake'?26:20;
    savedNote=featureNoteCopy.textContent;savedStatus=featureStatusCopy.innerHTML;savedFormat=featureFormatCopy.textContent;savedMinHeight=workGrid.style.minHeight;
    const gridStyle=getComputedStyle(workGrid),gridBox=workGrid.getBoundingClientRect();
    const gridPadding=parseFloat(gridStyle.paddingTop)+parseFloat(gridStyle.paddingBottom)+parseFloat(gridStyle.borderTopWidth)+parseFloat(gridStyle.borderBottomWidth);
    workGrid.style.minHeight=`${Math.max(0,gridBox.height-gridPadding)}px`;
    freezeHomeGlitches(false);activeGlitchTiles.clear();
    await morphHomeGameGrid(cols,rows,()=>{setHomeGridDimensions(cols,rows);homeMosaic.classList.add('arcade-mode');canvas.hidden=false;});
    document.querySelectorAll('.arcade-launch').forEach(b=>b.hidden=true);featureNote.classList.add('arcade-note');ui.hidden=false;status.hidden=true;help.hidden=true;ui.querySelector('.arcade-controls').hidden=false;
    dpad.hidden=false;dpad.querySelector('[data-action=drop]').hidden=kind!=='tetris';
    featureNoteCopy.textContent=kind==='snake'?'SNAKE — tap, swipe or D-pad. Collect red skulls; avoid your tail. Edges loop.':'TETRIS — tap / ↑ rotates. Drag to move. Hold ↓ to lower; DROP lands.';
    featureFormatCopy.textContent=kind==='snake'?'18 × 26 grid':'10 × 20 grid';
    resize();reset();busy=false;frame=requestAnimationFrame(loop);
  }
  async function stop() {
    if(busy)return;busy=true;cancelAnimationFrame(frame);
    if(homeFeature.classList.contains('arcade-fullscreen'))toggleFullscreen();
    stopPad();dpad.hidden=true;
    await morphHomeGameGrid(mosaicColumns,mosaicRows,()=>{homeMosaic.classList.remove('arcade-mode');canvas.hidden=true;setHomeGridDimensions(mosaicColumns,mosaicRows);},false);
    game=null;window.arcadeGameActive=false;busy=false;featureNote.classList.remove('arcade-note');status.hidden=true;help.hidden=true;ui.querySelector('.arcade-controls').hidden=true;ui.hidden=true;document.querySelectorAll('.arcade-launch').forEach(b=>b.hidden=false);
    featureNoteCopy.textContent=savedNote;featureStatusCopy.innerHTML=savedStatus;featureFormatCopy.textContent=savedFormat;workGrid.style.minHeight=savedMinHeight;releaseHomeGlitches();
  }
  [snakeLaunch,tetrisLaunch].forEach(button=>button.addEventListener('click',()=>start(button.dataset.start)));
  ui.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.dataset.action)action(b.dataset.action);});
  let padTimer=0;
  function stopPad(){clearTimeout(padTimer);padTimer=0;}
  dpad.addEventListener('pointerdown',e=>{
    const b=e.target.closest('button');if(!b||!e.isPrimary)return;
    e.preventDefault();e.stopPropagation();stopPad();b.setPointerCapture(e.pointerId);
    const a=b.dataset.action;action(a);
    if(game==='tetris'&&['left','right','down'].includes(a)){
      const repeat=()=>{action(a);padTimer=setTimeout(repeat,a==='down'?45:70);};
      padTimer=setTimeout(repeat,160);
    }
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>dpad.addEventListener(type,stopPad));
  window.addEventListener('blur',stopPad);
  window.addEventListener('keydown',e=>{if(!game||e.target.closest('input,textarea,select'))return;const key=e.key.length===1?e.key.toLowerCase():e.key;const a={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',' ':'drop',p:'pause',Escape:'pause'}[key];if(a){e.preventDefault();if(!e.repeat||!['drop','pause','up'].includes(a))action(a);}},true);
  let pointer=null;
  canvas.addEventListener('pointerdown',e=>{
    pointer={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,id:e.pointerId,time:performance.now(),moved:false,softSteps:0,pieceId:piece?.id};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId||game!=='tetris'||paused||ended||busy)return;
    if(pointer.pieceId!==piece?.id)return;
    const rect=canvas.getBoundingClientRect(),stepWidth=rect.width/cols,stepHeight=rect.height/rows;
    let stepX=e.clientX-pointer.lastX,stepY=e.clientY-pointer.lastY;
    while(Math.abs(stepX)>=stepWidth*.55&&pointer.pieceId===piece?.id){action(stepX>0?'right':'left');pointer.lastX+=Math.sign(stepX)*stepWidth*.55;stepX=e.clientX-pointer.lastX;pointer.moved=true;}
    while(stepY>=stepHeight*.5&&pointer.pieceId===piece?.id){action('down');pointer.lastY+=stepHeight*.5;stepY=e.clientY-pointer.lastY;pointer.moved=true;pointer.softSteps++;}
  });
  canvas.addEventListener('pointerup',e=>{
    if(!pointer)return;
    const gesture=pointer,dx=e.clientX-gesture.x,dy=e.clientY-gesture.y,duration=performance.now()-gesture.time;pointer=null;
    if(game==='tetris'){
      if(gesture.pieceId!==piece?.id)return;
      if(Math.hypot(dx,dy)<15&&!gesture.moved)action('up');
      else if(dy>38&&duration<350&&Math.abs(dy)>Math.abs(dx)*1.2)action('drop');
      return;
    }
    if(Math.hypot(dx,dy)<15){
      if(game==='snake'&&snake?.length){
        const rect=canvas.getBoundingClientRect(),head=snake[0];
        const unit=Math.min(rect.width/cols,rect.height/rows),ox=(rect.width-cols*unit)/2,oy=(rect.height-rows*unit)/2;
        const targetX=(e.clientX-rect.left-ox)/unit,targetY=(e.clientY-rect.top-oy)/unit;
        const relativeX=targetX-(head.x+.5),relativeY=targetY-(head.y+.5);
        if(Math.abs(relativeX)>Math.abs(relativeY))action(relativeX>0?'right':'left');
        else if(relativeY!==0)action(relativeY>0?'down':'up');
      }
      return;
    }
    action(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');
  });
  canvas.addEventListener('pointercancel',()=>pointer=null);
  canvas.addEventListener('wheel',e=>{if(game)e.preventDefault();},{passive:false});
  document.addEventListener('visibilitychange',()=>{if(game&&document.hidden){paused=true;note();}});
  window.addEventListener('portfolio-scores:update',()=>{if(game)note();});
  // Disable game launchers while another game owns the Home board.
  new MutationObserver(()=>{document.querySelectorAll('.arcade-launch').forEach(b=>b.disabled=memoryActive||minesActive);}).observe(homeMosaic,{attributes:true,attributeFilter:['class']});
})();
