import './style.scss';

/* -------------------- types -------------------- */
type CatJson = {
  id: string;
  url: string;   // final image url
  tags?: string[];
};

/* -------------------- constants -------------------- */
const API = 'https://cataas.com';
const DEFAULT_TOTAL = 15;
const COUNTED_FLAG = 'counted';

const CAT_PROFILES = [
  { name: "Whiskers", fact: "Loves chasing laser pointers.", personality: "Playful" },
  { name: "Mittens", fact: "Sleeps 16 hours a day.", personality: "Chill" },
  { name: "Tiger", fact: "Enjoys climbing curtains.", personality: "Adventurous" },
  { name: "Shadow", fact: "Hides in boxes.", personality: "Curious" },
  { name: "Luna", fact: "Purrs loudly when happy.", personality: "Affectionate" },
];

/* -------------------- DOM refs -------------------- */
const STACK    = document.getElementById('stack') as HTMLDivElement;
const SUMMARY  = document.getElementById('summary') as HTMLElement;
const LIKE_CNT = document.getElementById('like-count') as HTMLElement;
const GRID     = document.getElementById('liked-grid') as HTMLElement;
const BAR      = document.getElementById('progress-bar') as HTMLDivElement;
const BTN_AGAIN= document.getElementById('btn-restart') as HTMLButtonElement;

const MEOW_SOUND = new Audio(new URL('./meow.mp3', import.meta.url).toString());
/* -------------------- state -------------------- */
let cats: CatJson[] = [];
let liked: string[] = [];
let processed = 0;
let totalCount = 0;
let finished = false;

/* -------------------- data -------------------- */
async function fetchCat(): Promise<CatJson> {
  const res = await fetch(`${API}/cat?json=true`, {
    headers: { accept: 'application/json' },
    cache: 'no-cache',
  });
  if (!res.ok) throw new Error('CATAAS request failed');
  const data = await res.json();
  return { id: data.id, url: `${API}/cat/${data.id}`, tags: data.tags ?? [] };
}

async function loadCats(n = DEFAULT_TOTAL) {
  // show loading
  document.getElementById('loading-screen')!.style.display = 'flex';
  
  finished = false;
  SUMMARY.hidden = true;
  STACK.style.display = 'none'; // hide cards for now
  cats = [];
  liked = [];
  processed = 0;
  updateProgress(0);

  for (let i = 0; i < n; i++) {
    try {
      cats.push(await fetchCat());
      await sleep(120);
    } catch {
      cats.push({ id: `${Date.now()}_${i}`, url: `${API}/cat`, tags: [] });
    }
  }

  totalCount = cats.length;
  processed = 0;

  // preload images
  await Promise.all(
    cats.map(
      c =>
        new Promise<void>(resolve => {
          const img = new Image();
          img.src = `${c.url}?width=900&height=1200`;
          img.onload = img.onerror = () => resolve();
        }),
    ),
  );

  // hide loading and show stack
  document.getElementById('loading-screen')!.style.display = 'none';
  STACK.style.display = '';
  renderStack();
}

/* -------------------- render -------------------- */
function renderStack() {
  STACK.innerHTML = '';

  cats.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.zIndex = String(i);
    card.dataset.url = c.url;

    // tagline
    const tagline = document.createElement('div');
    tagline.className = 'card-tagline';
    const paw = document.createElement('img');
    paw.src = new URL('./paw.png', import.meta.url).toString();
    paw.alt = 'Paw';
    paw.className = 'paw-icon';
    const strong = document.createElement('strong');
    strong.textContent = 'Find Your Purrfect Match';
    tagline.append(paw, strong);
    card.appendChild(tagline);

    // image
    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-img-area';
    const img = document.createElement('img');
    img.className = 'card-img';
    img.alt = 'Cat';
    img.src = `${c.url}?width=900&height=1200`;
    imgWrap.appendChild(img);
    card.appendChild(imgWrap);

     // profile
    const profile = CAT_PROFILES[Math.floor(Math.random() * CAT_PROFILES.length)];
    const profileDiv = document.createElement('div');
    profileDiv.className = 'cat-profile';
    profileDiv.innerHTML = `
      <div><strong>Name:</strong> ${profile.name}</div>
      <div><strong>Personality:</strong> ${profile.personality}</div>
      <div><em>${profile.fact}</em></div>
    `;
    card.appendChild(profileDiv);

    // actions
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const btnNope = document.createElement('button');
    btnNope.className = 'btn btn-ghost';
    const nopeImg = document.createElement('img');
    nopeImg.className = 'btn-icon';
    nopeImg.alt = 'Dislike';
    nopeImg.src = new URL('./dislike.png', import.meta.url).toString();
    btnNope.appendChild(nopeImg);

    const btnLike = document.createElement('button');
    btnLike.className = 'btn btn-primary';
    const likeImg = document.createElement('img');
    likeImg.className = 'btn-icon';
    likeImg.alt = 'Like';
    likeImg.src = new URL('./like.png', import.meta.url).toString();
    btnLike.appendChild(likeImg);

    // prevent drag interference
    [btnLike, btnNope].forEach(btn => {
      ['pointerdown', 'pointerup', 'pointermove'].forEach(ev =>
        btn.addEventListener(ev, e => e.stopPropagation())
      );
    });

    // clicks
    btnNope.addEventListener('click', () => programmaticSwipe(false));
    btnLike.addEventListener('click', () => programmaticSwipe(true));

    actions.append(btnNope, btnLike);
    card.appendChild(actions);

    attachDrag(card);
    STACK.appendChild(card);
  });
}

/* -------------------- swipe / drag -------------------- */
function attachDrag(card: HTMLDivElement) {
  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;

  const isFromButtons = (t: EventTarget | null) =>
    (t as HTMLElement | null)?.closest?.('.card-actions') != null;

  const onDown = (e: PointerEvent) => {
    if (isFromButtons(e.target)) return; 
    dragging = true;
    card.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY;
    card.classList.add('moving');
    card.classList.remove('like', 'pass');
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    card.style.boxShadow = `0 26px 60px rgba(0,0,0,${Math.min(0.55, Math.abs(dx)/280)})`;
    if (dx > 20) card.classList.add('like'); else card.classList.remove('like');
    if (dx < -20) card.classList.add('pass'); else card.classList.remove('pass');
  };

  const finalize = (isLike: boolean) => {
  card.classList.remove('moving');
  const url = card.dataset.url;

  if (isLike && url) liked.push(url);

  // add effects on like
  if (isLike) {
    MEOW_SOUND.currentTime = 0;
    MEOW_SOUND.play().catch(() => {}); 
    showConfetti();
  }

  card.remove();
  if (STACK.children.length === 0 || processed >= totalCount) showSummary();
};

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    const threshold = 120;

    if (dx > threshold) {
      bumpProgress(card);
      card.classList.add('swipe-right');
      card.addEventListener('transitionend', () => finalize(true), { once: true });
    } else if (dx < -threshold) {
      bumpProgress(card);
      card.classList.add('swipe-left');
      card.addEventListener('transitionend', () => finalize(false), { once: true });
    } else {
      card.style.transform = '';
      card.style.boxShadow = '';
      card.classList.remove('like', 'pass', 'moving');
    }
    dx = dy = 0;
  };

  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup', onUp);
}

/* count a swipe */
function bumpProgress(card?: HTMLElement) {
  if (card && (card as any).dataset[COUNTED_FLAG] === '1') return;
  if (card) (card as any).dataset[COUNTED_FLAG] = '1';

  processed = Math.min(processed + 1, totalCount);
  updateProgress(totalCount ? (processed / totalCount) * 100 : 0);
}

/* programmatic click (buttons) */
function programmaticSwipe(like: boolean) {
  const top = STACK.lastElementChild as HTMLDivElement | null;
  if (!top) return;

  const url = top.dataset.url || null;
  bumpProgress(top);

  requestAnimationFrame(() => {
    if (like) {
      MEOW_SOUND.currentTime = 0;
      MEOW_SOUND.play().catch(() => {});
      showConfetti();
    }

    top.classList.add(like ? 'swipe-right' : 'swipe-left');
    top.addEventListener('transitionend', () => {
      if (like && url) liked.push(url);
      top.remove();
      if (STACK.children.length === 0 || processed >= totalCount) showSummary();
    }, { once: true });

    setTimeout(() => {
      if (!document.body.contains(top)) return;
      if (like && url) liked.push(url);
      top.remove();
      if (STACK.children.length === 0 || processed >= totalCount) showSummary();
    }, 350);
  });
}

/* -------------------- confetti -------------------- */
function showConfetti() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti';
  confetti.innerHTML = '🎉';
  confetti.style.position = 'fixed';
  confetti.style.left = '50%';
  confetti.style.top = '55%';
  confetti.style.fontSize = '5rem';
  confetti.style.transform = 'translate(-50%, -50%)';
  confetti.style.pointerEvents = 'none';
  confetti.style.zIndex = '9999';
  document.body.appendChild(confetti);
  setTimeout(() => confetti.remove(), 1200);
}

/* -------------------- summary -------------------- */
function showSummary() {
  if (finished) return;
  finished = true;

  LIKE_CNT.textContent = String(liked.length);
  GRID.innerHTML = '';
  liked.forEach(u => {
    const img = document.createElement('img');
    img.src = `${u}?width=500&height=666`;
    img.alt = 'Liked cat';
    GRID.appendChild(img);
  });

  STACK.style.display = 'none';
  SUMMARY.hidden = false;
  SUMMARY.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* -------------------- utils -------------------- */
function updateProgress(pct: number) {
  if (BAR) BAR.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/* -------------------- init -------------------- */
BTN_AGAIN?.addEventListener('click', () => loadCats());
loadCats().catch(console.error);
