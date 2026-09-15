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
    text: 'Hello there earthling! You have stumbled upon our garden of Moss.\nRejoyce amidst the harmony of green.',
    attribution: ''
  },
  {
    text: 'Moss is an inconspicuous plant that might bridge the connection between the binding forces lying within our biology and our relationships to other organisms.',
    attribution: ''
  },
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
  captionEl.appendChild(textEl);
  if (currentQuote.attribution) {
    const attributionEl = document.createElement('p');
    attributionEl.className = 'quote-attribution';
    attributionEl.textContent = currentQuote.attribution;
    captionEl.appendChild(attributionEl);
  }
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

// Figures out the output size that matches the on-screen (portrait) aspect ratio —
// not the camera sensor's native aspect, which is often landscape and would otherwise squish/crop wrong.
function getOutputSize() {
  const stageRect = stage.getBoundingClientRect();
  const aspect = stageRect.height / stageRect.width;
  const outW = 1080;
  const outH = Math.round(outW * aspect);
  return { outW, outH, stageRect };
}

// Draws one composited frame (camera + creatures + quote) into ctx at outW x outH.
// Used both for a single photo snapshot and, repeatedly, for video recording.
function compositeFrame(ctx, outW, outH, stageRect) {
  // Crop the video frame the same way CSS object-fit:cover does, so it matches the live view.
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

  // Bake the quote in, bottom-anchored over a dark scrim for legibility.
  if (currentQuote) {
    const pad = outW * 0.08;
    const maxTextWidth = outW - pad * 2;
    const quoteFontSize = Math.round(outW * 0.034);
    const quoteLineHeight = Math.round(quoteFontSize * 1.5);
    const attrFontSize = Math.round(outW * 0.026);
    const attrLineHeight = currentQuote.attribution ? Math.round(attrFontSize * 1.4) : 0;
    const fontStack = "'Fraunces', Georgia, 'Times New Roman', serif";

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

    if (currentQuote.attribution) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `italic ${attrFontSize}px ${fontStack}`;
      ctx.fillText(currentQuote.attribution, outW / 2, outH - pad);
    }

    ctx.shadowBlur = 0;
  }
}

// Composite a single photo snapshot, then share or download it.
function renderSnapshot() {
  const canvas = document.getElementById('capture-canvas');
  const ctx = canvas.getContext('2d');
  const { outW, outH, stageRect } = getOutputSize();
  canvas.width = outW;
  canvas.height = outH;
  compositeFrame(ctx, outW, outH, stageRect);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pickRecorderMimeType() {
  if (!window.MediaRecorder) return '';
  const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

const canRecord = !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
const MAX_RECORD_MS = 12000;
const HOLD_THRESHOLD_MS = 350;

let holdTimer = null;
let mediaRecorder = null;
let recordChunks = [];
let recordLoopId = null;
let maxDurationTimer = null;

function startRecording() {
  const { outW, outH, stageRect } = getOutputSize();
  const recordCanvas = document.getElementById('record-canvas');
  recordCanvas.width = outW;
  recordCanvas.height = outH;
  const ctx = recordCanvas.getContext('2d');

  function drawLoop() {
    compositeFrame(ctx, outW, outH, stageRect);
    recordLoopId = requestAnimationFrame(drawLoop);
  }
  drawLoop();

  const mimeType = pickRecorderMimeType();
  const stream = recordCanvas.captureStream(30);
  recordChunks = [];
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size) recordChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    cancelAnimationFrame(recordLoopId);
    const type = mediaRecorder.mimeType || mimeType || 'video/webm';
    const blob = new Blob(recordChunks, { type });
    showPreview(blob, 'video');
  };
  mediaRecorder.start();
  saveBtn.classList.add('recording');
  maxDurationTimer = setTimeout(stopRecording, MAX_RECORD_MS);
}

function stopRecording() {
  clearTimeout(maxDurationTimer);
  saveBtn.classList.remove('recording');
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

let isHoldRecording = false; // true once a recording has actually started for the current press

saveBtn.addEventListener('pointerdown', () => {
  isHoldRecording = false;
  if (!canRecord) return; // no hold-to-record support — plain tap-for-photo still works via click below
  holdTimer = setTimeout(() => {
    holdTimer = null;
    isHoldRecording = true;
    startRecording();
  }, HOLD_THRESHOLD_MS);
});

['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
  saveBtn.addEventListener(evt, () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (isHoldRecording) {
      stopRecording();
    }
  });
});

saveBtn.addEventListener('click', async () => {
  // A hold that started a recording already has its own stop/preview path (above) —
  // don't also take a photo for the same press.
  if (isHoldRecording) {
    isHoldRecording = false;
    return;
  }
  const blob = await renderSnapshot();
  showPreview(blob, 'image');
});

const previewOverlay = document.getElementById('preview-overlay');
const previewImg = document.getElementById('preview-img');
const previewVideo = document.getElementById('preview-video');
const previewShareIgBtn = document.getElementById('preview-share-ig');
const previewDownloadBtn = document.getElementById('preview-download');
const previewCloseBtn = document.getElementById('preview-close');

let currentPreviewUrl = null;
let currentPreviewBlob = null;

function closePreview() {
  previewOverlay.hidden = true;
  previewVideo.pause();
  if (currentPreviewUrl) {
    URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = null;
  }
}

function showPreview(blob, kind) {
  currentPreviewBlob = blob;
  if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
  currentPreviewUrl = URL.createObjectURL(blob);

  if (kind === 'video') {
    previewVideo.src = currentPreviewUrl;
    previewVideo.hidden = false;
    previewImg.hidden = true;
  } else {
    previewImg.src = currentPreviewUrl;
    previewImg.hidden = false;
    previewVideo.hidden = true;
  }
  previewOverlay.hidden = false;

  // Web pages can't silently write to the Photos/Gallery app — the real, reliable way to get
  // there is the OS's own save gesture: long-press the image/video ("Save Image"/"Save Video").
  // The share button is the other native route, where Instagram (and its Story composer) shows
  // up as one of the OS share-sheet options — a site can't skip straight into it, only a native app can.
  const canNativeShare = !!(navigator.canShare && navigator.canShare({ files: [blob] }));
  previewShareIgBtn.hidden = !canNativeShare;
}

previewCloseBtn.addEventListener('click', closePreview);

previewShareIgBtn.addEventListener('click', async () => {
  if (!currentPreviewBlob) return;
  const isVideo = currentPreviewBlob.type.startsWith('video');
  const ext = isVideo ? (currentPreviewBlob.type.includes('mp4') ? 'mp4' : 'webm') : 'png';
  const file = new File([currentPreviewBlob], `bitje-${Date.now()}.${ext}`, { type: currentPreviewBlob.type });
  try {
    await navigator.share({ files: [file] });
  } catch (err) {
    if (err.name !== 'AbortError') downloadBlob(currentPreviewBlob, file.name);
  }
});

previewDownloadBtn.addEventListener('click', () => {
  if (!currentPreviewBlob) return;
  const isVideo = currentPreviewBlob.type.startsWith('video');
  const ext = isVideo ? (currentPreviewBlob.type.includes('mp4') ? 'mp4' : 'webm') : 'png';
  downloadBlob(currentPreviewBlob, `bitje-${Date.now()}.${ext}`);
});

initCreatures();
requestAnimationFrame(chromaKeyLoop);
startCamera();
