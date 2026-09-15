const video = document.getElementById('camera');
const stage = document.getElementById('stage');
const creatureLayer = document.getElementById('creature-layer');
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
  {
    text: 'An artwork does something to you, so if you think that only lifeforms can do things to you, this is a weird and challenging fact. If you think on top of this that only humans are empowered with the magical ability to impose meaning and temporality on things, then you are in for a bigger shock, because as I’ve argued, art emits time, which tells you something about how everything emits time.',
    attribution: '— Timothy Morton, All Art is Ecological'
  },
  {
    text: 'Realizing that there are lots of different temporality formats is basically what ecological awareness is. It’s equivalent to acknowledging in a deep way the existence of beings that aren’t you, with whom you coexist. Once you’ve done that, you can’t un-acknowledge it. There’s no going back.',
    attribution: '— Timothy Morton, All Art is Ecological'
  },
  {
    text: 'I would like to see us use our technical skills to cure the ills of the Earth as well as those of humans.',
    attribution: '— James Lovelock, We Belong to Gaia'
  },
  {
    text: 'The time has come when all of us must plan a retreat from the unsustainable place that we have now reached through the inappropriate use of technology;',
    attribution: '— James Lovelock, We Belong to Gaia'
  },
  {
    text: 'I have long thought that a proper gift for our children and grandchildren is an accurate record of all we know about the present and past environment.',
    attribution: '— James Lovelock, We Belong to Gaia'
  },
  {
    text: 'Scan the shelves of a bookshop or a public library for a book that clearly explains the present condition and how it happened. You will not find it.',
    attribution: '— James Lovelock, We Belong to Gaia'
  }
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

// Rough non-overlapping "slots" (% of stage) creatures get randomly jittered within.
// Spread wide since creatures are large — keeps clear of the caption band at the bottom.
const SLOTS = [
  { xMin: 8, xMax: 28, yMin: 16, yMax: 30 },
  { xMin: 72, xMax: 92, yMin: 16, yMax: 30 },
  { xMin: 35, xMax: 65, yMin: 55, yMax: 68 }
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

let currentQuote = null;

function initCreatures() {
  const files = shuffled(CREATURE_FILES).slice(0, CREATURE_COUNT);
  files.forEach((file, i) => createCreature(file, SLOTS[i]));

  currentQuote = pickRandom(CAPTIONS);
  captionEl.innerHTML = '';
  const textEl = document.createElement('p');
  textEl.className = 'quote-text';
  textEl.textContent = currentQuote.text;
  const attributionEl = document.createElement('p');
  attributionEl.className = 'quote-attribution';
  attributionEl.textContent = currentQuote.attribution;
  captionEl.appendChild(textEl);
  captionEl.appendChild(attributionEl);
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
    // Always the back (environment) camera — no front-camera option.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false
    });
    if (myRequest !== requestId) {
      // a newer request has already started (or won) — this one is stale, drop it
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    currentStream = stream;
    video.srcObject = currentStream;
    permissionMsg.hidden = true;
  } catch (err) {
    console.error('Camera error:', err.name, err.message);
    const messages = {
      NotAllowedError: 'Dostop do kamere je zavrnjen. Klikni na ključavnico/ikono ob naslovu strani, dovoli kamero, nato osveži.',
      NotFoundError: 'Ni najdene kamere na tej napravi.',
      NotReadableError: 'Kamero uporablja druga aplikacija ali zavihek — zapri jo in poskusi znova.',
      OverconstrainedError: 'Zadnja kamera ni na voljo na tej napravi.',
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

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Composite the camera frame + all creatures + the quote into one vertical snapshot
// that matches what's actually on screen, then share or download it.
function renderSnapshot() {
  const canvas = document.getElementById('capture-canvas');
  const ctx = canvas.getContext('2d');

  // Output canvas matches the on-screen (portrait) aspect ratio — not the camera
  // sensor's native aspect, which is often landscape and would otherwise squish/crop wrong.
  const stageRect = stage.getBoundingClientRect();
  const aspect = stageRect.height / stageRect.width;
  const outW = 1080;
  const outH = Math.round(outW * aspect);
  canvas.width = outW;
  canvas.height = outH;

  // Crop the video frame the same way CSS object-fit:cover does, so the photo matches the live view.
  const vw = video.videoWidth || outW;
  const vh = video.videoHeight || outH;
  const videoAspect = vw / vh;
  const canvasAspect = outW / outH;
  let sx, sy, sw, sh;
  if (videoAspect > canvasAspect) {
    sh = vh;
    sw = vh * canvasAspect;
    sx = (vw - sw) / 2;
    sy = 0;
  } else {
    sw = vw;
    sh = vw / canvasAspect;
    sx = 0;
    sy = (vh - sh) / 2;
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);

  // Map each creature's on-screen position/size (relative to stage) onto the output canvas
  const scaleX = outW / stageRect.width;
  const scaleY = outH / stageRect.height;

  for (const instance of creatures) {
    const creatureRect = instance.canvas.getBoundingClientRect();
    const drawW = creatureRect.width * scaleX;
    const drawH = creatureRect.height * scaleY;
    const drawX = (creatureRect.left - stageRect.left) * scaleX;
    const drawY = (creatureRect.top - stageRect.top) * scaleY;
    ctx.drawImage(instance.canvas, drawX, drawY, drawW, drawH);
  }

  // Bake the quote into the image, bottom-anchored over a dark scrim for legibility.
  if (currentQuote) {
    const pad = outW * 0.08;
    const maxTextWidth = outW - pad * 2;
    const quoteFontSize = Math.round(outW * 0.034);
    const quoteLineHeight = Math.round(quoteFontSize * 1.5);
    const attrFontSize = Math.round(outW * 0.026);
    const attrLineHeight = Math.round(attrFontSize * 1.4);
    const fontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    ctx.font = `500 ${quoteFontSize}px ${fontStack}`;
    const lines = wrapText(ctx, currentQuote.text, maxTextWidth);

    const blockHeight = lines.length * quoteLineHeight + attrLineHeight + pad * 1.4;
    const scrimHeight = Math.min(outH * 0.55, blockHeight + pad);
    const grad = ctx.createLinearGradient(0, outH - scrimHeight, 0, outH);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, outH - scrimHeight, outW, scrimHeight);

    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = outW * 0.01;

    let y = outH - pad - attrLineHeight - (lines.length - 1) * quoteLineHeight;
    ctx.fillStyle = '#fff';
    ctx.font = `500 ${quoteFontSize}px ${fontStack}`;
    for (const line of lines) {
      ctx.fillText(line, outW / 2, y);
      y += quoteLineHeight;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `italic ${attrFontSize}px ${fontStack}`;
    ctx.fillText(currentQuote.attribution, outW / 2, outH - pad);

    ctx.shadowBlur = 0;
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bitje-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const previewOverlay = document.getElementById('preview-overlay');
const previewImg = document.getElementById('preview-img');
const previewShareBtn = document.getElementById('preview-share');
const previewDownloadBtn = document.getElementById('preview-download');
const previewCloseBtn = document.getElementById('preview-close');

let currentPreviewUrl = null;
let currentPreviewBlob = null;

function closePreview() {
  previewOverlay.hidden = true;
  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = null;
  }
}

saveBtn.addEventListener('click', async () => {
  const blob = await renderSnapshot();
  currentPreviewBlob = blob;
  currentPreviewUrl = URL.createObjectURL(blob);
  previewImg.src = currentPreviewUrl;
  previewOverlay.hidden = false;

  // Web pages can't silently write to the Photos/Gallery app — the real, reliable way to get
  // there is the OS's own image-saving gesture: long-press the <img> ("Save Image"/"Add to Photos").
  // The share button is the other native route (Instagram Stories, Messages, AirDrop, …).
  const canNativeShare = !!(navigator.canShare && navigator.canShare({
    files: [new File([blob], 'bitje.png', { type: 'image/png' })]
  }));
  previewShareBtn.hidden = !canNativeShare;
});

previewCloseBtn.addEventListener('click', closePreview);

previewShareBtn.addEventListener('click', async () => {
  if (!currentPreviewBlob) return;
  const file = new File([currentPreviewBlob], `bitje-${Date.now()}.png`, { type: 'image/png' });
  try {
    await navigator.share({ files: [file] });
  } catch (err) {
    if (err.name !== 'AbortError') downloadBlob(currentPreviewBlob);
  }
});

previewDownloadBtn.addEventListener('click', () => {
  if (currentPreviewBlob) downloadBlob(currentPreviewBlob);
});

initCreatures();
requestAnimationFrame(chromaKeyLoop);
startCamera();
