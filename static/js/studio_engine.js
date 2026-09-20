/**
 * «នាគហ្សង បកប្រែ» (Neak Zong Translate AI)
 * Mobile Studio Engine — 50/50 Split Screen, Touch Overlays, License Management & Ultra-Fast Engine
 */

// ── Global State ──────────────────────────────────────────
const state = {
  videoFile: null,
  videoFilename: null,
  videoUrl: null,
  srtContent: null,
  translatedSrt: null,
  activeTab: 'text',
  licenseValid: false,
  licenseInfo: null,
  adminAuthenticated: false,
  selectedLicType: 'days',
  
  // Anti-Copyright Settings
  flipHorizontal: false,
  cropPercent: 0,
  brightness: 0,
  contrast: 1.0,
  
  // Overlays (STRICT: Hidden by default until toggled)
  blurMask: {
    enabled: false,
    x: 15,
    y: 15,
    w: 120,
    h: 45
  },
  logoOverlay: {
    enabled: false,
    x: 15,
    y: 15,
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
    x: 15,
    y: 30
  },
  marquee: {
    enabled: false,
    text: 'សូមចុច Subscribe & Follow «នាគហ្សង បកប្រែ AI»',
    direction: 'up',
    speedSec: 8,
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

const blurBox = document.getElementById('blur-overlay-box');
const logoElement = document.getElementById('logo-overlay-element');
const textElement = document.getElementById('text-overlay-element');
const marqueeElement = document.getElementById('marquee-overlay-element');
const marqueeTrack = document.getElementById('marquee-track');

// Toast Notification
function showToast(text, duration = 3000) {
  const t = document.getElementById('toast-notification');
  if (!t) return;
  t.innerText = text;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ══════════════════════════════════════════════════════════
// 🔑 1. LICENSE SYSTEM & ACTIVATION (MOBILE & ADMIN)
// ══════════════════════════════════════════════════════════

async function checkLicenseStatus() {
  try {
    const res = await fetch('/api/license/status');
    const data = await res.json();
    const pill = document.getElementById('header-license-pill');
    const txt = document.getElementById('header-license-text');
    const modalBadge = document.getElementById('modal-lic-status-badge');

    if (data.valid) {
      state.licenseValid = true;
      state.licenseInfo = data.info;
      const rem = data.info?.remaining_text || 'សកម្ម';
      txt.innerText = rem;
      pill.classList.remove('locked');
      pill.title = `License សកម្ម: ${rem}`;
      if (modalBadge) {
        modalBadge.innerHTML = `🟢 <b>License សកម្ម:</b> ${rem}`;
        modalBadge.style.color = '#34d399';
      }
    } else {
      state.licenseValid = false;
      state.licenseInfo = null;
      txt.innerText = '🔐 Activate Key';
      pill.classList.add('locked');
      pill.title = 'License មិនទាន់ Activate ឬផុតកំណត់';
      if (modalBadge) {
        modalBadge.innerHTML = `🔴 <b>ស្ថានភាព:</b> ${data.message || 'មិនទាន់មាន Key'}`;
        modalBadge.style.color = '#f87171';
      }
    }
  } catch (err) {
    console.warn('License check error:', err);
  }
}

function openLicenseModal() {
  document.getElementById('activate-license-modal').classList.add('show');
  checkLicenseStatus();
}

function closeLicenseModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('activate-license-modal').classList.remove('show');
}

async function submitActivateLicense() {
  const keyInput = document.getElementById('license-key-input');
  const keyVal = (keyInput.value || '').trim();
  if (!keyVal) {
    showToast('⚠️ សូមបញ្ចូល License Key');
    keyInput.focus();
    return;
  }

  showToast('🔄 កំពុងផ្ទៀងផ្ទាត់ Key...');
  try {
    const res = await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyVal })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast('✓ ' + data.message);
      await checkLicenseStatus();
      setTimeout(() => closeLicenseModal(), 800);
    } else {
      showToast('⚠️ ' + (data.message || 'Key មិនត្រឹមត្រូវ'));
    }
  } catch (err) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ Server បានទេ');
  }
}

// Admin Modal Functions
function openAdminModal() {
  document.getElementById('admin-license-modal').classList.add('show');
  if (state.adminAuthenticated) {
    document.getElementById('admin-auth-section').style.display = 'none';
    document.getElementById('admin-generator-section').style.display = 'flex';
    loadAdminLicenseList();
  } else {
    document.getElementById('admin-auth-section').style.display = 'flex';
    document.getElementById('admin-generator-section').style.display = 'none';
  }
}

function closeAdminModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('admin-license-modal').classList.remove('show');
}

async function verifyAdminPassword() {
  const pwd = document.getElementById('admin-password-input').value.trim();
  try {
    const res = await fetch(`/api/admin/license/list?password=${encodeURIComponent(pwd)}`);
    const data = await res.json();
    if (data.status === 'ok') {
      state.adminAuthenticated = true;
      document.getElementById('admin-auth-section').style.display = 'none';
      document.getElementById('admin-generator-section').style.display = 'flex';
      showToast('✓ ស្វាគមន៍ Admin!');
      renderAdminLicenseList(data.licenses);
    } else {
      showToast('⚠️ Admin Password មិនត្រឹមត្រូវឡើយ');
    }
  } catch (e) {
    showToast('⚠️ មិនអាចផ្ទៀងផ្ទាត់ Password បានទេ');
  }
}

function selectLicType(type) {
  state.selectedLicType = type;
  document.querySelectorAll('.lic-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  const valRow = document.getElementById('admin-val-row');
  const valLabel = document.getElementById('admin-val-label');
  const valInput = document.getElementById('admin-val-input');

  if (type === 'lifetime') {
    valRow.style.display = 'none';
  } else {
    valRow.style.display = 'flex';
    if (type === 'seconds') { valLabel.innerText = 'ចំនួនវិនាទី (Seconds)'; valInput.value = 60; }
    else if (type === 'minutes') { valLabel.innerText = 'ចំនួននាទី (Minutes)'; valInput.value = 30; }
    else if (type === 'hours') { valLabel.innerText = 'ចំនួនម៉ោង (Hours)'; valInput.value = 24; }
    else if (type === 'days') { valLabel.innerText = 'ចំនួនថ្ងៃ (Days)'; valInput.value = 30; }
    else if (type === 'weeks') { valLabel.innerText = 'ចំនួនអាទិត្យ (Weeks)'; valInput.value = 1; }
    else if (type === 'months') { valLabel.innerText = 'ចំនួនខែ (Months)'; valInput.value = 1; }
    else if (type === 'years') { valLabel.innerText = 'ចំនួនឆ្នាំ (Years)'; valInput.value = 1; }
  }
}

async function submitAdminGenerateKey() {
  const pwd = document.getElementById('admin-password-input').value.trim();
  const val = parseInt(document.getElementById('admin-val-input').value) || 30;
  const note = document.getElementById('admin-note-input').value.trim();

  try {
    const res = await fetch('/api/admin/license/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: pwd,
        type: state.selectedLicType,
        value: val,
        note: note
      })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      const createdKey = data.license.key;
      document.getElementById('admin-result-box').style.display = 'block';
      document.getElementById('admin-created-key-val').value = createdKey;
      showToast('✓ ' + data.message);
      loadAdminLicenseList();
    } else {
      showToast('⚠️ ' + (data.message || 'បរាជ័យក្នុងការបង្កើត Key'));
    }
  } catch (err) {
    showToast('⚠️ កំហុស Server');
  }
}

function copyCreatedKey() {
  const keyVal = document.getElementById('admin-created-key-val').value;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(keyVal).then(() => {
      showToast(`📋 បានចម្លង Key: ${keyVal}`);
    });
  } else {
    showToast(`📋 Key: ${keyVal}`);
  }
}

async function loadAdminLicenseList() {
  const pwd = document.getElementById('admin-password-input').value.trim();
  try {
    const res = await fetch(`/api/admin/license/list?password=${encodeURIComponent(pwd)}`);
    const data = await res.json();
    if (data.status === 'ok') {
      renderAdminLicenseList(data.licenses);
    }
  } catch (err) {}
}

function renderAdminLicenseList(licenses) {
  const container = document.getElementById('admin-keys-list');
  if (!container) return;
  container.innerHTML = '';
  const keys = Object.keys(licenses || {});
  if (keys.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center;">មិនទាន់មាន Key ទេ</div>';
    return;
  }

  keys.reverse().forEach(k => {
    const item = licenses[k];
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; background: rgba(255,255,255,0.02); border-radius: 4px; border-bottom: 1px solid rgba(255,255,255,0.05);';
    
    const isAct = item.status === 'active';
    const typeTxt = item.lifetime ? 'មួយជីវិត' : `${item.duration_val} ${item.type}`;
    
    row.innerHTML = `
      <div style="display: flex; flex-direction: column;">
        <span style="font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">${item.key}</span>
        <span style="font-size: 0.65rem; color: var(--text-muted);">${typeTxt} • ${item.note || 'No note'}</span>
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        <span style="font-size: 0.62rem; color: ${isAct ? '#34d399' : '#f87171'}; font-weight: 700;">${item.status}</span>
        <button type="button" class="btn-ctrl" onclick="revokeAdminKey('${item.key}')" style="font-size: 0.6rem; padding: 2px 5px; color: #f87171;">Revoke</button>
      </div>
    `;
    container.appendChild(row);
  });
}

async function revokeAdminKey(key) {
  if (!confirm(`តើអ្នកពិតជាចង់ Revoke Key ${key} នេះមែនទេ?`)) return;
  const pwd = document.getElementById('admin-password-input').value.trim();
  try {
    const res = await fetch('/api/admin/license/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, key: key })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast(`✓ Key ${key} ត្រូវបាន Revoke!`);
      loadAdminLicenseList();
      checkLicenseStatus();
    }
  } catch (err) {}
}

// ══════════════════════════════════════════════════════════
// ⚡ 2. TAB NAVIGATION (COMPACT 7 TABS)
// ══════════════════════════════════════════════════════════
function switchStudioTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel-card').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-panel-${tabId}`);
  });
}

// ══════════════════════════════════════════════════════════
// ⚡ 3. MEDIA UPLOAD & HANDLING
// ══════════════════════════════════════════════════════════
async function handleVideoUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  state.videoFile = file;

  const placeholder = document.getElementById('video-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  const localUrl = URL.createObjectURL(file);
  previewVideo.style.display = 'block';
  previewVideo.src = localUrl;
  previewVideo.muted = true;
  previewVideo.playsInline = true;
  previewVideo.setAttribute('playsinline', '');
  previewVideo.setAttribute('webkit-playsinline', '');
  previewVideo.load();

  previewVideo.onloadedmetadata = () => {
    try {
      previewVideo.currentTime = 0.05;
    } catch (err) {}
    updateVideoTime();
  };

  previewVideo.oncanplay = () => {
    previewVideo.play().catch(() => {});
  };

  showToast('✓ វីដេអូបានបើកក្នុង Player Preview 9:16!');

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

function updateVideoTime() {
  const cur = Math.floor(previewVideo.currentTime || 0);
  const dur = Math.floor(previewVideo.duration || 0);
  const format = (s) => `${Math.floor(s/60).toString().padStart(2, '0')}:${(s%60).toString().padStart(2, '0')}`;
  const el = document.getElementById('video-time-display');
  if (el) el.innerText = `${format(cur)} / ${format(dur)}`;
}

// ══════════════════════════════════════════════════════════
// ⚡ 4. CHINESE-TO-KHMER TRANSLATION & TTS
// ══════════════════════════════════════════════════════════
async function triggerAiTranslation() {
  if (!state.licenseValid) {
    showToast('🔐 សូម Activate License Key ជាមុនសិន!');
    openLicenseModal();
    return;
  }

  const customText = document.getElementById('translate-input-text').value.trim();
  showToast('⚡ AI កំពុងស្ដាប់សំឡេងចិន និងបកប្រែជាភាសាខ្មែរ...');

  try {
    const payload = {};
    if (state.srtContent) {
      payload.srt_content = state.srtContent;
    } else if (state.videoFilename) {
      payload.video_filename = state.videoFilename;
    } else if (customText) {
      payload.text = customText;
    } else {
      payload.text = '皇上驾到，万岁万万岁！微臣参见陛下。';
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
        showToast(`✓ AI បកប្រែបាន ${data.cues_count || ''} ឃ្លាជោគជ័យ!`);
      } else {
        document.getElementById('translate-result-text').innerText = data.translated;
        showToast('✓ បកប្រែជោគជ័យ!');
      }
    } else if (data.license_required) {
      showToast('🔐 ' + data.error);
      openLicenseModal();
    } else {
      showToast('⚠️ ការបកប្រែមានបញ្ហា');
    }
  } catch (e) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបកប្រែបានទេ');
  }
}

async function triggerKhmerTts() {
  if (!state.licenseValid) {
    showToast('🔐 សូម Activate License Key ជាមុនសិន!');
    openLicenseModal();
    return;
  }

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
    } else if (data.license_required) {
      showToast('🔐 ' + data.error);
      openLicenseModal();
    } else {
      showToast('⚠️ បរាជ័យក្នុងការបង្កើតសំឡេង');
    }
  } catch (e) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ម៉ាស៊ីនសំឡេងបានទេ');
  }
}

// ══════════════════════════════════════════════════════════
// ⚡ 5. OVERLAYS CONTROLS (Live reflected on left 9:16 preview)
// ══════════════════════════════════════════════════════════
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

function toggleMarqueeOverlay(enabled) {
  state.marquee.enabled = enabled;
  marqueeElement.classList.toggle('active-visible', enabled);
  updateMarqueeAnimation();
  showToast(enabled ? '✓ បានបើកអក្សររត់ (Marquee)' : 'បានបិទអក្សររត់');
}

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

// ══════════════════════════════════════════════════════════
// ⚡ 6. ANTI-COPYRIGHT & VIDEO CONTROLS
// ══════════════════════════════════════════════════════════
function toggleFlipHorizontal(flipped) {
  state.flipHorizontal = flipped;
  updateVideoCssFilters();
  showToast(flipped ? '✓ ត្រឡប់ Flip 180° Mirror' : 'បានបិទ Flip');
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

// ══════════════════════════════════════════════════════════
// ⚡ 7. TOUCH & DRAG SYSTEM (Optimized for Mobile Viewport)
// ══════════════════════════════════════════════════════════
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
    element.style.width = `${Math.max(30, startW + dw)}px`;
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

// ══════════════════════════════════════════════════════════
// ⚡ 8. 1-CLICK AUTO PIPELINE & ULTRA-FAST CHUNKED EXPORT
// ══════════════════════════════════════════════════════════
async function triggerAutoProcessPipeline() {
  if (!state.licenseValid) {
    showToast('🔐 សូម Activate License Key ជាមុនសិន!');
    openLicenseModal();
    return;
  }

  if (!state.videoFile && !state.videoFilename) {
    showToast('⚠️ សូមរើសវីដេអូចិនជាមុនសិន (Pick Video)');
    document.getElementById('video-file-input').click();
    return;
  }

  const progressWrap = document.getElementById('render-progress-wrap');
  const progressBar = document.getElementById('render-progress-bar');
  const progressStatus = document.getElementById('render-progress-status');
  const downloadBtn = document.getElementById('btn-download-result');

  progressWrap.style.display = 'flex';
  downloadBtn.style.display = 'none';
  progressBar.style.width = '10%';
  progressStatus.innerText = 'កំពុង Upload វីដេអូទៅ Server...';

  if (!state.videoFilename && state.videoFile) {
    const formData = new FormData();
    formData.append('file', state.videoFile);
    try {
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
    } else if (data.license_required) {
      showToast('🔐 ' + data.error);
      progressWrap.style.display = 'none';
      openLicenseModal();
    } else {
      showToast('⚠️ បរាជ័យក្នុងការចាប់ផ្ដើម Auto Pipeline');
      progressWrap.style.display = 'none';
    }
  } catch (err) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបានទេ');
    progressWrap.style.display = 'none';
  }
}

async function triggerRenderExport() {
  if (!state.licenseValid) {
    showToast('🔐 សូម Activate License Key ជាមុនសិន!');
    openLicenseModal();
    return;
  }

  if (!state.videoFile && !state.videoFilename) {
    showToast('⚠️ សូមរើសវីដេអូជាមុនសិន');
    document.getElementById('video-file-input').click();
    return;
  }

  const progressWrap = document.getElementById('render-progress-wrap');
  const progressBar = document.getElementById('render-progress-bar');
  const progressStatus = document.getElementById('render-progress-status');
  const downloadBtn = document.getElementById('btn-download-result');

  progressWrap.style.display = 'flex';
  downloadBtn.style.display = 'none';
  progressBar.style.width = '15%';
  progressStatus.innerText = 'កំពុងចាប់ផ្ដើម Render HD Video (Ultra-Fast Engine)...';

  if (!state.videoFilename && state.videoFile) {
    const formData = new FormData();
    formData.append('file', state.videoFile);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'ok') state.videoFilename = data.filename;
    } catch (e) {
      showToast('⚠️ បរាជ័យក្នុងការ Upload');
      progressWrap.style.display = 'none';
      return;
    }
  }

  try {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_name: state.videoFilename,
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
    } else if (data.license_required) {
      showToast('🔐 ' + data.error);
      progressWrap.style.display = 'none';
      openLicenseModal();
    } else {
      showToast('⚠️ កំហុសក្នុងការ Render');
      progressWrap.style.display = 'none';
    }
  } catch (err) {
    showToast('⚠️ កំហុស Server');
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

// ══════════════════════════════════════════════════════════
// ⚡ 9. INITIALIZATION
// ══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  // Check License on startup
  checkLicenseStatus();

  // Initialize draggable elements
  makeDraggable(blurBox);
  makeResizable(blurBox);
  makeDraggable(logoElement);
  makeDraggable(textElement);

  // Set default marquee animation
  updateMarqueeAnimation();

  // Video Time Update listener
  previewVideo.addEventListener('timeupdate', updateVideoTime);
});
