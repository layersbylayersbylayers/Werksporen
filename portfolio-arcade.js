/* Local V2 arcade. Memory and Mines retain their own game implementations. */
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .home-mosaic.arcade-mode > .home-tile, .home-mosaic.arcade-mode::after { visibility:hidden; }
    .arcade-canvas { position:absolute; inset:0; width:100%; height:100%; z-index:7; touch-action:none; }
    .arcade-console { display:flex; flex-wrap:wrap; align-content:start; min-height:300px; gap:8px 12px; padding-top:10px; font:10px/1.4 var(--mono); }
    .arcade-console button { font:inherit; color:var(--accent); border:1px solid var(--hairline); background:transparent; padding:6px 9px; cursor:pointer; }
    .arcade-console [hidden], .arcade-canvas[hidden] { display:none; }
    .arcade-help { flex-basis:100%; color:var(--soft); }
    .arcade-status { flex-basis:100%; color:var(--accent); }
    .arcade-controls { display:flex; flex-wrap:wrap; gap:6px; }
    .arcade-controls button { min-width:40px; min-height:40px; touch-action:manipulation; }
    .home-feature:has(.arcade-mode) .home-game-console { visibility:hidden; }
    @media(max-width:700px) { .overview-work.show-feature .feature-note > p:first-child { min-height:75px; } }
  `;
  document.head.append(style);
  const canvas = document.createElement('canvas');
  canvas.className = 'arcade-canvas'; canvas.hidden = true;
  canvas.setAttribute('aria-label','Game board'); homeMosaic.append(canvas);
  const ctx = canvas.getContext('2d');
  const ui = document.createElement('div'); ui.className = 'arcade-console';
  ui.innerHTML = `<button data-start="snake">SNAKE / PLAY</button><button data-start="tetris">TETRIS / PLAY</button>
    <div class="arcade-status" role="status" hidden></div><div class="arcade-help" hidden></div>
    <div class="arcade-controls" hidden><button data-action="left" aria-label="Left">←</button><button data-action="up" aria-label="Up or rotate">↑</button><button data-action="down" aria-label="Down">↓</button><button data-action="right" aria-label="Right">→</button><button data-action="drop">DROP</button><button data-action="pause">PAUSE</button><button data-action="reset">RESET</button><button data-action="exit">EXIT</button></div>`;
  featureNote.append(ui);
  const status = ui.querySelector('.arcade-status'), help = ui.querySelector('.arcade-help');
  let game = null, busy = false, paused = false, ended = false, frame = 0, last = 0, elapsed = 0;
  let cols, rows, snake, direction, turns, food, score, board, piece, bag, next, lines, clearing = [], clearTime = 0;
  let savedNote, savedMinHeight;
  const shapes = { I:[[0,1],[1,1],[2,1],[3,1]], O:[[1,0],[2,0],[1,1],[2,1]], T:[[1,0],[0,1],[1,1],[2,1]], S:[[1,0],[2,0],[0,1],[1,1]], Z:[[0,0],[1,0],[1,1],[2,1]], J:[[0,0],[0,1],[1,1],[2,1]], L:[[2,0],[0,1],[1,1],[2,1]] };
  function note() {
    status.textContent = `${game.toUpperCase()} / ${ended ? (game === 'snake' && snake.length === cols*rows ? 'CLEAR' : 'GAME OVER') : paused ? 'PAUSED' : 'PLAYING'} / ${score}${game === 'tetris' ? ` / ${lines} LINES / NEXT ${next}` : ''}`;
  }
  function resize() { const r=homeMosaic.getBoundingClientRect(), d=devicePixelRatio||1; canvas.width=Math.round(r.width*d); canvas.height=Math.round(r.height*d); if(game) draw(); }
  new ResizeObserver(resize).observe(homeMosaic);
  function randomFood() { const free=[]; for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(!snake.some(p=>p.x===x&&p.y===y))free.push({x,y}); return free[Math.floor(Math.random()*free.length)]; }
  function take() { if(!bag.length) { bag=Object.keys(shapes); for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];} } return bag.pop(); }
  function spawn() { const type=next; next=take(); piece={type,x:3,y:0,cells:shapes[type].map(p=>[...p])}; if(!fits(piece))ended=true; }
  function fits(p) { return p.cells.every(([x,y])=>{x+=p.x;y+=p.y;return x>=0&&x<cols&&y>=0&&y<rows&&!board[y][x];}); }
  function reset() {
    paused=false;ended=false;elapsed=0;last=0;score=0;lines=0;clearing=[];clearTime=0;
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
      if(turns.length)direction=turns.shift();const head={x:snake[0].x+direction.x,y:snake[0].y+direction.y};const eats=head.x===food.x&&head.y===food.y;
      if(head.x<0||head.x>=cols||head.y<0||head.y>=rows||snake.slice(0,eats?snake.length:-1).some(p=>p.x===head.x&&p.y===head.y)){ended=true;note();return;}
      snake.unshift(head);if(eats){score++;food=randomFood();if(!food)ended=true;}else snake.pop();
    } else if(!move(0,1))lock();note();
  }
  function draw() {
    if(!game || (game==='snake' ? !snake : !board || !piece))return;
    const w=canvas.width,h=canvas.height,d=devicePixelRatio||1,unit=Math.min(w/cols,h/rows),ox=(w-cols*unit)/2,oy=(h-rows*unit)/2;
    const css=getComputedStyle(document.documentElement), ink=css.getPropertyValue('--ink').trim(), accent=css.getPropertyValue('--accent').trim(), grid=css.getPropertyValue('--grid-line').trim();
    ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(0,0,0,.16)';ctx.fillRect(0,0,w,h);
    if(game==='tetris'){ctx.fillStyle=grid;for(let x=0;x<=cols;x++)ctx.fillRect(Math.round(ox+x*unit),oy,d,rows*unit);for(let y=0;y<=rows;y++)ctx.fillRect(ox,Math.round(oy+y*unit),cols*unit,d);}
    const cell=(x,y,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(ox+x*unit+d,oy+y*unit+d,unit-2*d,unit-2*d);ctx.globalAlpha=1;};
    if(game==='snake'){snake.forEach((p,i)=>cell(p.x,p.y,i===0?accent:ink,.9));if(food)cell(food.x,food.y,accent);}
    else {board.forEach((r,y)=>r.forEach((v,x)=>{if(v)cell(x,y,ink,clearing.includes(y)?.35:.85);}));if(!clearing.length){let ghost={...piece};while(fits({...ghost,y:ghost.y+1}))ghost.y++;ghost.cells.forEach(([x,y])=>cell(ghost.x+x,ghost.y+y,ink,.18));piece.cells.forEach(([x,y])=>cell(piece.x+x,piece.y+y,accent));}}
    if(paused||ended){ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(0,0,w,h);ctx.fillStyle=ink;ctx.font=`${16*d}px monospace`;ctx.textAlign='center';ctx.fillText(paused?'PAUSED':'GAME OVER',w/2,h/2);}
  }
  function loop(time) { if(!game)return;const dt=last?Math.min(60,time-last):0;last=time;if(!paused&&!ended&&!busy)tick(dt);draw();frame=requestAnimationFrame(loop); }
  async function start(kind) {
    if(game||busy||homeGameActive()||morphing)return;busy=true;window.arcadeGameActive=true;game=kind;cols=kind==='snake'?18:10;rows=kind==='snake'?26:20;
    savedNote=featureNoteCopy.textContent;savedMinHeight=workGrid.style.minHeight;workGrid.style.minHeight=`${workGrid.getBoundingClientRect().height}px`;
    freezeHomeGlitches(false);activeGlitchTiles.clear();
    await morphHomeGameGrid(cols,rows,()=>{setHomeGridDimensions(cols,rows);homeMosaic.classList.add('arcade-mode');canvas.hidden=false;});
    ui.querySelectorAll('[data-start]').forEach(b=>b.hidden=true);status.hidden=false;help.hidden=false;ui.querySelector('.arcade-controls').hidden=false;ui.querySelector('[data-action="drop"]').hidden=kind==='snake';
    help.textContent=kind==='snake'?'Arrow keys / WASD, swipe inside the board, or use the buttons.':'← → move · ↑ rotate · ↓ soft drop · SPACE drop. Touch: buttons or swipe; tap to rotate.';
    featureNoteCopy.textContent=kind==='snake'?'SNAKE — collect the accent squares. Avoid the edges and your tail.':'TETRIS — complete horizontal rows. Keep the stack below the top.';
    resize();reset();busy=false;frame=requestAnimationFrame(loop);
  }
  async function stop() {
    if(busy)return;busy=true;cancelAnimationFrame(frame);
    await morphHomeGameGrid(mosaicColumns,mosaicRows,()=>{homeMosaic.classList.remove('arcade-mode');canvas.hidden=true;setHomeGridDimensions(mosaicColumns,mosaicRows);},false);
    game=null;window.arcadeGameActive=false;busy=false;status.hidden=true;help.hidden=true;ui.querySelector('.arcade-controls').hidden=true;ui.querySelectorAll('[data-start]').forEach(b=>b.hidden=false);
    featureNoteCopy.textContent=savedNote;workGrid.style.minHeight=savedMinHeight;releaseHomeGlitches();
  }
  ui.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.start)start(b.dataset.start);else action(b.dataset.action);});
  window.addEventListener('keydown',e=>{if(!game||e.target.closest('input,textarea,select'))return;const a={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',' ':'drop',p:'pause',Escape:'pause'}[e.key];if(a){e.preventDefault();if(!e.repeat||!['drop','pause','up'].includes(a))action(a);}},true);
  let pointer=null;
  canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointerup',e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;if(Math.hypot(dx,dy)<15){if(game==='tetris')action('up');return;}action(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');});
  canvas.addEventListener('pointercancel',()=>pointer=null);
  canvas.addEventListener('wheel',e=>{if(game)e.preventDefault();},{passive:false});
  document.addEventListener('visibilitychange',()=>{if(game&&document.hidden){paused=true;note();}});
  // Disable game launchers while another game owns the Home board.
  new MutationObserver(()=>{ui.querySelectorAll('[data-start]').forEach(b=>b.disabled=memoryActive||minesActive);}).observe(homeMosaic,{attributes:true,attributeFilter:['class']});
})();
