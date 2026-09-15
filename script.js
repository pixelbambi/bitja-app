const video = document.getElementById('camera');
const stage = document.getElementById('stage');
const creatureLayer = document.getElementById('creature-layer');
const flipBtn = document.getElementById('flip-btn');
const saveBtn = document.getElementById('save-btn');
const permissionMsg = document.getElementById('permission-msg');
const captionEl = document.getElementById('caption');

const CREATURE_FILES = [
  'creatures/creature-1.mp4',
  'creatures/creature-2.mp4',
  'creatures/creature-3.mp4',
  'creatures/creature-4.mp4',
  'creatures/creature-5.mp4',
  'creatures/creature-6.mp4',
  'creatures/creature-7.mp4'
];

const CAPTIONS = [
  'Hello there earthling! You have stumbled upon our garden of Moss. Rejoyce amidst the harmony of green.',
  'Moss is an inconspicuous plant that might bridge the connection between the binding forces lying within our biology and our relationships to other organisms.',
  'Salutations curious earthling!\n\nWe are the Moss protectors and our main dwellings are situated at Krater.\nDo visit us there to experience blissful togetherness among the greenery.'
];

const CREATURE_COUNT = 3;

// Chroma-key render resolution. Higher = crisper creatures, more per-frame JS work —
// this is the balance point for 3 creatures keying at once on a phone; drop it if it stutters.
const KEY_W = 384;
const KEY_H = 216;

// Below this brightness a pixel is treated as background and made transparent;
// between LOW and HIGH it fades, so edges stay smooth instead of jagged.
const KEY_LOW = 14;
const KEY_HIGH = 46;

// Rough non-overlapping "slots" (% of stage) creatures get randomly jittered within,
// keeping clear of the caption band at the bottom and the very top edge.
const SLOTS = [
  { xMin: 12, xMax: 34, yMin: 20, yMax: 42 },
  { xMin: 62, xMax: 88, yMin: 18, yMax: 40 },
  { xMin: 30, xMax: 60, yMin: 50, yMax: 68 }
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomInSlot(slot) {
  return {
    xPct: slot.xMin + Math.random() * (slot.xMax - slot.xMin),
    yPct: slot.yMin + Math.random() * (slot.yMax - slot.yMin)
  };
}

// One entry per on-screen creature: its canvas, hidden source video, offscreen key buffer, and position.
const creatures = [];

function createCreature(fileSrc, slot) {
  const canvas = document.createElement('canvas');
  canvas.className = 'creature';
  canvas.width = KEY_W;
  canvas.height = KEY_H;
  creatureLayer.appendChild(canvas);

  const sourceVideo = document.createElement('video');
  sourceVideo.className = 'creature-source';
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  sourceVideo.loop = true;
  sourceVideo.preload = 'auto';
  sourceVideo.src = fileSrc;
  document.body.appendChild(sourceVideo);
  sourceVideo.play().catch(() => {
    const resume = () => {
      sourceVideo.play();
      stage.removeEventListener('pointerdown', resume);
    };
    stage.addEventListener('pointerdown', resume, { once: true });
  });

  const keyBuffer = document.createElement('canvas');
  keyBuffer.width = KEY_W;
  keyBuffer.height = KEY_H;

  const instance = {
    canvas,
    ctx: canvas.getContext('2d', { willReadFrequently: true }),
    sourceVideo,
    keyBufferCtx: keyBuffer.getContext('2d'),
    pos: randomInSlot(slot),
    dragging: false,
    dragOffset: { x: 0, y: 0 }
  };

  applyCreatureTransform(instance);
  bindDrag(instance);
  creatures.push(instance);
}

function applyCreatureTransform(instance) {
  instance.canvas.style.left = instance.pos.xPct + '%';
  instance.canvas.style.top = instance.pos.yPct + '%';
}

function bindDrag(instance) {
  const { canvas } = instance;

  canvas.addEventListener('pointerdown', (e) => {
    instance.dragging = true;
    canvas.setPointerCapture(e.pointerId);
    const rect = stage.getBoundingClientRect();
    const creatureX = (instance.pos.xPct / 100) * rect.width;
    const creatureY = (instance.pos.yPct / 100) * rect.height;
    instance.dragOffset.x = e.clientX - rect.left - creatureX;
    instance.dragOffset.y = e.clientY - rect.top - creatureY;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!instance.dragging) return;
    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left - instance.dragOffset.x;
    const y = e.clientY - rect.top - instance.dragOffset.y;
    instance.pos.xPct = Math.min(100, Math.max(0, (x / rect.width) * 100));
    instance.pos.yPct = Math.min(100, Math.max(0, (y / rect.height) * 100));
    applyCreatureTransform(instance);
  });

  canvas.addEventListener('pointerup', (e) => {
    instance.dragging = false;
    canvas.releasePointerCapture(e.pointerId);
  });
}

function initCreatures() {
  const files = shuffled(CREATURE_FILES).slice(0, CREATURE_COUNT);
  files.forEach((file, i) => createCreature(file, SLOTS[i]));
  captionEl.textContent = pickRandom(CAPTIONS);
}

function chromaKeyLoop() {
  for (const instance of creatures) {
    if (instance.sourceVideo.readyState >= 2) {
      instance.keyBufferCtx.drawImage(instance.sourceVideo, 0, 0, KEY_W, KEY_H);
      const frame = instance.keyBufferCtx.getImageData(0, 0, KEY_W, KEY_H);
      const data = frame.data;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = Math.max(data[i], data[i + 1], data[i + 2]);
        if (brightness <= KEY_LOW) {
          data[i + 3] = 0;
        } else if (brightness < KEY_HIGH) {
          data[i + 3] = Math.round(((brightness - KEY_LOW) / (KEY_HIGH - KEY_LOW)) * 255);
        }
      }
      instance.ctx.putImageData(frame, 0, 0);
    }
  }
  requestAnimationFrame(chromaKeyLoop);
}

let facingMode = 'user';
let currentStream = null;
let requestId = 0; // guards against a stale in-flight call overwriting a newer result

// Ground truth: if the camera is actually producing frames, the message goes away — no exceptions.
video.addEventListener('playing', () => {
  permissionMsg.hidden = true;
});

async function startCamera() {
  const myRequest = ++requestId;

  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  if (!window.isSecureContext) {
    showError('Stran ni na HTTPS (ali localhost), zato brskalnik kamere ne dovoli. Odpri stran preko https:// ali preko localhost.', myRequest);
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('Ta brskalnik ne podpira dostopa do kamere (navigator.mediaDevices manjka). Poskusi v Safari ali Chrome, ne v vgrajenem brskalniku aplikacije.', myRequest);
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false
    });
    if (myRequest !== requestId) {
      // a newer request has already started (or won) — this one is stale, drop it
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    currentStream = stream;
    video.srcObject = currentStream;
    video.classList.toggle('mirror', facingMode === 'user');
    permissionMsg.hidden = true;
  } catch (err) {
    console.error('Camera error:', err.name, err.message);
    const messages = {
      NotAllowedError: 'Dostop do kamere je zavrnjen. Klikni na ključavnico/ikono ob naslovu strani, dovoli kamero, nato osveži.',
      NotFoundError: 'Ni najdene kamere na tej napravi.',
      NotReadableError: 'Kamero uporablja druga aplikacija ali zavihek — zapri jo in poskusi znova.',
      OverconstrainedError: 'Zahtevana kamera (' + facingMode + ') ni na voljo na tej napravi.',
      SecurityError: 'Dostop do kamere je blokiran zaradi varnostnih nastavitev strani (npr. vgrajen predogled brez dovoljenja za kamero).'
    };
    showError(messages[err.name] || `Napaka pri dostopu do kamere: ${err.name} — ${err.message}`, myRequest);
  }
}

function showError(text, forRequest) {
  if (forRequest !== requestId) return; // a newer request superseded this one
  permissionMsg.querySelector('p').textContent = text;
  permissionMsg.hidden = false;
}

document.getElementById('retry-btn').addEventListener('click', startCamera);

flipBtn.addEventListener('click', () => {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  startCamera();
});

// Save composited snapshot
saveBtn.addEventListener('click', () => {
  const canvas = document.getElementById('capture-canvas');
  const vw = video.videoWidth || 720;
  const vh = video.videoHeight || 1280;
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d');

  ctx.save();
  if (video.classList.contains('mirror')) {
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, vw, vh);
  ctx.restore();

  // Map each creature's on-screen position/size (relative to stage) onto the output canvas
  const stageRect = stage.getBoundingClientRect();
  const scaleX = vw / stageRect.width;
  const scaleY = vh / stageRect.height;

  for (const instance of creatures) {
    const creatureRect = instance.canvas.getBoundingClientRect();
    const drawW = creatureRect.width * scaleX;
    const drawH = creatureRect.height * scaleY;
    const drawX = (creatureRect.left - stageRect.left) * scaleX;
    const drawY = (creatureRect.top - stageRect.top) * scaleY;
    ctx.drawImage(instance.canvas, drawX, drawY, drawW, drawH);
  }

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitje-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
});

initCreatures();
requestAnimationFrame(chromaKeyLoop);
startCamera();
