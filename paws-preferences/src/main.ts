// If style.scss is inside src/, use:
import './style.scss';
// If you moved style.scss to root, use:
// import '../style.scss';

type CatJson = {
  id: string;
  url: string;     // full image URL we build
  tags?: string[];
};

const API = 'https://cataas.com';

const STACK = document.getElementById('stack') as HTMLDivElement;
const SUMMARY = document.getElementById('summary') as HTMLElement;
const LIKE_COUNT = document.getElementById('like-count') as HTMLElement;
const LIKED_GRID = document.getElementById('liked-grid') as HTMLElement;

const BTN_LIKE = document.getElementById('btn-like') as HTMLButtonElement;
const BTN_DISLIKE = document.getElementById('btn-dislike') as HTMLButtonElement;
const BTN_RESTART = document.getElementById('btn-restart') as HTMLButtonElement;

const PROGRESS = document.getElementById('progress-bar') as HTMLDivElement;

const TOTAL = 15;

let cats: CatJson[] = [];
let likedUrls: string[] = [];
let processed = 0;

/* ----------------------------- data fetching ----------------------------- */

async function fetchCat(): Promise<CatJson> {
  const res = await fetch(`${API}/cat?json=true`, {
    headers: { accept: 'application/json' },
    cache: 'no-cache',
  });
  if (!res.ok) throw new Error('CATAAS request failed');
  const data = await res.json();
  // Build image URL using the id — reliably points to the image
  const url = `${API}/cat/${data.id}`;
  return { id: data.id, url, tags: data.tags ?? [] };
}

async function loadCats(n = TOTAL) {
  // reset UI
  SUMMARY.hidden = true;
  STACK.style.display = '';
  document.querySelector('.actions')?.classList.remove('hidden');

  cats = [];
  likedUrls = [];
  processed = 0;
  updateProgress(0);

  // fetch N cats
  for (let i = 0; i < n; i++) {
    try {
      const c = await fetchCat();
      cats.push(c);
      // small delay keeps free API happy
      await sleep(120);
    } catch {
      cats.push({ id: `${Date.now()}_${i}`, url: `${API}/cat`, tags: [] });
    }
  }

  // preload images for smoother swipes
  await Promise.all(
    cats.map(
      (c) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.src = `${c.url}?width=900&height=1200`;
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );

  renderStack();
}

/* ------------------------------ UI rendering ----------------------------- */

function renderStack() {
  STACK.innerHTML = '';
  cats.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.zIndex = String(1000 - i);
    card.style.backgroundImage = `url("${c.url}?width=900&height=1200")`;

    // tag badge
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = c.tags?.length ? `#${c.tags[0]}` : '#cat';
    card.appendChild(badge);

    // swipe feedback ribbon (LIKE/PASS)
    const ribbon = document.createElement('div');
    ribbon.className = 'ribbon';
    ribbon.textContent = '';
    card.appendChild(ribbon);

    attachDrag(card, c.url);
    STACK.appendChild(card);
  });
}

/* ----------------------------- swipe behaviour --------------------------- */

function attachDrag(card: HTMLDivElement, imgUrl: string) {
  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;

  const onDown = (e: PointerEvent) => {
    dragging = true;
    card.setPointerCapture(e.pointerId);
    sx = e.clientX;
    sy = e.clientY;
    card.classList.add('moving');
    card.classList.remove('like', 'pass');
    (card.lastElementChild as HTMLElement).textContent = '';
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    dx = e.clientX - sx;
    dy = e.clientY - sy;
    const rot = dx / 18;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    card.style.boxShadow = `0 26px 60px rgba(0,0,0,${Math.min(0.55, Math.abs(dx) / 280)})`;

    // visual feedback
    if (dx > 20) {
      card.classList.add('like');
      (card.lastElementChild as HTMLElement).textContent = 'LIKE';
    } else if (dx < -20) {
      card.classList.add('pass');
      (card.lastElementChild as HTMLElement).textContent = 'PASS';
    } else {
      card.classList.remove('like', 'pass');
      (card.lastElementChild as HTMLElement).textContent = '';
    }
  };

  const finalize = (isLike: boolean) => {
    card.classList.remove('moving');
    if (isLike) likedUrls.push(imgUrl);
    card.remove();
    processed++;
    updateProgress((processed / TOTAL) * 100);
    // Show summary if no cards left or all processed
    if (STACK.children.length === 0 || processed >= TOTAL) {
      showSummary();
    }
  };


  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    const threshold = 120;

    if (dx > threshold) {
      card.classList.add('swipe-right');
      card.ontransitionend = () => finalize(true);
    } else if (dx < -threshold) {
      card.classList.add('swipe-left');
      card.ontransitionend = () => finalize(false);
    } else {
      // snap back
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

/* ------------------------------- buttons --------------------------------- */

/** programmatic swipe via buttons */
function programmaticSwipe(like: boolean) {
  const top = STACK.firstElementChild as HTMLDivElement | null;
  if (!top) return;
  const url = extractBgUrl(top);

  // Always update progress bar immediately
  processed++;
  updateProgress((processed / TOTAL) * 100);

  // Use requestAnimationFrame to ensure browser applies the class before transition
  requestAnimationFrame(() => {
    top.classList.add(like ? 'swipe-right' : 'swipe-left');
    top.addEventListener("transitionend", () => {
      if (like && url) likedUrls.push(url);
      top.remove();
      // Show summary if no cards left or all processed
      if (STACK.children.length === 0 || processed >= TOTAL) {
        showSummary();
      }
    }, { once: true });
  });
}


BTN_LIKE.addEventListener('click', () => programmaticSwipe(true));
BTN_DISLIKE.addEventListener('click', () => programmaticSwipe(false));
BTN_RESTART?.addEventListener('click', () => loadCats());

/* ------------------------------ summary view ----------------------------- */

function showSummary() {
  LIKE_COUNT.textContent = String(likedUrls.length);
  LIKED_GRID.innerHTML = '';
  likedUrls.forEach(u => {
    const img = document.createElement('img');
    img.src = `${u}?width=500&height=666`;
    img.alt = 'Liked cat';
    LIKED_GRID.appendChild(img);
  });
  SUMMARY.hidden = false;
  SUMMARY.scrollIntoView({ behavior: "smooth", block: "start" });
}


/* --------------------------------- utils --------------------------------- */

function extractBgUrl(el: HTMLElement): string | null {
  const bg = getComputedStyle(el).backgroundImage; // url("...")
  const m = bg.match(/url\("([^"]+)"\)/);
  if (!m) return null;
  // remove size params if present
  return m[1].replace(/\?width=\d+&height=\d+.*$/, '');
}

function updateProgress(pct: number) {
  PROGRESS.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------- init ---------------------------------- */

loadCats().catch(console.error);
