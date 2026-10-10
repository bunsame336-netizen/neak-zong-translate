/**
 * «នាគហ្សង បកប្រែ» (Neak Zong Translate AI)
 * Mobile Studio Engine v2.1.0 — Dual-Tone Text, Blur/Logo Sliders, Marquee 4-Dir, Khmer Effects
 */

// ── Global State ──────────────────────────────────────────
const state = {
  videoFile: null,
  videoFilename: null,
  videoUploaded: false,
  videoUrl: null,
  localVideoUrl: null,
  srtContent: null,
  translatedSrt: null,
  activeTab: 'blur',
  auto_activate: true,
  licenseValid: true,
  adminUnlocked: true,
  licenseInfo: { key: 'ADMIN-VIP-MASTER', type: 'lifetime', remaining_text: 'Admin VIP មួយជីវិត' },
  adminAuthenticated: true,
  selectedLicType: 'days',
  
  // Anti-Copyright Settings
  flipHorizontal: false,
  cropPercent: 0,
  brightness: 0,
  contrast: 1.0,
  
  // Blur Mask (Horizontal Rectangle for Watermark/Logo)
  blurMask: {
    enabled: false,
    x: 15,
    y: 15,
    w: 140,
    h: 45,
    intensity: 25,
    tintOpacity: 0.40
  },

  // Logo Overlay (controlled by drag + sliders)
  logoOverlay: {
    enabled: false,
    x: 15,
    y: 15,
    scale: 0.25,
    opacity: 0.9,
    path: null
  },

  // Dual-Tone Text Overlay
  textOverlay: {
    enabled: false,
    font: "'Moul', serif",
    size: 26,
    x: 15,
    y: 30,
    transparentMode: false,
    motion: 'none', // 'none' | 'up' | 'down'
    speedSec: 8.0
  },
  textPart1: {
    enabled: true,
    text: 'នាគហ្សង',
    color: '#f59e0b',
    effect: 'glow',
    outlineColor: '#000000',
    outlineW: 2
  },
  textPart2: {
    enabled: true,
    text: 'បកប្រែ',
    color: '#22d3ee',
    effect: 'shadow',
    outlineColor: '#000000',
    outlineW: 2
  },

  // Marquee
  marquee: {
    enabled: false,
    text: 'សូមចុច Subscribe & Follow «នាគហ្សង បកប្រែ AI»',
    direction: 'up',
    speedSec: 8,
    color: '#f59e0b',
    fontSize: 22,
    font: "'Kantumruy Pro', sans-serif",
    effect: 'none',    // 'none' | 'shadow' | 'glow' | 'outline'
    glowColor: '#c084fc'
  },

  // Sponsor Overlay (2 Short Lines: Top Ad + Bottom Contact)
  sponsor: {
    enabled: false,
    topLine: '📢 ទទួលផ្សាយពាណិជ្ជកម្ម / Sponsor',
    bottomLine: '📱 012 345 678 | Telegram',
    position: 'bottom',
    yPercent: 88,
    color: '#f59e0b',
    fontSize: 17,
    duration: 15,
    bgColor: 'rgba(8, 6, 18, 0.90)'
  },

  // Khmer Voice & Audio
  voice: 'female', // 'male' (Piseth) or 'female' (Sreymom)
  voiceSpeed: 1.0,
  pitch: 0,
  duckLevel: 0.15,
  isProcessing: false
};

// ── DOM References ────────────────────────────────────────
const previewVideo = document.getElementById('previewVideo') || document.getElementById('preview-video');
if (previewVideo) {
  window.previewVideo = previewVideo;
}
const videoViewport = document.getElementById('video-viewport');
const videoOverlayLayer = document.getElementById('video-overlay-layer');

const blurBox = document.getElementById('blur-overlay-box');
const logoElement = document.getElementById('logo-overlay-element');
const textElement = document.getElementById('text-overlay-element');
const marqueeElement = document.getElementById('marquee-overlay-element');
const marqueeTrack = document.getElementById('marquee-track');

const sponsorElement = document.getElementById('sponsor-overlay-element');
const sponsorTopTag = document.getElementById('sponsor-top-tag') || document.getElementById('sponsor-brand-tag');
const sponsorBottomTag = document.getElementById('sponsor-bottom-tag') || document.getElementById('sponsor-contact-tag');

// Tab Navigation Switching
function switchStudioTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-nav-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabId;
    btn.classList.toggle('active', isTarget);
    // REMOVED auto-scroll: No scrollIntoView to prevent page jump
  });
  document.querySelectorAll('.tab-panel-card').forEach(panel => {
    panel.classList.remove('active');
  });
  const targetPanel = document.getElementById(`tab-panel-${tabId}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
  if (tabId === 'blur') {
    updateBlurBoxLimits();
  }
}

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

    // Always unlock 100% for Admin
    state.licenseValid = true;
    state.adminUnlocked = true;
    state.licenseInfo = data.info || { remaining_text: 'Admin VIP មួយជីវិត' };
    const rem = data.info?.remaining_text || 'Admin VIP មួយជីវិត';
    if (txt) txt.innerText = '👑 Admin VIP';
    if (pill) {
      pill.classList.remove('locked');
      pill.title = `Admin VIP Master: ${rem}`;
    }
    if (modalBadge) {
      modalBadge.innerHTML = `🟢 <b>Admin VIP:</b> ${rem}`;
      modalBadge.style.color = '#34d399';
    }
  } catch (err) {
    state.licenseValid = true;
    state.adminUnlocked = true;
    const txt = document.getElementById('header-license-text');
    if (txt) txt.innerText = '👑 Admin VIP';
  }
}

function openLicenseModal() {
  return false;
}

function closeLicenseModal(e) {
  return false;
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
  const modal = document.getElementById('admin-license-modal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
  state.adminAuthenticated = true;
  const authSec = document.getElementById('admin-auth-section');
  const genSec = document.getElementById('admin-generator-section');
  if (authSec) authSec.style.display = 'none';
  if (genSec) genSec.style.display = 'flex';
  loadAdminLicenseList();
}

function closeAdminModal(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('modal-close-btn')) return;
  const modal = document.getElementById('admin-license-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
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
// ⚡ 2. MEDIA UPLOAD & HANDLING
// ══════════════════════════════════════════════════════════
let _isUploadingVideo = false;
function handleVideoUpload(input) {
  if (_isUploadingVideo) return;
  _isUploadingVideo = true;
  setTimeout(() => { _isUploadingVideo = false; }, 400);

  const files = input.files || (input.target && input.target.files);
  if (!files || files.length === 0) return;
  const file = files[0];
  state.videoFile = file;
  state.videoFilename = file.name;
  state.videoUploaded = false;

  const placeholder = document.getElementById('video-placeholder');
  const video = document.getElementById('previewVideo') || document.querySelector('video') || document.getElementById('preview-video');
  if (!video) return;

  showToast('⏳ កំពុងដំណើរការវីដេអូ...');

  if (state.localVideoUrl && state.localVideoUrl.startsWith('blob:')) {
    try { URL.revokeObjectURL(state.localVideoUrl); } catch (e) {}
  }

  if (placeholder) placeholder.style.display = 'none';
  video.style.display = 'block';
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'contain';
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  window.previewVideo = video;

  // ⚡ 1. PRIMARY: Instant HTML5 File Object URL (Hardware Decoded, 0 RAM latency)
  let playedViaBlob = false;
  try {
    const objUrl = URL.createObjectURL(file);
    if (objUrl) {
      video.src = objUrl;
      state.localVideoUrl = objUrl;
      video.muted = false;
      video.load();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Autoplay unmuted blocked, playing muted:', err);
          video.muted = true;
          video.play().catch(e2 => console.warn('Muted play also blocked:', e2));
        });
      }
      playedViaBlob = true;
      showToast('✓ វីដេអូចាក់លើ Live Preview ជោគជ័យ!');
    }
  } catch (err) {
    console.warn('URL.createObjectURL failed, falling back to FileReader:', err);
  }

  // Fallback to FileReader ONLY if URL.createObjectURL threw an exception
  if (!playedViaBlob) {
    const reader = new FileReader();
    reader.onload = (e) => {
      video.src = e.target.result;
      state.localVideoUrl = e.target.result;
      video.muted = false;
      video.load();
      video.play().catch(() => { video.muted = true; video.play(); });
      showToast('✓ វីដេអូចាក់លើ Live Preview ជោគជ័យ!');
    };
    reader.readAsDataURL(file);
  }

  // ⚡ 2. Auto-Upload to Server in Background so Server Has the Video Ready
  const uploadFormData = new FormData();
  uploadFormData.append('file', file);
  state.isUploading = true;
  fetch('/api/upload', { method: 'POST', body: uploadFormData })
    .then(r => r.json())
    .then(data => {
      state.isUploading = false;
      if (data.status === 'ok') {
        state.videoFilename = data.filename;
        state.videoUploaded = true;
        console.log('Background upload completed:', data.filename);
      }
    })
    .catch(e => {
      state.isUploading = false;
      console.warn('Background upload failed, will upload on render:', e);
    });

  video.onloadedmetadata = function() {
    const isLandscape = (video.videoWidth || 9) > (video.videoHeight || 16);
    const vp = document.getElementById('video-viewport');
    if (vp) {
      vp.style.aspectRatio = isLandscape ? '16 / 9' : '9 / 16';
    }
    updateVideoTime();
  };
  video.ontimeupdate = updateVideoTime;
  video.onplay = () => {
    if (state.sponsor.enabled) startSponsorCycle();
  };
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
  const video = document.getElementById('previewVideo') || document.getElementById('preview-video') || previewVideo;
  if (!video) return;
  const cur = Math.floor(video.currentTime || 0);
  const dur = Math.floor(video.duration || 0);
  const format = (s) => `${Math.floor(s/60).toString().padStart(2, '0')}:${(s%60).toString().padStart(2, '0')}`;
  const el = document.getElementById('video-time-display');
  if (el) el.innerText = `${format(cur)} / ${format(dur)}`;
  const scrubber = document.getElementById('video-scrubber');
  if (scrubber && dur > 0) {
    scrubber.value = ((video.currentTime || 0) / dur) * 100;
  }
}

function toggleCornerMute() {
  const video = document.getElementById('previewVideo') || document.getElementById('preview-video') || previewVideo;
  const btn = document.getElementById('btn-corner-mute');
  if (!video) return;
  video.muted = !video.muted;
  if (btn) {
    btn.innerText = video.muted ? 'Unmute' : 'Mute';
    btn.style.background = video.muted ? '#64748b' : '#ef4444';
  }
}

function onScrubVideo(val) {
  const video = document.getElementById('previewVideo') || document.getElementById('preview-video') || previewVideo;
  if (video && video.duration) {
    video.currentTime = (val / 100) * video.duration;
  }
}

// ══════════════════════════════════════════════════════════
// ⚡ 4. CHINESE-TO-KHMER TRANSLATION & TTS
// ══════════════════════════════════════════════════════════
async function triggerAiTranslation() {
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
    } else {
      showToast(data.error ? ('⚠️ ' + data.error) : '⚠️ ការបកប្រែមានបញ្ហា');
    }
  } catch (e) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបកប្រែបានទេ');
  }
}

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
      showToast(data.error ? ('⚠️ ' + data.error) : '⚠️ បរាជ័យក្នុងការបង្កើតសំឡេង');
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
  showToast(enabled ? '✓ បានបើកអក្សរ Dual-Tone' : 'បានបិទអក្សរ');
}

function setQuickTextColor(colorHex) {
  const p1Col = document.getElementById('text-part1-color');
  const p2Col = document.getElementById('text-part2-color');
  if (p1Col) p1Col.value = colorHex;
  if (p2Col) p2Col.value = colorHex;
  state.textPart1.color = colorHex;
  state.textPart2.color = colorHex;
  updateDualTonePreview();
  showToast(`✓ បានប្ដូរពណ៌អក្សរ: ${colorHex}`);
}

function setTextPartColor(partNum, colorHex) {
  if (partNum === 1) {
    const p1Col = document.getElementById('text-part1-color');
    if (p1Col) p1Col.value = colorHex;
    state.textPart1.color = colorHex;
  } else {
    const p2Col = document.getElementById('text-part2-color');
    if (p2Col) p2Col.value = colorHex;
    state.textPart2.color = colorHex;
  }
  updateDualTonePreview();
  showToast(`✓ ពណ៌ពាក្យ ${partNum}: ${colorHex}`);
}

function toggleTextTransparentMode(enabled) {
  state.textOverlay.transparentMode = enabled;
  const rendered = document.getElementById('rendered-text-val');
  const txtEl = document.getElementById('text-overlay-element');
  if (rendered) {
    rendered.classList.toggle('transparent-mode', enabled);
  }
  if (txtEl) {
    txtEl.classList.toggle('transparent-mode', enabled);
  }
  const p1Span = document.getElementById('text-part1-preview');
  const p2Span = document.getElementById('text-part2-preview');
  if (enabled) {
    if (p1Span) { p1Span.style.textShadow = 'none'; p1Span.style.webkitTextStroke = 'none'; }
    if (p2Span) { p2Span.style.textShadow = 'none'; p2Span.style.webkitTextStroke = 'none'; }
  } else {
    updateDualTonePreview();
  }
  showToast(enabled ? '✓ បានដោះផ្ទៃខាងក្រោយ (Transparent Mode)' : 'បានបិទ Transparent Mode');
}

function updateTextPosition() {
  const x = parseInt(document.getElementById('text-x-slider')?.value || 15);
  const y = parseInt(document.getElementById('text-y-slider')?.value || 30);
  state.textOverlay.x = x;
  state.textOverlay.y = y;
  if (textElement) {
    textElement.style.left = `${x}px`;
    textElement.style.top = `${y}px`;
  }
}

// ── TEXT MOTION CONTROLS (UP / DOWN / NONE + 60FPS SPEED) ──
function setTextMotion(mode) {
  state.textOverlay.motion = mode;
  ['none', 'up', 'down'].forEach(m => {
    const btn = document.getElementById(`text-motion-${m}`);
    if (btn) btn.classList.toggle('active', m === mode);
  });
  applyTextMotionStyles();
  showToast(mode === 'none' ? 'អក្សរនៅមួយកន្លែង (Static)' : (mode === 'up' ? '⬆️ អក្សររត់ពីក្រោមឡើងលើ' : '⬇️ អក្សររត់ពីលើចុះក្រោម'));
}

function setTextSpeedSeconds(sec) {
  const val = parseFloat(sec) || 8.0;
  state.textOverlay.speedSec = val;
  const valEl = document.getElementById('text-speed-val');
  if (valEl) valEl.innerText = `${val}s`;
  const slider = document.getElementById('text-speed-slider');
  if (slider && parseFloat(slider.value) !== val) slider.value = val;
  applyTextMotionStyles();
}

function applyTextMotionStyles() {
  const textEl = document.getElementById('text-overlay-element');
  if (!textEl) return;
  const motion = state.textOverlay.motion || 'none';
  const speed = state.textOverlay.speedSec || 8.0;

  textEl.classList.remove('text-scroll-up', 'text-scroll-down');
  textEl.style.animation = 'none';

  if (motion === 'up') {
    textEl.style.setProperty('--text-speed', `${speed}s`);
    void textEl.offsetHeight;
    textEl.classList.add('text-scroll-up');
  } else if (motion === 'down') {
    textEl.style.setProperty('--text-speed', `${speed}s`);
    void textEl.offsetHeight;
    textEl.classList.add('text-scroll-down');
  } else {
    updateTextPosition();
  }
}

// ── DUAL-TONE TEXT PREVIEW ─────────────────────────────────
function updateDualTonePreview() {
  // Read Part 1
  state.textPart1.text = document.getElementById('text-part1-input')?.value || '';
  state.textPart1.color = document.getElementById('text-part1-color')?.value || '#f59e0b';
  state.textPart1.effect = document.getElementById('text-part1-effect')?.value || 'none';
  state.textPart1.outlineColor = document.getElementById('text-part1-outline-color')?.value || '#000000';

  // Read Part 2
  state.textPart2.text = document.getElementById('text-part2-input')?.value || '';
  state.textPart2.color = document.getElementById('text-part2-color')?.value || '#22d3ee';
  state.textPart2.effect = document.getElementById('text-part2-effect')?.value || 'none';
  state.textPart2.outlineColor = document.getElementById('text-part2-outline-color')?.value || '#000000';

  // Read font
  state.textOverlay.font = document.getElementById('text-font-select')?.value || "'Moul', serif";

  // Show/hide outline rows
  const p1eff = state.textPart1.effect;
  const p1outRow = document.getElementById('part1-outline-row');
  if (p1outRow) p1outRow.style.display = p1eff === 'outline' ? 'flex' : 'none';

  const p2eff = state.textPart2.effect;
  const p2outRow = document.getElementById('part2-outline-row');
  if (p2outRow) p2outRow.style.display = p2eff === 'outline' ? 'flex' : 'none';

  // Update preview spans
  const p1Span = document.getElementById('text-part1-preview');
  const p2Span = document.getElementById('text-part2-preview');
  if (p1Span) {
    p1Span.innerText = state.textPart1.text;
    p1Span.style.color = state.textPart1.color;
    p1Span.style.fontFamily = state.textOverlay.font;
    p1Span.style.fontSize = (state.textOverlay.size || 26) + 'px';
    _applyEffectToSpan(p1Span, state.textPart1.effect, state.textPart1.color, state.textPart1.outlineColor);
  }
  if (p2Span) {
    p2Span.innerText = ' ' + state.textPart2.text;
    p2Span.style.color = state.textPart2.color;
    p2Span.style.fontFamily = state.textOverlay.font;
    p2Span.style.fontSize = (state.textOverlay.size || 26) + 'px';
    _applyEffectToSpan(p2Span, state.textPart2.effect, state.textPart2.color, state.textPart2.outlineColor);
  }
}

function _applyEffectToSpan(span, effect, color, outlineColor) {
  span.style.textShadow = '';
  span.style.webkitTextStroke = '';

  if (state.textOverlay.transparentMode) {
    return;
  }

  switch (effect) {
    case 'shadow':
      span.style.textShadow = '2px 2px 4px rgba(0,0,0,0.85)';
      break;
    case 'glow':
      span.style.textShadow = `0 0 8px ${color}, 0 0 20px ${color}88, 0 0 40px ${color}44`;
      break;
    case 'outline':
      span.style.webkitTextStroke = `2px ${outlineColor || '#000'}`;
      break;
    default:
      break;
  }
}


// ── BLUR BOX SLIDERS (HORIZONTAL RECTANGLE: W: 50-280px, H: 20-80px) ──────
function updateBlurBoxLimits() {
  const vpW = (videoViewport && videoViewport.clientWidth) || 280;
  const vpH = (videoViewport && videoViewport.clientHeight) || 320;
  const wSlider = document.getElementById('blur-w-slider');
  const hSlider = document.getElementById('blur-h-slider');
  const xSlider = document.getElementById('blur-x-slider');
  const ySlider = document.getElementById('blur-y-slider');
  if (wSlider) {
    wSlider.min = 50;
    wSlider.max = 280;
  }
  if (hSlider) {
    hSlider.min = 20;
    hSlider.max = 80;
  }
  if (xSlider) xSlider.max = Math.max(0, vpW - (state.blurMask.w || 140));
  if (ySlider) ySlider.max = Math.max(0, vpH - (state.blurMask.h || 45));
}

function updateBlurBoxFromSliders() {
  if (!state.blurMask.enabled) {
    state.blurMask.enabled = true;
    const toggle = document.getElementById('toggle-blur');
    if (toggle) toggle.checked = true;
    if (blurBox) {
      blurBox.classList.add('active-visible');
      blurBox.style.display = 'block';
    }
  }

  const w = parseInt(document.getElementById('blur-w-slider')?.value || 140);
  const h = parseInt(document.getElementById('blur-h-slider')?.value || 45);
  const x = parseInt(document.getElementById('blur-x-slider')?.value || 15);
  const y = parseInt(document.getElementById('blur-y-slider')?.value || 15);

  state.blurMask.x = x;
  state.blurMask.y = y;
  state.blurMask.w = w;
  state.blurMask.h = h;

  if (blurBox) {
    blurBox.style.left = `${x}px`;
    blurBox.style.top = `${y}px`;
    blurBox.style.width = `${w}px`;
    blurBox.style.height = `${h}px`;
  }

  const wVal = document.getElementById('blur-w-val');
  const hVal = document.getElementById('blur-h-val');
  const xVal = document.getElementById('blur-x-val');
  const yVal = document.getElementById('blur-y-val');
  if (wVal) wVal.innerText = `${w}px`;
  if (hVal) hVal.innerText = `${h}px`;
  if (xVal) xVal.innerText = `${x}px`;
  if (yVal) yVal.innerText = `${y}px`;
}

function updateBlurIntensity(val) {
  if (!state.blurMask.enabled) {
    state.blurMask.enabled = true;
    const toggle = document.getElementById('toggle-blur');
    if (toggle) toggle.checked = true;
    if (blurBox) {
      blurBox.classList.add('active-visible');
      blurBox.style.display = 'block';
    }
  }
  const intVal = parseInt(val) || 25;
  state.blurMask.intensity = intVal;
  let label = `${intVal}`;
  if (intVal <= 15) label += ' (ស្រាល)';
  else if (intVal <= 35) label += ' (មធ្យម)';
  else label += ' (ខ្លាំង)';
  const labelEl = document.getElementById('blur-intensity-val');
  if (labelEl) labelEl.innerText = label;
  if (blurBox) {
    const px = Math.max(3, Math.round(intVal / 1.5));
    blurBox.style.backdropFilter = `blur(${px}px)`;
    blurBox.style.webkitBackdropFilter = `blur(${px}px)`;
  }
}

function setBlurPreset(level) {
  let val = 25;
  if (level === 'light') val = 10;
  else if (level === 'strong') val = 45;
  const slider = document.getElementById('blur-intensity-slider');
  if (slider) slider.value = val;
  ['btn-blur-light', 'btn-blur-med', 'btn-blur-strong'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  if (level === 'light') document.getElementById('btn-blur-light')?.classList.add('active');
  else if (level === 'medium') document.getElementById('btn-blur-med')?.classList.add('active');
  else if (level === 'strong') document.getElementById('btn-blur-strong')?.classList.add('active');
  updateBlurIntensity(val);
}

function updateBlurTint(val) {
  if (!state.blurMask.enabled) {
    state.blurMask.enabled = true;
    const toggle = document.getElementById('toggle-blur');
    if (toggle) toggle.checked = true;
    if (blurBox) {
      blurBox.classList.add('active-visible');
      blurBox.style.display = 'block';
    }
  }
  const pct = parseInt(val) || 0;
  state.blurMask.tintOpacity = pct / 100.0;
  const tintValEl = document.getElementById('blur-tint-val');
  if (tintValEl) tintValEl.innerText = `${pct}%`;
  if (blurBox) {
    blurBox.style.backgroundColor = `rgba(0, 0, 0, ${state.blurMask.tintOpacity})`;
  }
}

function setBlurCorner(corner) {
  const vpW = (videoViewport && videoViewport.clientWidth) || 280;
  const vpH = (videoViewport && videoViewport.clientHeight) || 320;
  const w = state.blurMask.w || 140;
  const h = state.blurMask.h || 45;
  let x = 15, y = 15;
  if (corner === 'top-left') { x = 10; y = 10; }
  else if (corner === 'top-right') { x = Math.max(0, vpW - w - 10); y = 10; }
  else if (corner === 'bottom-left') { x = 10; y = Math.max(0, vpH - h - 10); }
  else if (corner === 'bottom-right') { x = Math.max(0, vpW - w - 10); y = Math.max(0, vpH - h - 10); }

  const xSlider = document.getElementById('blur-x-slider');
  const ySlider = document.getElementById('blur-y-slider');
  if (xSlider) xSlider.value = x;
  if (ySlider) ySlider.value = y;
  updateBlurBoxFromSliders();
}

// ── SPONSOR CONTROLS (2-LINE CONCISE SPONSOR) ────
// ── SPONSOR CONTROLS (DYNAMIC POP-UP ANIMATED & TIMER) ────
let sponsorCycleTimer = null;
let sponsorExitTimer = null;

function setSponsorDuration(sec) {
  const val = parseInt(sec) || 15;
  state.sponsor.duration = val;
  const valEl = document.getElementById('sponsor-duration-val');
  if (valEl) valEl.innerText = `${val}s`;
  const slider = document.getElementById('sponsor-duration-slider');
  if (slider && parseInt(slider.value) !== val) slider.value = val;

  [10, 15, 20].forEach(d => {
    const btn = document.getElementById(`sponsor-dur-${d}`);
    if (btn) btn.classList.toggle('active', d === val);
  });

  restartSponsorCycle();
}

function startSponsorCycle() {
  stopSponsorCycle();
  if (!state.sponsor.enabled) return;

  const bar = document.getElementById('sponsor-banner-bar');
  if (!bar || !sponsorElement) return;

  sponsorElement.style.display = 'block';
  sponsorElement.classList.add('active-visible');

  // Trigger Pop-up Scale-in entry with bounce
  bar.classList.remove('sponsor-exiting');
  bar.classList.add('sponsor-entering');

  const durationMs = (state.sponsor.duration || 15) * 1000;

  // After duration ends -> Trigger Exit Animation (Smooth Slide-down / Fade-out)
  sponsorExitTimer = setTimeout(() => {
    bar.classList.remove('sponsor-entering');
    bar.classList.add('sponsor-exiting');

    // Wait for exit animation to complete (600ms) then hide completely
    setTimeout(() => {
      if (bar.classList.contains('sponsor-exiting')) {
        if (sponsorElement) {
          sponsorElement.style.display = 'none';
          sponsorElement.classList.remove('active-visible');
        }
        bar.classList.remove('sponsor-exiting');
      }
    }, 600);

    // Pause 5.6s before next cycle
    sponsorCycleTimer = setTimeout(() => {
      if (state.sponsor.enabled) {
        startSponsorCycle();
      }
    }, 5600);
  }, durationMs);
}

function stopSponsorCycle() {
  if (sponsorExitTimer) clearTimeout(sponsorExitTimer);
  if (sponsorCycleTimer) clearTimeout(sponsorCycleTimer);
  sponsorExitTimer = null;
  sponsorCycleTimer = null;
}

function restartSponsorCycle() {
  stopSponsorCycle();
  if (state.sponsor.enabled) {
    startSponsorCycle();
  }
}

function toggleSponsorOverlay(enabled) {
  state.sponsor.enabled = enabled;
  const toggle = document.getElementById('toggle-sponsor');
  if (toggle && toggle.checked !== enabled) toggle.checked = enabled;
  if (sponsorElement) {
    sponsorElement.classList.toggle('active-visible', enabled);
    sponsorElement.style.display = enabled ? 'block' : 'none';
  }
  updateSponsorContent();
  if (enabled) {
    startSponsorCycle();
  } else {
    stopSponsorCycle();
    const bar = document.getElementById('sponsor-banner-bar');
    if (bar) bar.classList.remove('sponsor-entering', 'sponsor-exiting');
  }
  showToast(enabled ? `✓ បានបើកដំណើរការ Sponsor (${state.sponsor.duration || 15}s Pop-up & Glow)` : 'បានបិទ Sponsor');
}

function updateSponsorContent() {
  const topText = (document.getElementById('sponsor-top-input')?.value || document.getElementById('sponsor-brand-input')?.value || '📢 ទទួលផ្សាយពាណិជ្ជកម្ម / Sponsor').trim();
  const bottomText = (document.getElementById('sponsor-bottom-input')?.value || document.getElementById('sponsor-contact-input')?.value || '📱 012 345 678 | Telegram').trim();
  const color = document.getElementById('sponsor-color-picker')?.value || '#f59e0b';
  const size = parseInt(document.getElementById('sponsor-size-slider')?.value || 17);
  const yPercent = parseInt(document.getElementById('sponsor-y-slider')?.value || 88);
  const bg = document.getElementById('sponsor-bg-select')?.value || 'rgba(8, 6, 18, 0.90)';

  state.sponsor.topLine = topText;
  state.sponsor.bottomLine = bottomText;
  state.sponsor.color = color;
  state.sponsor.fontSize = size;
  state.sponsor.yPercent = yPercent;
  state.sponsor.bgColor = bg;

  const topEl = document.getElementById('sponsor-top-tag') || document.getElementById('sponsor-brand-tag');
  const bottomEl = document.getElementById('sponsor-bottom-tag') || document.getElementById('sponsor-contact-tag');

  if (topEl) {
    topEl.innerText = topText;
    topEl.style.color = color;
    topEl.style.fontSize = size + 'px';
  }
  if (bottomEl) {
    bottomEl.innerText = bottomText;
    bottomEl.style.color = '#22d3ee';
    bottomEl.style.fontSize = Math.max(11, size - 3) + 'px';
  }
  const bannerBar = document.getElementById('sponsor-banner-bar');
  if (bannerBar) {
    bannerBar.style.backgroundColor = bg;
  }
  if (sponsorElement) {
    sponsorElement.style.bottom = 'auto';
    sponsorElement.style.top = `${yPercent}%`;
  }
}

function setSponsorPosition(pos) {
  state.sponsor.position = pos;
  document.getElementById('sponsor-pos-bottom')?.classList.toggle('active', pos === 'bottom');
  document.getElementById('sponsor-pos-top')?.classList.toggle('active', pos === 'top');
  const ySlider = document.getElementById('sponsor-y-slider');
  const yVal = document.getElementById('sponsor-y-val');
  if (pos === 'top') {
    state.sponsor.yPercent = 6;
    if (ySlider) ySlider.value = 6;
    if (yVal) yVal.innerText = '6%';
  } else {
    state.sponsor.yPercent = 88;
    if (ySlider) ySlider.value = 88;
    if (yVal) yVal.innerText = '88%';
  }
  if (sponsorElement) {
    sponsorElement.style.bottom = 'auto';
    sponsorElement.style.top = `${state.sponsor.yPercent}%`;
  }
}

// ── LOGO POSITION SLIDERS ──────────────────────────────────
function updateLogoPosition() {
  const x = parseInt(document.getElementById('logo-x-slider')?.value || 15);
  const y = parseInt(document.getElementById('logo-y-slider')?.value || 15);

  state.logoOverlay.x = x;
  state.logoOverlay.y = y;

  logoElement.style.left = `${x}px`;
  logoElement.style.top = `${y}px`;
}

// ── MARQUEE ────────────────────────────────────────────────
function toggleMarqueeOverlay(enabled) {
  state.marquee.enabled = enabled;
  if (marqueeElement) {
    marqueeElement.classList.toggle('active-visible', enabled);
    marqueeElement.style.display = enabled ? 'block' : 'none';
  }
  updateMarqueeAnimation();
  showToast(enabled ? '✓ បានបើកអក្សររត់ (Marquee)' : 'បានបិទអក្សររត់');
}

function updateMarqueeText(val) {
  state.marquee.text = val;
  if (marqueeTrack) marqueeTrack.innerText = val;
}

function setMarqueeDirection(dir) {
  state.marquee.direction = dir;
  // Update active button states
  ['up', 'down', 'left', 'right'].forEach(d => {
    const btn = document.getElementById(`marquee-dir-${d}`);
    if (btn) btn.classList.toggle('active', d === dir);
  });
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

function setMarqueeEffect(effect) {
  state.marquee.effect = effect;
  ['none', 'shadow', 'glow', 'outline'].forEach(e => {
    const btn = document.getElementById(`effect-btn-${e}`);
    if (btn) btn.classList.toggle('active', e === effect);
  });

  // Show glow color picker only for glow
  const glowRow = document.getElementById('glow-color-row');
  if (glowRow) glowRow.style.display = effect === 'glow' ? 'flex' : 'none';

  applyMarqueeStyles();
}

function applyMarqueeStyles() {
  if (!marqueeTrack) return;
  const font = document.getElementById('marquee-font-select')?.value || "'Kantumruy Pro', sans-serif";
  const color = document.getElementById('marquee-color-picker')?.value || '#f59e0b';
  const glowColor = document.getElementById('marquee-glow-color')?.value || '#c084fc';
  const fontSize = parseInt(document.getElementById('marquee-size-slider')?.value || 22);

  state.marquee.font = font;
  state.marquee.color = color;
  state.marquee.glowColor = glowColor;
  state.marquee.fontSize = fontSize;

  // Apply CSS to preview marquee
  marqueeTrack.style.fontFamily = font;
  marqueeTrack.style.color = color;
  marqueeTrack.style.fontSize = fontSize + 'px';
  marqueeTrack.style.textShadow = '';
  marqueeTrack.style.webkitTextStroke = '';

  switch (state.marquee.effect) {
    case 'shadow':
      marqueeTrack.style.textShadow = '2px 2px 6px rgba(0,0,0,0.9)';
      break;
    case 'glow':
      marqueeTrack.style.textShadow = `0 0 10px ${glowColor}, 0 0 25px ${glowColor}88`;
      break;
    case 'outline':
      marqueeTrack.style.webkitTextStroke = `2px rgba(0,0,0,0.9)`;
      break;
  }
}

function updateMarqueeAnimation() {
  if (!marqueeElement || !marqueeTrack) return;

  const dir = state.marquee.direction || 'up';
  const speedSec = parseFloat(state.marquee.speedSec) || 8.0;

  if (!state.marquee.enabled) {
    marqueeElement.classList.remove('active-visible');
    marqueeElement.style.display = 'none';
    marqueeTrack.style.animation = 'none';
    return;
  }

  marqueeElement.classList.add('active-visible');
  marqueeElement.style.display = 'block';

  // Toggle directional classes
  if (dir === 'left' || dir === 'right') {
    marqueeTrack.classList.add('dir-horizontal');
    marqueeTrack.classList.remove('dir-vertical');
  } else {
    marqueeTrack.classList.add('dir-vertical');
    marqueeTrack.classList.remove('dir-horizontal');
  }

  let animName = 'scrollUp';
  switch (dir) {
    case 'down':   animName = 'scrollDown';  break;
    case 'left':   animName = 'scrollLeft';  break;
    case 'right':  animName = 'scrollRight'; break;
    default:       animName = 'scrollUp';    break;
  }

  // Force reflow to immediately restart animation seamlessly
  marqueeTrack.style.animation = 'none';
  void marqueeTrack.offsetHeight;
  marqueeTrack.style.animation = `${animName} ${speedSec}s linear infinite`;

  applyMarqueeStyles();
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

    // Sync back to state & sliders
    if (element === blurBox) {
      state.blurMask.x = newLeft;
      state.blurMask.y = newTop;
      _syncSlider('blur-x-slider', newLeft);
      _syncSlider('blur-y-slider', newTop);
      document.getElementById('blur-x-val').innerText = Math.round(newLeft) + 'px';
      document.getElementById('blur-y-val').innerText = Math.round(newTop) + 'px';
    } else if (element === logoElement) {
      state.logoOverlay.x = newLeft;
      state.logoOverlay.y = newTop;
      _syncSlider('logo-x-slider', newLeft);
      _syncSlider('logo-y-slider', newTop);
      document.getElementById('logo-x-val').innerText = Math.round(newLeft) + 'px';
      document.getElementById('logo-y-val').innerText = Math.round(newTop) + 'px';
    }
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

function _syncSlider(sliderId, value) {
  const slider = document.getElementById(sliderId);
  if (slider) slider.value = Math.round(value);
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
    const newW = Math.max(50, Math.min(280, startW + dw));
    const newH = Math.max(20, Math.min(80, startH + dh));
    element.style.width = `${newW}px`;
    element.style.height = `${newH}px`;

    // Sync back to blur sliders
    if (element === blurBox) {
      state.blurMask.w = newW;
      state.blurMask.h = newH;
      _syncSlider('blur-w-slider', newW);
      _syncSlider('blur-h-slider', newH);
      document.getElementById('blur-w-val').innerText = Math.round(newW) + 'px';
      document.getElementById('blur-h-val').innerText = Math.round(newH) + 'px';
    }
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
// ⚡ 8. BUILD OPTIONS PAYLOAD (shared by auto-process & render)
// ══════════════════════════════════════════════════════════
function _buildRenderOptions() {
  return {
    flip_horizontal: state.flipHorizontal,
    crop_percent: state.cropPercent,
    brightness: state.brightness,
    contrast: state.contrast,
    blur_mask: {
      enabled: state.blurMask.enabled,
      x: blurBox.offsetLeft,
      y: blurBox.offsetTop,
      w: blurBox.offsetWidth,
      h: blurBox.offsetHeight,
      intensity: state.blurMask.intensity || 25,
      tint_opacity: state.blurMask.tintOpacity !== undefined ? state.blurMask.tintOpacity : 0.40
    },
    marquee: {
      enabled: state.marquee.enabled,
      text: state.marquee.text,
      direction: state.marquee.direction || 'up',
      speed_sec: state.marquee.speedSec || 8,
      speed: Math.round(300 / (state.marquee.speedSec || 8)),
      color: _hexToFFmpegColor(state.marquee.color),
      font_size: state.marquee.fontSize || 24,
      font: 'kantumruy'
    },
    // Dual-tone text
    text_overlay: {
      enabled: state.textOverlay.enabled,
      text: state.textPart1.text + ' ' + state.textPart2.text,
      x: textElement.offsetLeft,
      y: textElement.offsetTop,
      size: state.textOverlay.size,
      transparent_mode: state.textOverlay.transparentMode || false,
      motion: state.textOverlay.motion || 'none',
      speed_sec: state.textOverlay.speedSec || 8.0
    },
    text_part1: {
      enabled: state.textOverlay.enabled && state.textPart1.text.length > 0,
      text: state.textPart1.text,
      color: _hexToFFmpegColor(state.textPart1.color),
      effect: state.textOverlay.transparentMode ? 'none' : state.textPart1.effect,
      outline_color: _hexToFFmpegColor(state.textPart1.outlineColor),
      outline_w: state.textPart1.outlineW,
      x: textElement.offsetLeft,
      y: textElement.offsetTop,
      size: state.textOverlay.size,
      motion: state.textOverlay.motion || 'none',
      speed_sec: state.textOverlay.speedSec || 8.0
    },
    text_part2: {
      enabled: state.textOverlay.enabled && state.textPart2.text.length > 0,
      text: state.textPart2.text,
      color: _hexToFFmpegColor(state.textPart2.color),
      effect: state.textOverlay.transparentMode ? 'none' : state.textPart2.effect,
      outline_color: _hexToFFmpegColor(state.textPart2.outlineColor),
      outline_w: state.textPart2.outlineW,
      x: textElement.offsetLeft,
      y: textElement.offsetTop,
      size: state.textOverlay.size,
      motion: state.textOverlay.motion || 'none',
      speed_sec: state.textOverlay.speedSec || 8.0
    },
    // Custom sponsor branding (2 concise lines + position + duration)
    sponsor: {
      enabled: state.sponsor.enabled,
      top_line: state.sponsor.topLine,
      bottom_line: state.sponsor.bottomLine,
      position: state.sponsor.position,
      y_percent: state.sponsor.yPercent,
      color: _hexToFFmpegColor(state.sponsor.color),
      font_size: state.sponsor.fontSize,
      bg_color: state.sponsor.bgColor,
      duration: state.sponsor.duration || 15,
      font: 'kantumruy'
    }
  };
}

function _hexToFFmpegColor(hex) {
  // Converts #rrggbb to 0xRRGGBB for FFmpeg drawtext color
  if (!hex || !hex.startsWith('#')) return hex || 'white';
  return '0x' + hex.slice(1).toUpperCase();
}

// ══════════════════════════════════════════════════════════
// ⚡ 9. 1-CLICK AUTO PIPELINE & ULTRA-FAST CHUNKED EXPORT
// ══════════════════════════════════════════════════════════
async function triggerAutoProcessPipeline() {
  if (!state.videoFile && !state.videoFilename) {
    showToast('⚠️ សូមរើសវីដេអូចិនជាមុនសិន (Pick Video)');
    const vInp = document.getElementById('videoInput') || document.getElementById('video-file-input');
    if (vInp) vInp.click();
    return;
  }

  const progressWrap = document.getElementById('render-progress-wrap');
  const progressBar = document.getElementById('render-progress-bar');
  const progressStatus = document.getElementById('render-progress-status');
  const progressPct = document.getElementById('render-progress-pct');
  const successRow = document.getElementById('success-action-row');
  const downloadBtn = document.getElementById('btn-download-result');
  const savePathInfo = document.getElementById('export-save-path-info');

  if (progressWrap) progressWrap.style.display = 'flex';
  if (successRow) successRow.style.display = 'none';
  if (savePathInfo) savePathInfo.style.display = 'none';
  if (progressBar) progressBar.style.width = '10%';
  if (progressPct) progressPct.innerText = '10%';
  if (progressStatus) progressStatus.innerText = '1. កំពុង Upload វីដេអូទៅ Server...';
  _updateStepperStage(10, 'upload');

  if ((!state.videoUploaded || !state.videoFilename) && state.videoFile) {
    const formData = new FormData();
    formData.append('file', state.videoFile);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'ok') {
        state.videoFilename = data.filename;
        state.videoUploaded = true;
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (e) {
      showToast('⚠️ បរាជ័យក្នុងការ Upload វីដេអូទៅ Server: ' + e.message);
      if (progressWrap) progressWrap.style.display = 'none';
      return;
    }
  }

  if (progressBar) progressBar.style.width = '20%';
  if (progressPct) progressPct.innerText = '20%';
  if (progressStatus) progressStatus.innerText = '2. AI Faster-Whisper កំពុងដំណើរការស្ដាប់សំឡេងដើម...';
  _updateStepperStage(20, 'transcript');

  try {
    const res = await fetch('/api/auto-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_name: state.videoFilename,
        srt_content: state.srtContent || '',
        voice: state.voice,
        speed: state.voiceSpeed,
        options: _buildRenderOptions()
      })
    });
    const data = await res.json();
    if (data.status === 'started') {
      pollJobStatus(data.job_id);
    } else {
      showToast(data.error ? ('⚠️ ' + data.error) : '⚠️ បរាជ័យក្នុងការចាប់ផ្ដើម Auto Pipeline');
      if (progressWrap) progressWrap.style.display = 'none';
    }
  } catch (err) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបានទេ');
    if (progressWrap) progressWrap.style.display = 'none';
  }
}

function playExportedVideo() {
  if (!state.lastExportUrl) {
    showToast('⚠️ មិនទាន់មានវីដេអូបកប្រែរួចនៅឡើយ');
    return;
  }
  const video = document.getElementById('previewVideo') || document.getElementById('preview-video') || previewVideo;
  const placeholder = document.getElementById('video-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  if (video) {
    video.style.display = 'block';
    video.src = state.lastExportUrl;
    video.controls = true;
    video.muted = false;
    video.load();
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
    showToast('✓ កំពុងចាក់វីដេអូដែលបកប្រែរួច (Dubbed Video Playing)!');
  }
}

function handleSaveAllVideos() {
  if (state.lastExportUrl) {
    const a = document.createElement('a');
    a.href = state.lastExportUrl;
    a.download = state.lastExportFilename || 'NeakZong_Dubbed.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`✓ រក្សាទុកវីដេអូទៅកាន់ Folder /exports (${state.lastExportFilename || 'NeakZong_Dubbed.mp4'})`);
  } else {
    showToast('💡 វីដេអូដែលបកប្រែរួចទាំងអស់ ត្រូវបានរក្សាទុកក្នុង Folder: /exports');
  }
}

function _updateStepperStage(pct, stage) {
  const stages = [
    { id: 'step-separate', threshold: 12 },
    { id: 'step-transcript', threshold: 25 },
    { id: 'step-gender', threshold: 40 },
    { id: 'step-translate', threshold: 55 },
    { id: 'step-speech', threshold: 70 },
    { id: 'step-export', threshold: 85 }
  ];

  stages.forEach(st => {
    const el = document.getElementById(st.id);
    if (!el) return;
    if (pct >= 100 || (stage && stage === 'completed')) {
      el.style.background = 'rgba(16, 185, 129, 0.35)';
      el.style.color = '#34d399';
      el.style.borderColor = '#10b981';
      el.style.fontWeight = 'bold';
    } else if (pct >= st.threshold) {
      el.style.background = 'rgba(0, 242, 254, 0.25)';
      el.style.color = '#38bdf8';
      el.style.borderColor = '#00f2fe';
      el.style.fontWeight = 'bold';
    } else {
      el.style.background = 'rgba(255, 255, 255, 0.06)';
      el.style.color = '#94a3b8';
      el.style.borderColor = 'transparent';
      el.style.fontWeight = 'normal';
    }
  });
}

function pollJobStatus(jobId) {
  const progressBar = document.getElementById('render-progress-bar');
  const progressStatus = document.getElementById('render-progress-status');
  const progressPct = document.getElementById('render-progress-pct');
  const successRow = document.getElementById('success-action-row');
  const downloadBtn = document.getElementById('btn-download-result');
  const savePathInfo = document.getElementById('export-save-path-info');

  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/job/${jobId}`);
      const job = await res.json();

      const pct = job.progress || 30;
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressPct) progressPct.innerText = `${pct}%`;
      if (job.step && progressStatus) progressStatus.innerText = job.step;

      _updateStepperStage(pct, job.stage);

      if (job.status === 'completed') {
        clearInterval(interval);
        if (progressBar) progressBar.style.width = '100%';
        if (progressPct) progressPct.innerText = '100%';
        if (progressStatus) progressStatus.innerText = '✓ ជោគជ័យ ១០០%! វីដេអូរួចរាល់សម្រាប់ការចាក់ ឬ Save All';

        state.lastExportUrl = job.download_url;
        state.lastExportFilename = job.filename || 'NeakZong_Dubbed.mp4';

        if (successRow) successRow.style.display = 'flex';
        if (downloadBtn) {
          downloadBtn.href = job.download_url;
          downloadBtn.setAttribute('download', state.lastExportFilename);
        }
        if (savePathInfo) {
          savePathInfo.style.display = 'block';
          savePathInfo.innerHTML = `📁 <b>ទីតាំងរក្សាទុក:</b> ${job.save_path || ('/exports/' + state.lastExportFilename)}`;
        }

        showToast('🎉 បកប្រែ និង Dubbing សំឡេងខ្មែរចប់សព្វគ្រប់ ១០០%!');
      } else if (job.status === 'failed') {
        clearInterval(interval);
        if (progressStatus) {
          progressStatus.innerText = `⚠️ បរាជ័យ: ${job.error || 'Unknown'}`;
          progressStatus.style.color = '#f87171';
        }
      }
    } catch (e) {
      clearInterval(interval);
    }
  }, 1200);
}

// ══════════════════════════════════════════════════════════
// ⚡ 10. INITIALIZATION
// ══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  // Check License on startup
  checkLicenseStatus();

  // Initialize draggable elements (drag also syncs back to sliders)
  makeDraggable(blurBox);
  makeResizable(blurBox);
  makeDraggable(logoElement);
  makeDraggable(textElement);

  // Initialize dual-tone preview
  updateDualTonePreview();

  // Initialize sponsor preview
  updateSponsorContent();

  // Initialize and clamp blur box limits & default horizontal shape
  if (blurBox) {
    blurBox.style.width = '140px';
    blurBox.style.height = '45px';
    blurBox.style.left = '15px';
    blurBox.style.top = '15px';
  }
  const initWSlider = document.getElementById('blur-w-slider');
  const initHSlider = document.getElementById('blur-h-slider');
  if (initWSlider) initWSlider.value = 140;
  if (initHSlider) initHSlider.value = 45;
  const initWVal = document.getElementById('blur-w-val');
  const initHVal = document.getElementById('blur-h-val');
  if (initWVal) initWVal.innerText = '140px';
  if (initHVal) initHVal.innerText = '45px';

  updateBlurBoxLimits();
  window.addEventListener('resize', () => {
    updateBlurBoxLimits();
  });

  // Set default marquee animation
  try { updateMarqueeAnimation(); } catch(e) {}

  // Video Time Update listener
  const vEl = document.getElementById('previewVideo') || document.getElementById('preview-video') || previewVideo;
  if (vEl) {
    vEl.addEventListener('timeupdate', updateVideoTime);
    window.previewVideo = vEl;
  }

  // Effect button watcher: Part1 effect change
  document.getElementById('text-part1-effect')?.addEventListener('change', () => {
    updateDualTonePreview();
  });

  // Video Input Listener
  const vInput = document.getElementById('videoInput');
  if (vInput) {
    vInput.addEventListener('change', function() {
      handleVideoUpload(this);
    });
  }
});

// ⚡ Export all functions to window for 100% reliable HTML onclick/onchange triggers
window.switchStudioTab = switchStudioTab;
window.handleVideoUpload = handleVideoUpload;
window.handleSrtUpload = handleSrtUpload;
window.setQuickTextColor = setQuickTextColor;
window.setTextPartColor = setTextPartColor;
window.updateDualTonePreview = updateDualTonePreview;
window.updateTextPosition = updateTextPosition;
window.setTextMotion = setTextMotion;
window.setTextSpeedSeconds = setTextSpeedSeconds;
window.applyTextMotionStyles = applyTextMotionStyles;
window.toggleTextOverlay = toggleTextOverlay;
window.toggleTextTransparentMode = toggleTextTransparentMode;
window.toggleBlurOverlay = toggleBlurOverlay;
window.setBlurPreset = setBlurPreset;
window.updateBlurIntensity = updateBlurIntensity;
window.updateBlurTint = updateBlurTint;
window.setBlurCorner = setBlurCorner;
window.toggleLogoOverlay = toggleLogoOverlay;
window.toggleMarqueeOverlay = toggleMarqueeOverlay;
window.setMarqueeDirection = setMarqueeDirection;
window.setMarqueeSpeed = setMarqueeSpeed;
window.setMarqueeSpeedSeconds = setMarqueeSpeedSeconds;
window.setMarqueeEffect = setMarqueeEffect;
window.applyMarqueeStyles = applyMarqueeStyles;
window.toggleSponsorOverlay = toggleSponsorOverlay;
window.setSponsorDuration = setSponsorDuration;
window.setSponsorPosition = setSponsorPosition;
window.updateSponsorContent = updateSponsorContent;
window.triggerAutoProcessPipeline = triggerAutoProcessPipeline;
window.playExportedVideo = playExportedVideo;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.verifyAdminPassword = verifyAdminPassword;
window.selectLicType = selectLicType;
window.submitAdminGenerateKey = submitAdminGenerateKey;
window.copyCreatedKey = copyCreatedKey;
window.loadAdminLicenseList = loadAdminLicenseList;
window.revokeAdminKey = revokeAdminKey;
