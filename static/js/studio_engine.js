/**
 * «នាគហ្សង បកប្រែ» (Neak Zong Translate AI)
 * Studio Engine — Touch/Drag Overlays, Marquee, Live Canvas, & Cloud APIs
 */

// ── Global State ──────────────────────────────────────────
const state = {
  videoFile: null,
  videoFilename: null,
  videoUrl: null,
  srtContent: null,
  translatedSrt: null,
  activeTab: 'media',
  
  // Anti-Copyright Settings
  flipHorizontal: false,
  cropPercent: 0,
  brightness: 0,
  contrast: 1.0,
  
  // Overlays (STRICT: All false by default!)
  blurMask: {
    enabled: false,
    x: 20,
    y: 20,
    w: 130,
    h: 48,
    intensity: 16
  },
  logoOverlay: {
    enabled: false,
    x: 20,
    y: 20,
    scale: 0.25,
    opacity: 0.9,
    path: null
  },
  textOverlay: {
    enabled: false,
    text: 'នាគហ្សង បកប្រែ',
    font: 'Moul',
    size: 26,
    color: '#ffffff',
    x: 20,
    y: 40
  },
  marquee: {
    enabled: false,
    text: 'សូមចុច Subscribe & Follow ដើម្បីទស្សនាភាគបន្ត «នាគហ្សង បកប្រែ AI»',
    direction: 'up', // 'up' or 'down'
    speedSec: 8,     // animation duration in seconds
    color: '#f59e0b',
    fontSize: 22
  },

  // Khmer Voice & Audio
  voice: 'female', // 'male' (Piseth) or 'female' (Sreymom)
  voiceSpeed: 1.0,
  pitch: 0,
  duckLevel: 0.15,
  isProcessing: false
};

// ── DOM References ────────────────────────────────────────
const previewVideo = document.getElementById('preview-video');
const videoViewport = document.getElementById('video-viewport');
const videoOverlayLayer = document.getElementById('video-overlay-layer');

// Overlay Elements
const blurBox = document.getElementById('blur-overlay-box');
const logoElement = document.getElementById('logo-overlay-element');
const textElement = document.getElementById('text-overlay-element');
const marqueeElement = document.getElementById('marquee-overlay-element');
const marqueeTrack = document.getElementById('marquee-track');

// Toast Notification
function showToast(text, duration = 3000) {
  const t = document.getElementById('toast-notification');
  t.innerText = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── 1. Tab Navigation ─────────────────────────────────────
function switchStudioTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel-card').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-panel-${tabId}`);
  });
}

// ── 2. Media Upload & Handling ────────────────────────────
async function handleVideoUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  state.videoFile = file;

  // Hide placeholder, show video element
  const placeholder = document.getElementById('video-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  // Local object URL for instant preview on phone
  const localUrl = URL.createObjectURL(file);
  previewVideo.style.display = 'block';
  previewVideo.src = localUrl;
  previewVideo.muted = true; // allow instant preview/autoplay on mobile
  previewVideo.playsInline = true;
  previewVideo.setAttribute('playsinline', '');
  previewVideo.setAttribute('webkit-playsinline', '');
  previewVideo.load();

  previewVideo.onloadedmetadata = () => {
    // Auto adjust portrait vs landscape aspect ratio
    if (previewVideo.videoHeight > previewVideo.videoWidth) {
      videoViewport.classList.add('portrait-mode');
    } else {
      videoViewport.classList.remove('portrait-mode');
    }
    // Seek slightly to force mobile browsers to render first frame immediately
    try {
      previewVideo.currentTime = 0.05;
    } catch (err) {}
    updateVideoTime();
  };

  previewVideo.oncanplay = () => {
    previewVideo.play().catch(() => {});
  };

  showToast('✓ វីដេអូបានបើកក្នុង Player Preview ភ្លាមៗ!');

  // Upload to Cloud Server in background
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.status === 'ok') {
      state.videoFilename = data.filename;
      showToast('✓ វីដេអូបានភ្ជាប់ទៅកាន់ Cloud Server (Ready for AI)');
    }
  } catch (err) {
    console.warn('Local preview active, cloud sync note:', err);
  }
}

async function handleSrtUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    state.srtContent = e.target.result;
    document.getElementById('subtitles-preview-area').value = state.srtContent.substring(0, 500) + '...';
    showToast('✓ បានបញ្ចូលឯកសារ Subtitle SRT');
  };
  reader.readAsText(file);
}

// ── 3. Chinese-to-Khmer Translation ───────────────────────
async function triggerAiTranslation() {
  const customText = document.getElementById('translate-input-text').value.trim();
  showToast('⚡ AI កំពុងស្ដាប់សំឡេងចិន និងបកប្រែជាភាសាខ្មែរ...');

  try {
    const payload = {};
    if (state.srtContent) {
      payload.srt_content = state.srtContent;
    } else if (state.videoFilename) {
      // 100% Auto-ASR from video!
      payload.video_filename = state.videoFilename;
    } else if (customText) {
      payload.text = customText;
    } else {
      payload.text = '皇上驾到，万岁万岁万万岁！微臣参见陛下。';
    }

    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'ok') {
      if (data.translated_srt) {
        state.translatedSrt = data.translated_srt;
        document.getElementById('subtitles-preview-area').value = data.translated_srt;
        if (data.translated_text) {
          document.getElementById('translate-result-text').innerText = data.translated_text;
        }
        showToast(`✓ AI បកប្រែរឿងភាគចិនបាន ${data.cues_count || ''} ឃ្លាជោគជ័យ!`);
      } else {
        document.getElementById('translate-result-text').innerText = data.translated;
        showToast('✓ បកប្រែជោគជ័យ!');
      }
    } else {
      showToast('⚠️ ការបកប្រែមានបញ្ហា');
    }
  } catch (e) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបកប្រែបានទេ');
  }
}

// ── 4. Khmer Voice Dubbing (TTS) ──────────────────────────
async function triggerKhmerTts() {
  const text = document.getElementById('tts-input-text').value.trim() || 
               document.getElementById('translate-result-text').innerText || 
               'សូមស្វាគមន៍មកកាន់ការទស្សនារឿងភាគចិន នាគហ្សង បកប្រែ AI';

  showToast('🎙️ កំពុងបង្កើតសំឡេងអានខ្មែរ AI...');
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        voice: state.voice,
        speed: state.voiceSpeed,
        pitch: state.pitch
      })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      const audio = new Audio(data.audio_url);
      audio.play();
      showToast(`✓ សំឡេងខ្មែរ (${state.voice === 'male' ? 'ពិសិដ្ឋ' : 'ស្រីមុំ'}) បង្កើតជោគជ័យ!`);
    } else {
      showToast('⚠️ បរាជ័យក្នុងការបង្កើតសំឡេង');
    }
  } catch (e) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ម៉ាស៊ីនសំឡេងបានទេ');
  }
}

// ── 5. STRICT OVERLAY TOGGLES (Only Visible when Switched ON) ──
function toggleBlurOverlay(enabled) {
  state.blurMask.enabled = enabled;
  blurBox.classList.toggle('active-visible', enabled);
  showToast(enabled ? '✓ បានបើកផ្ទាំងព្រិល (Blur Mask)' : 'បានបិទផ្ទាំងព្រិល');
}

function toggleLogoOverlay(enabled) {
  state.logoOverlay.enabled = enabled;
  logoElement.classList.toggle('active-visible', enabled);
  showToast(enabled ? '✓ បានបើក Logo' : 'បានបិទ Logo');
}

function toggleTextOverlay(enabled) {
  state.textOverlay.enabled = enabled;
  textElement.classList.toggle('active-visible', enabled);
  showToast(enabled ? '✓ បានបើកអក្សរលើវីដេអូ' : 'បានបិទអក្សរ');
}

function updateOverlayText(val) {
  state.textOverlay.text = val;
  const target = document.getElementById('rendered-text-val');
  if (target) target.innerText = val;
}

function editOverlayTextDirect() {
  const current = state.textOverlay.text || 'នាគហ្សង បកប្រែ';
  const newText = prompt('វាយអត្ថបទថ្មីសម្រាប់ដាក់លើវីដេអូ (Text Overlay):', current);
  if (newText !== null && newText.trim() !== '') {
    updateOverlayText(newText.trim());
    const inputField = document.getElementById('text-overlay-input');
    if (inputField) inputField.value = newText.trim();
    showToast('✓ បានប្តូរអត្ថបទលើវីដេអូរួចរាល់');
  }
}

function toggleMarqueeOverlay(enabled) {
  state.marquee.enabled = enabled;
  marqueeElement.classList.toggle('active-visible', enabled);
  updateMarqueeAnimation();
  showToast(enabled ? '✓ បានបើកអក្សររត់ (Marquee)' : 'បានបិទអក្សររត់');
}

// ── 6. ANIMATED VERTICAL MARQUEE ENGINE ───────────────────
function updateMarqueeText(val) {
  state.marquee.text = val;
  marqueeTrack.innerText = val;
}

function setMarqueeDirection(dir) {
  state.marquee.direction = dir;
  const upBtn = document.getElementById('marquee-dir-up');
  const downBtn = document.getElementById('marquee-dir-down');
  if (upBtn) upBtn.classList.toggle('active', dir === 'up');
  if (downBtn) downBtn.classList.toggle('active', dir === 'down');
  updateMarqueeAnimation();
}

function setMarqueeSpeed(preset) {
  let sec = 8;
  if (preset === 'slow') sec = 15;
  if (preset === 'normal') sec = 8;
  if (preset === 'fast') sec = 4;
  setMarqueeSpeedSeconds(sec);
}

function setMarqueeSpeedSeconds(sec) {
  const val = parseInt(sec) || 8;
  state.marquee.speedSec = val;
  const valEl = document.getElementById('marquee-speed-val');
  if (valEl) valEl.innerText = `${val}s`;
  const slider = document.getElementById('marquee-speed-slider');
  if (slider && parseInt(slider.value) !== val) slider.value = val;

  ['slow', 'normal', 'fast'].forEach(p => {
    const btn = document.getElementById(`btn-speed-${p}`);
    if (btn) btn.classList.remove('active');
  });
  if (val >= 14) document.getElementById('btn-speed-slow')?.classList.add('active');
  else if (val <= 5) document.getElementById('btn-speed-fast')?.classList.add('active');
  else document.getElementById('btn-speed-normal')?.classList.add('active');

  updateMarqueeAnimation();
}

function updateMarqueeAnimation() {
  const animName = state.marquee.direction === 'up' ? 'scrollUp' : 'scrollDown';
  marqueeTrack.style.animation = `${animName} ${state.marquee.speedSec}s linear infinite`;
}

// ── 7. ANTI-COPYRIGHT VIDEO CONTROLS ──────────────────────
function toggleFlipHorizontal(flipped) {
  state.flipHorizontal = flipped;
  updateVideoCssFilters();
  showToast(flipped ? '✓ ត្រឡប់វីដេអូឆ្វេង-ស្តាំ (Flip 180°)' : 'បានបិទ Flip');
}

function updateBrightness(val) {
  state.brightness = parseFloat(val);
  const valEl = document.getElementById('brightness-val');
  if (valEl) valEl.innerText = val;
  updateVideoCssFilters();
}

function updateContrast(val) {
  state.contrast = parseFloat(val);
  const valEl = document.getElementById('contrast-val');
  if (valEl) valEl.innerText = `${val}x`;
  updateVideoCssFilters();
}

function updateCrop(val) {
  state.cropPercent = parseInt(val);
  const valEl = document.getElementById('crop-val');
  if (valEl) valEl.innerText = `${val}%`;
  updateVideoCssFilters();
}

function updateVideoCssFilters() {
  const scaleX = state.flipHorizontal ? -1 : 1;
  const zoom = 1 + (state.cropPercent / 100);
  previewVideo.style.transform = `scaleX(${scaleX}) scale(${zoom})`;
  
  const b = 1 + state.brightness;
  const c = state.contrast;
  previewVideo.style.filter = `brightness(${b}) contrast(${c})`;
}

// ── 8. TOUCH & MOUSE DRAGGING SYSTEM (Mobile Optimized) ───
function makeDraggable(element) {
  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

  element.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('resizer-handle')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;

    try {
      element.setPointerCapture(e.pointerId);
    } catch (err) {}

    document.querySelectorAll('.interactive-overlay').forEach(el => el.classList.remove('selected-focus'));
    element.classList.add('selected-focus');
    e.preventDefault();
  });

  element.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const parent = element.parentElement;
    const maxLeft = Math.max(0, parent.clientWidth - element.offsetWidth);
    const maxTop = Math.max(0, parent.clientHeight - element.offsetHeight);

    const newLeft = Math.max(0, Math.min(maxLeft, initialLeft + dx));
    const newTop = Math.max(0, Math.min(maxTop, initialTop + dy));

    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
  });

  const onPointerEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    try {
      if (element.hasPointerCapture(e.pointerId)) {
        element.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
  };

  element.addEventListener('pointerup', onPointerEnd);
  element.addEventListener('pointercancel', onPointerEnd);
}

// Resizable Handle for Blur Box (Touch & Pointer Safe)
function makeResizable(element) {
  const handle = element.querySelector('.resizer-handle.se');
  if (!handle) return;

  let isResizing = false;
  let startX = 0, startY = 0, startW = 0, startH = 0;

  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = element.offsetWidth;
    startH = element.offsetHeight;

    try {
      handle.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  handle.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const dw = e.clientX - startX;
    const dh = e.clientY - startY;
    element.style.width = `${Math.max(40, startW + dw)}px`;
    element.style.height = `${Math.max(20, startH + dh)}px`;
  });

  const onResizeEnd = (e) => {
    if (!isResizing) return;
    isResizing = false;
    try {
      if (handle.hasPointerCapture(e.pointerId)) {
        handle.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
  };

  handle.addEventListener('pointerup', onResizeEnd);
  handle.addEventListener('pointercancel', onResizeEnd);
}

// ── 9. EXPORT & AUTO PROCESS PIPELINES ────────────────────
async function triggerRenderExport() {
  if (!state.videoFilename) {
    showToast('⚠️ សូមរើសវីដេអូមុនពេល Export');
    return;
  }

  showToast('🎬 កំពុង Render វីដេអូ HD 1080p...');
  const progressWrap = document.getElementById('render-progress-wrap');
  const progressBar = document.getElementById('render-progress-bar');
  const progressStatus = document.getElementById('render-progress-status');
  progressWrap.style.display = 'flex';
  progressBar.style.width = '20%';
  progressStatus.innerText = 'កំពុងដំណើរការ FFmpeg Engine...';

  // Gather Overlay options
  const options = {
    flip_horizontal: state.flipHorizontal,
    crop_percent: state.cropPercent,
    brightness: state.brightness,
    contrast: state.contrast,
    blur_mask: {
      enabled: state.blurMask.enabled,
      x: blurBox.offsetLeft,
      y: blurBox.offsetTop,
      w: blurBox.offsetWidth,
      h: blurBox.offsetHeight
    },
    marquee: {
      enabled: state.marquee.enabled,
      text: state.marquee.text,
      direction: state.marquee.direction,
      speed: Math.round(300 / state.marquee.speedSec),
      color: state.marquee.color
    },
    text_overlay: {
      enabled: state.textOverlay.enabled,
      text: state.textOverlay.text,
      x: textElement.offsetLeft,
      y: textElement.offsetTop,
      size: state.textOverlay.size,
      color: state.textOverlay.color
    }
  };

  try {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_name: state.videoFilename,
        options: options
      })
    });
    const data = await res.json();
    if (data.status === 'started') {
      pollJobStatus(data.job_id);
    } else {
      showToast('⚠️ ការ Render មានបញ្ហា');
      progressWrap.style.display = 'none';
    }
  } catch (err) {
    showToast('⚠️ មិនអាចបញ្ជា Render បានទេ');
    progressWrap.style.display = 'none';
  }
}

async function triggerAutoProcessPipeline() {
  if (!state.videoFilename && !state.videoFile) {
    showToast('⚠️ សូមរើសវីដេអូជាមុនសិន!');
    return;
  }

  showToast('🚀 កំពុងចាប់ផ្តើម 1-Click Auto Pipeline...');
  const progressWrap = document.getElementById('render-progress-wrap');
  const progressBar = document.getElementById('render-progress-bar');
  const progressStatus = document.getElementById('render-progress-status');
  progressWrap.style.display = 'flex';
  progressBar.style.width = '10%';
  progressStatus.innerText = 'កំពុងភ្ជាប់វីដេអូទៅកាន់ Cloud Server...';

  // Ensure video is uploaded to server
  if (!state.videoFilename && state.videoFile) {
    try {
      const formData = new FormData();
      formData.append('video', state.videoFile);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'ok') {
        state.videoFilename = data.filename;
      } else {
        throw new Error('Upload failed');
      }
    } catch (e) {
      showToast('⚠️ បរាជ័យក្នុងការ Upload វីដេអូទៅ Server');
      progressWrap.style.display = 'none';
      return;
    }
  }

  progressBar.style.width = '25%';
  progressStatus.innerText = 'AI កំពុងស្ដាប់សំឡេងចិន (Whisper ASR) & បកប្រែជាភាសាខ្មែរ...';

  try {
    const res = await fetch('/api/auto-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_name: state.videoFilename,
        srt_content: state.srtContent || '',
        voice: state.voice,
        speed: state.voiceSpeed,
        options: {
          flip_horizontal: state.flipHorizontal,
          crop_percent: state.cropPercent,
          brightness: state.brightness,
          contrast: state.contrast,
          blur_mask: {
            enabled: state.blurMask.enabled,
            x: blurBox.offsetLeft,
            y: blurBox.offsetTop,
            w: blurBox.offsetWidth,
            h: blurBox.offsetHeight
          },
          marquee: {
            enabled: state.marquee.enabled,
            text: state.marquee.text,
            direction: state.marquee.direction,
            speed: Math.round(300 / state.marquee.speedSec),
            color: state.marquee.color
          },
          text_overlay: {
            enabled: state.textOverlay.enabled,
            text: state.textOverlay.text,
            x: textElement.offsetLeft,
            y: textElement.offsetTop,
            size: state.textOverlay.size,
            color: state.textOverlay.color
          }
        }
      })
    });
    const data = await res.json();
    if (data.status === 'started') {
      pollJobStatus(data.job_id);
    } else {
      showToast('⚠️ បរាជ័យក្នុងការចាប់ផ្ដើម Auto Pipeline');
      progressWrap.style.display = 'none';
    }
  } catch (err) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបានទេ');
    progressWrap.style.display = 'none';
  }
}

function pollJobStatus(jobId) {
  const progressBar = document.getElementById('render-progress-bar');
  const progressStatus = document.getElementById('render-progress-status');
  const downloadBtn = document.getElementById('btn-download-result');

  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/job/${jobId}`);
      const job = await res.json();

      progressBar.style.width = `${job.progress || 30}%`;
      if (job.step) progressStatus.innerText = job.step;

      if (job.status === 'completed') {
        clearInterval(interval);
        progressBar.style.width = '100%';
        progressStatus.innerText = '✓ ជោគជ័យ ១០០%! វីដេអូរួចរាល់សម្រាប់ការទាញយក។';
        downloadBtn.style.display = 'flex';
        downloadBtn.href = job.download_url;
        downloadBtn.setAttribute('download', job.filename);
        showToast('✓ វីដេអូ Render ចប់សព្វគ្រប់!');
      } else if (job.status === 'failed') {
        clearInterval(interval);
        progressStatus.innerText = `⚠️ បរាជ័យ: ${job.error || 'Unknown'}`;
      }
    } catch (e) {
      clearInterval(interval);
    }
  }, 1500);
}

// ── 10. Initialization ────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Initialize draggable elements
  makeDraggable(blurBox);
  makeResizable(blurBox);
  makeDraggable(logoElement);
  makeDraggable(textElement);

  // Set default marquee animation
  updateMarqueeAnimation();

  // Video Time Update
  previewVideo.addEventListener('timeupdate', () => {
    const cur = Math.floor(previewVideo.currentTime);
    const dur = Math.floor(previewVideo.duration || 0);
    const format = (s) => `${Math.floor(s/60).toString().padStart(2, '0')}:${(s%60).toString().padStart(2, '0')}`;
    document.getElementById('video-time-display').innerText = `${format(cur)} / ${format(dur)}`;
  });
});
