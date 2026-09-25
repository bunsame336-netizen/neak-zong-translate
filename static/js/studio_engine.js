/**
 * «នាគហ្សង បកប្រែ» (Neak Zong Translate AI)
 * Mobile Studio Engine v2.1.0 — Dual-Tone Text, Blur/Logo Sliders, Marquee 4-Dir, Khmer Effects
 */

// ── Global State ──────────────────────────────────────────
const state = {
  videoFile: null,
  videoFilename: null,
  videoUrl: null,
  srtContent: null,
  translatedSrt: null,
  activeTab: 'blur',
  licenseValid: false,
  licenseInfo: null,
  adminAuthenticated: false,
  selectedLicType: 'days',
  
  // Anti-Copyright Settings
  flipHorizontal: false,
  cropPercent: 0,
  brightness: 0,
  contrast: 1.0,
  
  // Blur Mask (Horizontal Rectangle for Watermark/Logo)
  blurMask: {
    enabled: false,
    x: 10,
    y: 10,
    w: 75,
    h: 28,
    intensity: 25,
    tintOpacity: 0.40
  },

  // Logo Overlay (controlled by drag + sliders)
  logoOverlay: {
    enabled: false,
    x: 10,
    y: 15,
    scale: 0.25,
    opacity: 0.9,
    path: null
  },

  // Dual-Tone Text Overlay
  textOverlay: {
    enabled: false,
    font: "'Moul', serif",
    size: 16,
    x: 10,
    y: 15,
    transparentMode: false
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
    text: 'រក្សាសិទ្ធិដោយ នាគហ្សង បកប្រែ',
    direction: 'left',
    speedSec: 8,
    color: '#f59e0b',
    fontSize: 16,
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
const previewVideo = document.getElementById('preview-video');
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

// Tab Navigation Switching with 1-Tap Instant Activation (Auto-toggle ON)
function switchStudioTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-nav-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabId;
    btn.classList.toggle('active', isTarget);
  });
  document.querySelectorAll('.tab-panel-card').forEach(panel => {
    panel.classList.remove('active');
  });
  const targetPanel = document.getElementById(`tab-panel-${tabId}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // ⚡ 1-TAP INSTANT ACTIVATION ON BUTTON CLICK:
  if (tabId === 'text') {
    // 1. Text Overlay Auto-ON
    state.textOverlay.enabled = true;
    const toggleText = document.getElementById('toggle-text');
    if (toggleText) toggleText.checked = true;
    if (textElement) {
      textElement.classList.add('active-visible');
      textElement.style.display = 'block';
    }

    // 2. Auto-Marquee Running immediately! (Default: bottom-to-top / 'up')
    state.marquee.enabled = true;
    if (!state.marquee.direction || state.marquee.direction === 'left') {
      state.marquee.direction = 'up';
    }
    const toggleMarquee = document.getElementById('toggle-marquee');
    if (toggleMarquee) toggleMarquee.checked = true;
    ['up', 'down', 'left', 'right'].forEach(d => {
      const btn = document.getElementById(`btn-marquee-dir-${d}`);
      if (btn) btn.classList.toggle('active', d === state.marquee.direction);
    });

    updateDualTonePreview();
    updateMarqueeAnimation();
    showToast('📝 ដាក់អក្សរ & ចាប់ផ្ដើមរត់ Marquee ស្វ័យប្រវត្តិតែម្ដង!');
  } else if (tabId === 'blur') {
    // Blur Mask Auto-ON
    state.blurMask.enabled = true;
    const toggleBlur = document.getElementById('toggle-blur');
    if (toggleBlur) toggleBlur.checked = true;
    if (blurBox) {
      blurBox.classList.add('active-visible');
      blurBox.style.display = 'block';
    }
    updateBlurBoxLimits();
    updateBlurBoxFromSliders();
    showToast('🌫️ ផ្ទាំងព្រិល Blur បានបើកបង្ហាញភ្លាមៗ!');
  } else if (tabId === 'sponsor') {
    // Sponsor Badge Auto-ON
    state.sponsor.enabled = true;
    const toggleSponsor = document.getElementById('toggle-sponsor');
    if (toggleSponsor) toggleSponsor.checked = true;
    toggleSponsorOverlay(true);
    showToast('🤝 Sponsor Badge បានបើកបង្ហាញភ្លាមៗ!');
  } else if (tabId === 'logo') {
    // Logo Overlay Auto-ON
    state.logoOverlay.enabled = true;
    const toggleLogo = document.getElementById('toggle-logo');
    if (toggleLogo) toggleLogo.checked = true;
    if (logoElement) {
      logoElement.classList.add('active-visible');
      logoElement.style.display = 'block';
    }
    showToast('🖼️ Logo Overlay បានបើកបង្ហាញភ្លាមៗ!');
  }

  const bottomPanel = document.getElementById('studio-dynamic-controls-area');
  if (bottomPanel) {
    bottomPanel.scrollTop = 0;
  }
}

// Quick Voice Model Selection (Sreymom / Piseth)
function selectQuickVoice(voiceId) {
  state.voice = voiceId;
  const selectElem = document.getElementById('voice-select');
  if (selectElem) selectElem.value = voiceId;
  const btnFemale = document.getElementById('btn-voice-female');
  const btnMale = document.getElementById('btn-voice-male');
  if (btnFemale && btnMale) {
    btnFemale.classList.toggle('active', voiceId === 'female');
    btnMale.classList.toggle('active', voiceId === 'male');
  }
  showToast(voiceId === 'female' ? '🎙️ ជ្រើសរើសសំឡេង៖ កញ្ញា ស្រីមុំ' : '🎙️ ជ្រើសរើសសំឡេង៖ លោក ពិសិដ្ឋ');
}

// Top download button removed per user request for a cleaner 2-column menu grid

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
// ⚡ 2. MEDIA UPLOAD & HANDLING
// ══════════════════════════════════════════════════════════
function handleVideoUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  state.videoFile = file;
  state.hasVideoDecodeError = false;
  state.thumbnailUrl = null;

  const placeholder = document.getElementById('video-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  // 1. Instant local ObjectURL creation and mount to HTML5 <video> in under 1 second!
  if (state.localVideoUrl) {
    try { URL.revokeObjectURL(state.localVideoUrl); } catch (e) {}
  }
  const videoUrl = URL.createObjectURL(file);
  state.localVideoUrl = videoUrl;

  const videoElement = previewVideo;
  videoElement.style.display = 'block';
  // IMPORTANT: Blob URLs must NOT have crossOrigin set to avoid browser CORS/decoding errors
  videoElement.removeAttribute('crossorigin');
  videoElement.removeAttribute('poster');
  videoElement.src = videoUrl;
  videoElement.playsInline = true;
  videoElement.controls = true;
  videoElement.setAttribute('playsinline', '');
  videoElement.setAttribute('webkit-playsinline', '');
  videoElement.setAttribute('controls', 'true');
  videoElement.setAttribute('preload', 'auto');

  // Handle format unsupported or decode error (common with H.265/HEVC on mobile webview)
  videoElement.onerror = (e) => {
    console.warn('HTML5 <video> error:', videoElement.error);
    state.hasVideoDecodeError = true;
    showToast('⚠️ កំពុងទាញយក Frame Preview ពី Server...');
    if (state.thumbnailUrl) {
      applyThumbnailFallback(state.thumbnailUrl);
    }
  };

  videoElement.onloadedmetadata = () => {
    // Auto-adapt viewport to video aspect ratio (e.g. 16:9 landscape vs 9:16 vertical)
    const isLandscape = (videoElement.videoWidth || 9) > (videoElement.videoHeight || 16);
    const vp = document.getElementById('video-viewport');
    if (vp) {
      vp.style.aspectRatio = isLandscape ? '16 / 9' : '9 / 16';
    }
    updateBlurBoxLimits();
    if (state.blurMask.enabled) {
      updateBlurBoxFromSliders();
    }
    updateVideoTime();

    // Start native smooth playback immediately (muted for autoplay policy compliance)
    videoElement.muted = true;
    const playP = videoElement.play();
    if (playP !== undefined) {
      playP.then(() => {
        const btn = document.getElementById('btn-play-toggle');
        if (btn) btn.innerText = '⏸ ផ្អាក';
      }).catch(err => {
        console.log('Autoplay muted note:', err);
      });
    }
  };

  // Direct tap on video toggles playback
  videoElement.onclick = (e) => {
    e.stopPropagation();
    toggleVideoPlayback();
  };

  videoElement.ontimeupdate = updateVideoTime;

  videoElement.onplay = () => {
    const btn = document.getElementById('btn-play-toggle');
    if (btn) btn.innerText = '⏸ ផ្អាក';
  };

  videoElement.onplaying = () => {
    const btn = document.getElementById('btn-play-toggle');
    if (btn) btn.innerText = '⏸ ផ្អាក';
  };

  videoElement.onpause = () => {
    const btn = document.getElementById('btn-play-toggle');
    if (btn) btn.innerText = '▶️ ចាក់';
  };

  videoElement.onended = () => {
    const btn = document.getElementById('btn-play-toggle');
    if (btn) btn.innerText = '▶️ ចាក់';
    updateVideoTime();
  };

  // Trigger immediate video load
  videoElement.load();
  showToast('✓ វីដេអូបានបើកក្នុង Player Preview ត្រូវទម្រង់ ១០០%!');

  // 2. Upload to Cloud Server asynchronously in background with real-time progress
  uploadVideoToCloud(file);
}

function uploadVideoToCloud(file) {
  const formData = new FormData();
  formData.append('file', file);

  const statusText = document.getElementById('render-progress-status');
  const progressBar = document.getElementById('render-progress-bar');
  const percentText = document.getElementById('render-progress-percent');

  if (statusText) statusText.innerText = '⚡ កំពុង Upload វីដេអូទៅកាន់ Cloud... (0%)';
  if (progressBar) progressBar.style.width = '0%';
  if (percentText) percentText.innerText = '0%';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload', true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (percentText) percentText.innerText = `${pct}%`;
      if (statusText) statusText.innerText = `⚡ កំពុង Upload វីដេអូទៅកាន់ Cloud... (${pct}%)`;
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.status === 'ok') {
          state.videoFilename = data.filename;
          if (data.thumbnail_url) {
            state.thumbnailUrl = data.thumbnail_url;
            if (state.hasVideoDecodeError) {
              applyThumbnailFallback(data.thumbnail_url);
            }
          }
          if (progressBar) progressBar.style.width = '100%';
          if (percentText) percentText.innerText = '100%';
          if (statusText) statusText.innerText = '✓ វីដេអូភ្ជាប់ទៅកាន់ Cloud Server (Ready for AI)';
          showToast('✓ វីដេអូបានភ្ជាប់ទៅកាន់ Cloud Server (Ready for AI)');
        }
      } catch (err) {
        console.warn('Upload parse error:', err);
      }
    } else {
      if (statusText) statusText.innerText = '⚠️ Upload មិនបានសម្រេច សូមព្យាយាមម្ដងទៀត';
    }
  };

  xhr.onerror = () => {
    console.warn('Upload network error');
    if (statusText) statusText.innerText = '⚠️ បញ្ហាបណ្ដាញ Cloud Upload';
  };

  xhr.send(formData);
}

function applyThumbnailFallback(thumbUrl) {
  if (!thumbUrl) return;
  if (previewVideo && state.hasVideoDecodeError) {
    previewVideo.poster = thumbUrl;
  }
  // Adapt viewport aspect ratio to server thumbnail image
  const img = new Image();
  img.onload = () => {
    const isLandscape = img.naturalWidth > img.naturalHeight;
    const vp = document.getElementById('video-viewport');
    if (vp) {
      vp.style.aspectRatio = isLandscape ? '16 / 9' : '9 / 16';
    }
    updateBlurBoxLimits();
    if (state.blurMask.enabled) {
      updateBlurBoxFromSliders();
    }
  };
  img.src = thumbUrl;
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
  if (!previewVideo) return;
  const cur = Math.floor(previewVideo.currentTime || 0);
  const dur = Math.floor(previewVideo.duration || 0);
  const format = (s) => `${Math.floor(s/60).toString().padStart(2, '0')}:${(s%60).toString().padStart(2, '0')}`;
  const el = document.getElementById('video-time-display');
  if (el) el.innerText = `${format(cur)} / ${format(dur)}`;
}

// ── ROBUST VIDEO PLAYBACK HANDLERS FOR MOBILE WEBVIEW ─────────────
function toggleVideoPlayback() {
  if (!previewVideo) return;
  const btn = document.getElementById('btn-play-toggle');

  if (previewVideo.paused || previewVideo.ended) {
    previewVideo.muted = false;
    const playPromise = previewVideo.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        if (btn) btn.innerText = '⏸ ផ្អាក';
      }).catch(err => {
        console.warn('Playback unmuted error, retrying muted:', err);
        previewVideo.muted = true;
        previewVideo.play().then(() => {
          if (btn) btn.innerText = '⏸ ផ្អាក';
        }).catch(err2 => {
          console.warn('Playback on blob failed, checking server fallback:', err2);
          if (state.videoFilename) {
            showToast('⚡ កំពុងបើកចាក់វីដេអូពី Server...');
            previewVideo.removeAttribute('crossorigin');
            previewVideo.src = `/uploads/${state.videoFilename}`;
            previewVideo.load();
            previewVideo.play().then(() => {
              if (btn) btn.innerText = '⏸ ផ្អាក';
            }).catch(e => {
              console.warn('Server URL playback error:', e);
              showToast('⚠️ Webview មិនគាំទ្រចាក់ទម្រង់ Codec វីដេអូនេះ');
            });
          }
        });
      });
    }
  } else {
    previewVideo.pause();
    if (btn) btn.innerText = '▶️ ចាក់';
  }
}

function resetVideoPlayback() {
  if (!previewVideo) return;
  previewVideo.currentTime = 0;
  previewVideo.pause();
  const btn = document.getElementById('btn-play-toggle');
  if (btn) btn.innerText = '▶️ ចាក់';
  updateVideoTime();
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

  // Read fonts
  state.textPart1.font = document.getElementById('text-part1-font')?.value || "'Moul', serif";
  state.textPart2.font = document.getElementById('text-part2-font')?.value || "'Kantumruy Pro', sans-serif";
  state.textOverlay.font = state.textPart1.font;

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
    p1Span.style.fontFamily = state.textPart1.font;
    p1Span.style.fontSize = (state.textOverlay.size || 16) + 'px';
    _applyEffectToSpan(p1Span, state.textPart1.effect, state.textPart1.color, state.textPart1.outlineColor);
  }
  if (p2Span) {
    p2Span.innerText = ' ' + state.textPart2.text;
    p2Span.style.color = state.textPart2.color;
    p2Span.style.fontFamily = state.textPart2.font;
    p2Span.style.fontSize = (state.textOverlay.size || 16) + 'px';
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


// ── VIDEO VIEWPORT GEOMETRY & BOUNDING CLAMPS ───────────────────────
function getVideoRenderRect() {
  const vp = document.getElementById('video-viewport');
  const fallback = { left: 0, top: 0, width: 280, height: 320 };
  if (!vp) return fallback;

  const vpW = vp.clientWidth || 280;
  const vpH = vp.clientHeight || 320;
  const vid = previewVideo;

  // 1. If HTML5 Video is loaded with valid dimensions
  if (vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
    const vidRatio = vid.videoWidth / vid.videoHeight;
    const vpRatio = vpW / vpH;
    let renderW = vpW;
    let renderH = vpH;
    let offsetX = 0;
    let offsetY = 0;

    if (vidRatio > vpRatio) {
      // Letterboxed top and bottom
      renderW = vpW;
      renderH = vpW / vidRatio;
      offsetY = (vpH - renderH) / 2;
    } else {
      // Pillarboxed left and right
      renderH = vpH;
      renderW = vpH * vidRatio;
      offsetX = (vpW - renderW) / 2;
    }
    return {
      left: Math.max(0, Math.round(offsetX)),
      top: Math.max(0, Math.round(offsetY)),
      width: Math.max(30, Math.round(renderW)),
      height: Math.max(20, Math.round(renderH))
    };
  }

  // 2. If fallback poster image is active
  const poster = document.getElementById('video-fallback-poster');
  if (poster && poster.naturalWidth > 0 && poster.naturalHeight > 0) {
    const pRatio = poster.naturalWidth / poster.naturalHeight;
    const vpRatio = vpW / vpH;
    let renderW = vpW;
    let renderH = vpH;
    let offsetX = 0;
    let offsetY = 0;

    if (pRatio > vpRatio) {
      renderW = vpW;
      renderH = vpW / pRatio;
      offsetY = (vpH - renderH) / 2;
    } else {
      renderH = vpH;
      renderW = vpH * pRatio;
      offsetX = (vpW - renderW) / 2;
    }
    return {
      left: Math.max(0, Math.round(offsetX)),
      top: Math.max(0, Math.round(offsetY)),
      width: Math.max(30, Math.round(renderW)),
      height: Math.max(20, Math.round(renderH))
    };
  }

  return { left: 0, top: 0, width: vpW, height: vpH };
}

function clampBoxWithinVideo(x, y, w, h) {
  const rect = getVideoRenderRect();
  const minW = 20;
  const minH = 10;
  const maxW = Math.max(minW, rect.width - 2);
  const maxH = Math.max(minH, rect.height - 2);

  // Clamp dimensions
  w = Math.max(minW, Math.min(maxW, Math.round(w)));
  h = Math.max(minH, Math.min(maxH, Math.round(h)));

  // Clamp coordinates strictly within the visible video rect
  const minX = rect.left;
  const maxX = Math.max(minX, rect.left + rect.width - w);
  const minY = rect.top;
  const maxY = Math.max(minY, rect.top + rect.height - h);

  x = Math.max(minX, Math.min(maxX, Math.round(x)));
  y = Math.max(minY, Math.min(maxY, Math.round(y)));

  return { x, y, w, h };
}

// ── SMOOTH THROTTLED SLIDER SYNCHRONIZATION (JANK-FREE 60FPS) ──────
let blurSyncRaf = null;
let lastBlurSyncTime = 0;

function throttledSyncBlurSliders(x, y, w, h, force = false) {
  state.blurMask.x = Math.round(x);
  state.blurMask.y = Math.round(y);
  if (w !== undefined) state.blurMask.w = Math.round(w);
  if (h !== undefined) state.blurMask.h = Math.round(h);

  const now = performance.now();
  if (force || (now - lastBlurSyncTime > 35)) {
    lastBlurSyncTime = now;
    if (blurSyncRaf) cancelAnimationFrame(blurSyncRaf);
    blurSyncRaf = requestAnimationFrame(() => {
      _syncSlider('blur-x-slider', state.blurMask.x);
      _syncSlider('blur-y-slider', state.blurMask.y);
      if (w !== undefined) _syncSlider('blur-w-slider', state.blurMask.w);
      if (h !== undefined) _syncSlider('blur-h-slider', state.blurMask.h);

      const xVal = document.getElementById('blur-x-val');
      const yVal = document.getElementById('blur-y-val');
      const wVal = document.getElementById('blur-w-val');
      const hVal = document.getElementById('blur-h-val');
      if (xVal) xVal.innerText = `${state.blurMask.x}px`;
      if (yVal) yVal.innerText = `${state.blurMask.y}px`;
      if (wVal && w !== undefined) wVal.innerText = `${state.blurMask.w}px`;
      if (hVal && h !== undefined) hVal.innerText = `${state.blurMask.h}px`;
    });
  }
}

// ── BLUR BOX SLIDERS (CLAMPS STRICTLY WITHIN VIDEO BOUNDARIES) ─────
function updateBlurBoxLimits() {
  const rect = getVideoRenderRect();
  const wSlider = document.getElementById('blur-w-slider');
  const hSlider = document.getElementById('blur-h-slider');
  const xSlider = document.getElementById('blur-x-slider');
  const ySlider = document.getElementById('blur-y-slider');
  const curW = state.blurMask.w || 75;
  const curH = state.blurMask.h || 28;

  if (wSlider) {
    wSlider.min = 20;
    wSlider.max = Math.max(40, rect.width - 4);
  }
  if (hSlider) {
    hSlider.min = 10;
    hSlider.max = Math.max(20, rect.height - 4);
  }
  if (xSlider) {
    xSlider.min = rect.left;
    xSlider.max = Math.max(rect.left, rect.left + rect.width - curW);
  }
  if (ySlider) {
    ySlider.min = rect.top;
    ySlider.max = Math.max(rect.top, rect.top + rect.height - curH);
  }
}

// ── DEBOUNCED / RAF BLUR SLIDER INPUT FOR SMOOTH 60FPS TOUCH ──────
let blurSliderInputRaf = null;
function handleBlurSliderInput() {
  if (blurSliderInputRaf) cancelAnimationFrame(blurSliderInputRaf);
  blurSliderInputRaf = requestAnimationFrame(() => {
    updateBlurBoxFromSliders();
  });
}

function initPassiveSliderTouch() {
  document.querySelectorAll('.cyber-slider').forEach(slider => {
    slider.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    slider.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
  });
}

function updateBlurBoxFromSliders() {
  let w = parseInt(document.getElementById('blur-w-slider')?.value || 75);
  let h = parseInt(document.getElementById('blur-h-slider')?.value || 28);
  let x = parseInt(document.getElementById('blur-x-slider')?.value || 10);
  let y = parseInt(document.getElementById('blur-y-slider')?.value || 10);

  const clamped = clampBoxWithinVideo(x, y, w, h);
  x = clamped.x;
  y = clamped.y;
  w = clamped.w;
  h = clamped.h;

  state.blurMask.x = x;
  state.blurMask.y = y;
  state.blurMask.w = w;
  state.blurMask.h = h;

  if (blurBox) {
    blurBox.style.left = `${x}px`;
    blurBox.style.top = `${y}px`;
    blurBox.style.width = `${w}px`;
    blurBox.style.height = `${h}px`;
    // Respect user's explicit enabled switch: strictly OFF by default
    blurBox.style.display = state.blurMask.enabled ? 'block' : 'none';
    blurBox.classList.toggle('active-visible', state.blurMask.enabled);
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

// 🎨 Real Blur Tint Modes: Pure Blur, Dark Black, or Transparent White Tint
function setBlurTintPreset(mode) {
  state.blurMask.tintMode = mode;
  ['btn-tint-pure', 'btn-tint-dark', 'btn-tint-white'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  const btn = document.getElementById(`btn-tint-${mode}`);
  if (btn) btn.classList.add('active');

  const tintSlider = document.getElementById('blur-tint-slider');
  let opacityPct = parseInt(tintSlider?.value || 40);

  if (mode === 'pure') {
    state.blurMask.tintColor = 'rgba(0, 0, 0, 0)';
    if (tintSlider) tintSlider.value = 0;
    opacityPct = 0;
  } else if (mode === 'dark') {
    if (opacityPct === 0) opacityPct = 40;
    if (tintSlider) tintSlider.value = opacityPct;
  } else if (mode === 'white') {
    if (opacityPct === 0) opacityPct = 30;
    if (tintSlider) tintSlider.value = opacityPct;
  }
  updateBlurTint(opacityPct);
  showToast(mode === 'pure' ? '🌫️ ផ្ទៃព្រាលសុទ្ធ' : (mode === 'white' ? '⬜ សថ្លា' : '⬛ ខ្មៅងងឹត'));
}

function updateBlurTint(val) {
  const pct = parseInt(val) || 0;
  state.blurMask.tintOpacity = pct / 100.0;
  const tintValEl = document.getElementById('blur-tint-val');
  if (tintValEl) tintValEl.innerText = `${pct}%`;

  const mode = state.blurMask.tintMode || 'dark';
  if (blurBox) {
    if (mode === 'pure' || pct === 0) {
      blurBox.style.backgroundColor = 'transparent';
    } else if (mode === 'white') {
      blurBox.style.backgroundColor = `rgba(255, 255, 255, ${state.blurMask.tintOpacity})`;
    } else {
      blurBox.style.backgroundColor = `rgba(0, 0, 0, ${state.blurMask.tintOpacity})`;
    }
  }
}

function setBlurCorner(corner) {
  const rect = getVideoRenderRect();
  const w = Math.min(state.blurMask.w || 75, rect.width - 10);
  const h = Math.min(state.blurMask.h || 28, rect.height - 10);
  let x = rect.left + 8;
  let y = rect.top + 8;

  if (corner === 'top-left') {
    x = rect.left + 8;
    y = rect.top + 8;
  } else if (corner === 'top-right') {
    x = rect.left + rect.width - w - 8;
    y = rect.top + 8;
  } else if (corner === 'bottom-left') {
    x = rect.left + 8;
    y = rect.top + rect.height - h - 8;
  } else if (corner === 'bottom-right') {
    x = rect.left + rect.width - w - 8;
    y = rect.top + rect.height - h - 8;
  }

  const clamped = clampBoxWithinVideo(x, y, w, h);
  const xSlider = document.getElementById('blur-x-slider');
  const ySlider = document.getElementById('blur-y-slider');
  if (xSlider) xSlider.value = clamped.x;
  if (ySlider) ySlider.value = clamped.y;
  updateBlurBoxFromSliders();
}


// ── SPONSOR CONTROLS (WIDTH, SCALE & DUAL-STYLE SUPPORT) ────
function toggleSponsorOverlay(enabled) {
  state.sponsor.enabled = enabled;
  const toggle = document.getElementById('toggle-sponsor');
  if (toggle && toggle.checked !== enabled) toggle.checked = enabled;
  if (sponsorElement) {
    sponsorElement.classList.toggle('active-visible', enabled);
    sponsorElement.style.display = enabled ? 'block' : 'none';
  }
  updateSponsorContent();
  showToast(enabled ? '✓ បានបើកបង្ហាញ Sponsor Banner' : 'បានបិទ Sponsor');
}

function updateSponsorContent() {
  const topText = (document.getElementById('sponsor-top-input')?.value || '📢 ទទួលផ្សាយពាណិជ្ជកម្ម / Sponsor').trim();
  const bottomText = (document.getElementById('sponsor-bottom-input')?.value || '📱 012 345 678 | Telegram').trim();

  // Colors & Fonts
  const topColor = document.getElementById('sponsor-top-color')?.value || '#f59e0b';
  const bottomColor = document.getElementById('sponsor-bottom-color')?.value || '#22d3ee';
  const topFont = document.getElementById('sponsor-top-font')?.value || "'Kantumruy Pro', sans-serif";
  const bottomFont = document.getElementById('sponsor-bottom-font')?.value || "'Kantumruy Pro', sans-serif";
  const topEffect = document.getElementById('sponsor-top-effect')?.value || 'glow';
  const bottomEffect = document.getElementById('sponsor-bottom-effect')?.value || 'none';

  // Size, Width, Scale & Position
  const widthPct = parseInt(document.getElementById('sponsor-width-slider')?.value || 88);
  const scalePct = parseInt(document.getElementById('sponsor-scale-slider')?.value || 100);
  const scale = scalePct / 100.0;
  const yPercent = parseInt(document.getElementById('sponsor-y-slider')?.value || 88);
  const bg = document.getElementById('sponsor-bg-select')?.value || 'rgba(8, 6, 18, 0.90)';

  state.sponsor.topLine = topText;
  state.sponsor.bottomLine = bottomText;
  state.sponsor.topColor = topColor;
  state.sponsor.bottomColor = bottomColor;
  state.sponsor.topFont = topFont;
  state.sponsor.bottomFont = bottomFont;
  state.sponsor.topEffect = topEffect;
  state.sponsor.bottomEffect = bottomEffect;
  state.sponsor.widthPercent = widthPct;
  state.sponsor.scale = scale;
  state.sponsor.yPercent = yPercent;
  state.sponsor.bgColor = bg;

  const widthVal = document.getElementById('sponsor-width-val');
  if (widthVal) widthVal.innerText = `${widthPct}%`;
  const scaleVal = document.getElementById('sponsor-scale-val');
  if (scaleVal) scaleVal.innerText = `${scale.toFixed(1)}x`;

  const topEl = document.getElementById('sponsor-top-tag') || document.getElementById('sponsor-brand-tag');
  const bottomEl = document.getElementById('sponsor-bottom-tag') || document.getElementById('sponsor-contact-tag');

  const baseSize = Math.max(10, Math.round(14 * scale));

  if (topEl) {
    topEl.innerText = topText;
    topEl.style.color = topColor;
    topEl.style.fontFamily = topFont;
    topEl.style.fontSize = baseSize + 'px';
    _applyEffectToSpan(topEl, topEffect, topColor, '#000');
  }
  if (bottomEl) {
    bottomEl.innerText = bottomText;
    bottomEl.style.color = bottomColor;
    bottomEl.style.fontFamily = bottomFont;
    bottomEl.style.fontSize = Math.max(9, Math.round(baseSize * 0.85)) + 'px';
    _applyEffectToSpan(bottomEl, bottomEffect, bottomColor, '#000');
  }

  const bannerBar = document.getElementById('sponsor-banner-bar');
  if (bannerBar) {
    bannerBar.style.backgroundColor = bg;
    bannerBar.style.padding = `${Math.round(4 * scale)}px ${Math.round(8 * scale)}px`;
  }
  if (sponsorElement) {
    sponsorElement.style.width = 'max-content';
    sponsorElement.style.maxWidth = `${Math.min(94, Math.max(50, widthPct))}%`;
    sponsorElement.style.left = '50%';
    sponsorElement.style.transform = 'translateX(-50%)';
    if (state.sponsor.position === 'top') {
      sponsorElement.style.top = '12px';
      sponsorElement.style.bottom = 'auto';
    } else {
      sponsorElement.style.bottom = '12px';
      sponsorElement.style.top = 'auto';
    }
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

// ── DIRECT DUAL-TONE HEADER MARQUEE ANIMATION ───────────────
function toggleMarqueeAnimation(enabled) {
  state.marquee.enabled = enabled;
  const toggle = document.getElementById('toggle-marquee');
  if (toggle && toggle.checked !== enabled) toggle.checked = enabled;

  updateMarqueeAnimation();
  showToast(enabled ? '🎬 បានបើកចលនាចំណងជើងរត់ (Header Marquee)' : 'បានបិទអក្សររត់');
}

// Natural Speed Slider: 1 = 20s (Very Slow), 5 = 8s (Normal), 10 = 3s (Very Fast)
function setMarqueeSpeedNatural(val) {
  const level = parseInt(val) || 5;
  // Map level 1..10 to duration in seconds: 10 -> 3s, 1 -> 20s
  const speedSec = Math.max(2, Math.round(20 - (level - 1) * 1.88));
  state.marquee.speedSec = speedSec;
  state.marquee.speedLevel = level;

  let label = `${level}x (មធ្យម)`;
  if (level <= 3) label = `${level}x (យឺត 🐢)`;
  else if (level >= 8) label = `${level}x (លឿន 🚀)`;
  const valEl = document.getElementById('marquee-speed-natural-val');
  if (valEl) valEl.innerText = label;

  updateMarqueeAnimation();
}

function setMarqueeDir(dir) {
  state.marquee.direction = dir;
  ['up', 'down', 'left', 'right'].forEach(d => {
    const btn = document.getElementById(`btn-marquee-dir-${d}`);
    if (btn) btn.classList.toggle('active', d === dir);
  });
  updateMarqueeAnimation();
  showToast(`✓ ទិសដៅរត់៖ ${dir.toUpperCase()}`);
}

function updateMarqueeAnimation() {
  if (!textElement) return;

  const dir = state.marquee.direction || 'left';
  const speedSec = parseFloat(state.marquee.speedSec) || 8.0;

  if (!state.marquee.enabled) {
    textElement.classList.remove('marquee-active', 'dir-up', 'dir-down', 'dir-left', 'dir-right');
    textElement.style.removeProperty('animation');
    textElement.style.removeProperty('--marquee-duration');
    textElement.style.left = `${state.textOverlay.x || 10}px`;
    textElement.style.top = `${state.textOverlay.y || 15}px`;
    textElement.style.transform = '';
    textElement.style.display = state.textOverlay.enabled ? 'block' : 'none';
    return;
  }

  // Ensure text overlay is enabled and visible
  state.textOverlay.enabled = true;
  const toggleText = document.getElementById('toggle-text');
  if (toggleText) toggleText.checked = true;

  // IMPORTANT: Remove inline left/top/transform so CSS @keyframes can take full control!
  textElement.style.removeProperty('left');
  textElement.style.removeProperty('top');
  textElement.style.removeProperty('transform');
  textElement.style.removeProperty('right');
  textElement.style.removeProperty('bottom');

  textElement.style.display = 'block';
  textElement.classList.add('active-visible', 'marquee-active');
  textElement.classList.remove('dir-up', 'dir-down', 'dir-left', 'dir-right');
  textElement.classList.add('dir-' + dir);

  // Set duration via CSS variable
  textElement.style.setProperty('--marquee-duration', `${speedSec}s`);

  let animName = 'marqueeScrollLeft';
  if (dir === 'up') animName = 'marqueeScrollUp';
  else if (dir === 'down') animName = 'marqueeScrollDown';
  else if (dir === 'right') animName = 'marqueeScrollRight';

  // Force reflow to immediately restart animation seamlessly
  textElement.style.animation = 'none';
  void textElement.offsetHeight;
  textElement.style.animation = `${animName} ${speedSec}s linear infinite`;
}

// Legacy Marquee Helpers for compatibility
function toggleMarqueeOverlay(enabled) {
  toggleMarqueeAnimation(enabled);
}

function updateMarqueeText(val) {
  // Directly maps to Dual-Tone Part 1
  if (document.getElementById('text-part1-input')) {
    document.getElementById('text-part1-input').value = val;
    updateDualTonePreview();
  }
}

function setMarqueeDirection(dir) {
  setMarqueeDir(dir);
}

function setMarqueeSpeed(preset) {
  let level = 5;
  if (preset === 'slow') level = 2;
  if (preset === 'normal') level = 5;
  if (preset === 'fast') level = 9;
  setMarqueeSpeedNatural(level);
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
// ⚡ 7. TOUCH & DRAG SYSTEM (Optimized for Mobile Viewport & Touch)
// ══════════════════════════════════════════════════════════
function makeDraggable(element) {
  if (!element) return;
  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

  function onDragStart(clientX, clientY, target) {
    if (target && target.closest && target.closest('.resizer-handle')) return false;
    isDragging = true;
    startX = clientX;
    startY = clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;
    element.classList.add('is-dragging');
    return true;
  }

  function onDragMove(clientX, clientY) {
    if (!isDragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;

    if (element === blurBox) {
      const rect = getVideoRenderRect();
      const minX = rect.left;
      const maxX = Math.max(minX, rect.left + rect.width - element.offsetWidth);
      const minY = rect.top;
      const maxY = Math.max(minY, rect.top + rect.height - element.offsetHeight);

      const newLeft = Math.max(minX, Math.min(maxX, Math.round(initialLeft + dx)));
      const newTop = Math.max(minY, Math.min(maxY, Math.round(initialTop + dy)));

      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;

      throttledSyncBlurSliders(newLeft, newTop, element.offsetWidth, element.offsetHeight, false);
    } else {
      const parent = element.parentElement || document.getElementById('video-viewport');
      const pW = parent ? parent.clientWidth : 280;
      const pH = parent ? parent.clientHeight : 320;
      const maxLeft = Math.max(0, pW - element.offsetWidth);
      const maxTop = Math.max(0, pH - element.offsetHeight);

      const newLeft = Math.max(0, Math.min(maxLeft, Math.round(initialLeft + dx)));
      const newTop = Math.max(0, Math.min(maxTop, Math.round(initialTop + dy)));

      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;

      if (element === logoElement) {
        state.logoOverlay.x = newLeft;
        state.logoOverlay.y = newTop;
        _syncSlider('logo-x-slider', newLeft);
        _syncSlider('logo-y-slider', newTop);
        const lxVal = document.getElementById('logo-x-val');
        const lyVal = document.getElementById('logo-y-val');
        if (lxVal) lxVal.innerText = `${newLeft}px`;
        if (lyVal) lyVal.innerText = `${newTop}px`;
      } else if (element === textElement) {
        _syncSlider('text-x-slider', newLeft);
        _syncSlider('text-y-slider', newTop);
        const txVal = document.getElementById('text-x-val');
        const tyVal = document.getElementById('text-y-val');
        if (txVal) txVal.innerText = `${newLeft}px`;
        if (tyVal) tyVal.innerText = `${newTop}px`;
      }
    }
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    element.classList.remove('is-dragging');
    if (element === blurBox) {
      throttledSyncBlurSliders(element.offsetLeft, element.offsetTop, element.offsetWidth, element.offsetHeight, true);
    }
  }

  // 1. Native Mobile Touch Handlers
  element.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (onDragStart(touch.clientX, touch.clientY, e.target)) {
        e.stopPropagation();
      }
    }
  }, { passive: false });

  element.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      e.preventDefault(); // Stop mobile screen scrolling during drag!
      e.stopPropagation();
      const touch = e.touches[0];
      onDragMove(touch.clientX, touch.clientY);
    }
  }, { passive: false });

  element.addEventListener('touchend', (e) => {
    if (isDragging) {
      e.stopPropagation();
      onDragEnd();
    }
  }, { passive: false });

  element.addEventListener('touchcancel', () => {
    onDragEnd();
  }, { passive: true });

  // 2. Desktop Mouse / Pointer Handlers
  element.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    if (onDragStart(e.clientX, e.clientY, e.target)) {
      try { element.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
    }
  });

  element.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (isDragging) {
      e.preventDefault();
      onDragMove(e.clientX, e.clientY);
    }
  });

  const onPointerEnd = (e) => {
    if (e.pointerType === 'touch') return;
    if (isDragging) {
      try {
        if (element.hasPointerCapture(e.pointerId)) {
          element.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}
      onDragEnd();
    }
  };

  element.addEventListener('pointerup', onPointerEnd);
  element.addEventListener('pointercancel', onPointerEnd);
}

function _syncSlider(sliderId, value) {
  const slider = document.getElementById(sliderId);
  if (slider) slider.value = Math.round(value);
}

function makeResizable(element) {
  if (!element) return;
  const handles = element.querySelectorAll('.resizer-handle');
  if (!handles || handles.length === 0) return;

  handles.forEach(handle => {
    let isResizing = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let startW = 0, startH = 0;
    const corner = handle.classList.contains('se') ? 'se'
                 : handle.classList.contains('sw') ? 'sw'
                 : handle.classList.contains('ne') ? 'ne' : 'nw';

    function onResizeStart(clientX, clientY) {
      isResizing = true;
      startX = clientX;
      startY = clientY;
      startLeft = element.offsetLeft;
      startTop = element.offsetTop;
      startW = element.offsetWidth;
      startH = element.offsetHeight;
      element.classList.add('is-dragging');
    }

    function onResizeMove(clientX, clientY) {
      if (!isResizing) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      const rect = getVideoRenderRect();
      const minW = 24;
      const minH = 12;

      let newLeft = startLeft;
      let newTop = startTop;
      let newW = startW;
      let newH = startH;

      if (corner === 'se') {
        const maxW = rect.left + rect.width - startLeft;
        const maxH = rect.top + rect.height - startTop;
        newW = Math.max(minW, Math.min(maxW, startW + dx));
        newH = Math.max(minH, Math.min(maxH, startH + dy));
      } else if (corner === 'sw') {
        const rightEdge = startLeft + startW;
        newLeft = Math.max(rect.left, Math.min(rightEdge - minW, startLeft + dx));
        newW = rightEdge - newLeft;
        const maxH = rect.top + rect.height - startTop;
        newH = Math.max(minH, Math.min(maxH, startH + dy));
      } else if (corner === 'ne') {
        const bottomEdge = startTop + startH;
        const maxW = rect.left + rect.width - startLeft;
        newW = Math.max(minW, Math.min(maxW, startW + dx));
        newTop = Math.max(rect.top, Math.min(bottomEdge - minH, startTop + dy));
        newH = bottomEdge - newTop;
      } else if (corner === 'nw') {
        const rightEdge = startLeft + startW;
        const bottomEdge = startTop + startH;
        newLeft = Math.max(rect.left, Math.min(rightEdge - minW, startLeft + dx));
        newW = rightEdge - newLeft;
        newTop = Math.max(rect.top, Math.min(bottomEdge - minH, startTop + dy));
        newH = bottomEdge - newTop;
      }

      element.style.left = `${Math.round(newLeft)}px`;
      element.style.top = `${Math.round(newTop)}px`;
      element.style.width = `${Math.round(newW)}px`;
      element.style.height = `${Math.round(newH)}px`;

      if (element === blurBox) {
        throttledSyncBlurSliders(Math.round(newLeft), Math.round(newTop), Math.round(newW), Math.round(newH), false);
      }
    }

    function onResizeEnd() {
      if (!isResizing) return;
      isResizing = false;
      element.classList.remove('is-dragging');
      if (element === blurBox) {
        throttledSyncBlurSliders(element.offsetLeft, element.offsetTop, element.offsetWidth, element.offsetHeight, true);
      }
    }

    // Touch events for mobile screens
    handle.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        const touch = e.touches[0];
        onResizeStart(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    handle.addEventListener('touchmove', (e) => {
      if (isResizing && e.touches.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        const touch = e.touches[0];
        onResizeMove(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    handle.addEventListener('touchend', (e) => {
      if (isResizing) {
        e.preventDefault();
        e.stopPropagation();
        onResizeEnd();
      }
    }, { passive: false });

    handle.addEventListener('touchcancel', () => {
      onResizeEnd();
    }, { passive: true });

    // Pointer events for desktop
    handle.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      e.stopPropagation();
      e.preventDefault();
      onResizeStart(e.clientX, e.clientY);
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
    });

    handle.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      if (isResizing) {
        e.preventDefault();
        onResizeMove(e.clientX, e.clientY);
      }
    });

    const onHandlePointerEnd = (e) => {
      if (e.pointerType === 'touch') return;
      if (isResizing) {
        try {
          if (handle.hasPointerCapture(e.pointerId)) {
            handle.releasePointerCapture(e.pointerId);
          }
        } catch (err) {}
        onResizeEnd();
      }
    };

    handle.addEventListener('pointerup', onHandlePointerEnd);
    handle.addEventListener('pointercancel', onHandlePointerEnd);
  });
}

// ══════════════════════════════════════════════════════════
// ⚡ 8. BUILD OPTIONS PAYLOAD (shared by auto-process & render)
// ══════════════════════════════════════════════════════════
function _buildRenderOptions() {
  const rect = getVideoRenderRect();
  const bx = blurBox ? blurBox.offsetLeft : (state.blurMask.x || 15);
  const by = blurBox ? blurBox.offsetTop : (state.blurMask.y || 15);
  const bw = blurBox ? blurBox.offsetWidth : (state.blurMask.w || 140);
  const bh = blurBox ? blurBox.offsetHeight : (state.blurMask.h || 45);

  return {
    flip_horizontal: state.flipHorizontal,
    crop_percent: state.cropPercent,
    brightness: state.brightness,
    contrast: state.contrast,
    blur_mask: {
      enabled: state.blurMask.enabled,
      x: bx,
      y: by,
      w: bw,
      h: bh,
      x_pct: Math.max(0, Math.min(1.0, (bx - rect.left) / rect.width)),
      y_pct: Math.max(0, Math.min(1.0, (by - rect.top) / rect.height)),
      w_pct: Math.max(0.01, Math.min(1.0, bw / rect.width)),
      h_pct: Math.max(0.01, Math.min(1.0, bh / rect.height)),
      vp_w: rect.width,
      vp_h: rect.height,
      intensity: state.blurMask.intensity || 25,
      tint_opacity: state.blurMask.tintOpacity !== undefined ? state.blurMask.tintOpacity : 0.40,
      tint_mode: state.blurMask.tintMode || 'dark'
    },
    marquee: {
      enabled: state.marquee.enabled,
      direction: state.marquee.direction || 'up',
      speed_sec: state.marquee.speedSec || 8,
      speed: Math.round(300 / (state.marquee.speedSec || 8)),
      color: _hexToFFmpegColor(state.textPart1.color || '#f59e0b'),
      font_size: state.textOverlay.size || 26,
      font: 'kantumruy'
    },
    // Dual-tone text
    text_overlay: {
      enabled: state.textOverlay.enabled,
      text: state.textPart1.text + ' ' + state.textPart2.text,
      x: textElement.offsetLeft,
      y: textElement.offsetTop,
      size: state.textOverlay.size,
      transparent_mode: state.textOverlay.transparentMode || false
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
      font: state.textPart1.font || 'moul'
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
      font: state.textPart2.font || 'kantumruy'
    },
    // Custom sponsor branding (2 concise lines + dual style + width & scale)
    sponsor: {
      enabled: state.sponsor.enabled,
      top_line: state.sponsor.topLine,
      bottom_line: state.sponsor.bottomLine,
      position: state.sponsor.position,
      y_percent: state.sponsor.yPercent,
      width_percent: state.sponsor.widthPercent || 88,
      scale: state.sponsor.scale || 1.0,
      color: _hexToFFmpegColor(state.sponsor.color || state.sponsor.topColor),
      top_color: _hexToFFmpegColor(state.sponsor.topColor || '#f59e0b'),
      bottom_color: _hexToFFmpegColor(state.sponsor.bottomColor || '#22d3ee'),
      top_font: state.sponsor.topFont || 'kantumruy',
      bottom_font: state.sponsor.bottomFont || 'kantumruy',
      font_size: state.sponsor.fontSize || 16,
      bg_color: state.sponsor.bgColor || 'rgba(8, 6, 18, 0.90)',
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
  const progressPercent = document.getElementById('render-progress-percent');
  const downloadBtn = document.getElementById('btn-download-result');

  progressWrap.style.display = 'flex';
  downloadBtn.style.display = 'none';
  progressBar.style.width = '10%';
  if (progressPercent) progressPercent.innerText = '10%';
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
      return;
    }
  }

  progressBar.style.width = '15%';
  if (progressPercent) progressPercent.innerText = '15%';
  progressStatus.innerText = 'កំពុងចាប់ផ្ដើម Auto Pipeline (Audio Extract & ASR)...';

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
    } else if (data.license_required) {
      showToast('🔐 ' + data.error);
      openLicenseModal();
    } else {
      showToast('⚠️ បរាជ័យក្នុងការចាប់ផ្ដើម Auto Pipeline');
    }
  } catch (err) {
    showToast('⚠️ មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបានទេ');
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
  const progressPercent = document.getElementById('render-progress-percent');
  const downloadBtn = document.getElementById('btn-download-result');

  progressWrap.style.display = 'flex';
  downloadBtn.style.display = 'none';
  progressBar.style.width = '15%';
  if (progressPercent) progressPercent.innerText = '15%';
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
      return;
    }
  }

  try {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_name: state.videoFilename,
        audio_name: state.audioFilename || undefined,
        options: _buildRenderOptions()
      })
    });
    const data = await res.json();
    if (data.status === 'started') {
      pollJobStatus(data.job_id);
    } else if (data.license_required) {
      showToast('🔐 ' + data.error);
      openLicenseModal();
    } else {
      showToast('⚠️ កំហុសក្នុងការ Render');
    }
  } catch (err) {
    showToast('⚠️ កំហុស Server');
  }
}

function pollJobStatus(jobId) {
  const progressBar = document.getElementById('render-progress-bar');
  const progressStatus = document.getElementById('render-progress-status');
  const progressPercent = document.getElementById('render-progress-percent');
  const downloadBtn = document.getElementById('btn-download-result');

  let failCount = 0;
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/job/${jobId}`);
      if (!res.ok) {
        failCount++;
        if (failCount > 10) clearInterval(interval);
        return;
      }
      failCount = 0;
      const job = await res.json();

      const pct = job.progress !== undefined ? job.progress : 15;
      progressBar.style.width = `${pct}%`;
      if (progressPercent) progressPercent.innerText = `${pct}%`;
      if (job.step) progressStatus.innerText = job.step;

      if (job.status === 'completed') {
        clearInterval(interval);
        progressBar.style.width = '100%';
        if (progressPercent) progressPercent.innerText = '100%';
        progressStatus.innerText = '✓ ជោគជ័យ ១០០%! វីដេអូរួចរាល់សម្រាប់ការទាញយក។';
        downloadBtn.style.display = 'flex';
        downloadBtn.href = job.download_url;
        downloadBtn.setAttribute('download', job.filename);
        showToast('✓ វីដេអូ Render ចប់សព្វគ្រប់ ១០០%!');
      } else if (job.status === 'failed') {
        clearInterval(interval);
        progressStatus.innerText = `⚠️ បរាជ័យ: ${job.error || 'Unknown'}`;
        progressStatus.style.color = '#f87171';
      }
    } catch (e) {
      failCount++;
      if (failCount > 10) clearInterval(interval);
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

  // Initialize and clamp blur box limits (Default strictly OFF)
  state.blurMask.enabled = false;
  if (blurBox) {
    blurBox.style.display = 'none';
    blurBox.classList.remove('active-visible');
    blurBox.style.width = '75px';
    blurBox.style.height = '28px';
    blurBox.style.left = '10px';
    blurBox.style.top = '10px';
  }
  const initWSlider = document.getElementById('blur-w-slider');
  const initHSlider = document.getElementById('blur-h-slider');
  if (initWSlider) initWSlider.value = 75;
  if (initHSlider) initHSlider.value = 28;
  const initWVal = document.getElementById('blur-w-val');
  const initHVal = document.getElementById('blur-h-val');
  if (initWVal) initWVal.innerText = '75px';
  if (initHVal) initHVal.innerText = '28px';

  const initXSlider = document.getElementById('blur-x-slider');
  const initYSlider = document.getElementById('blur-y-slider');
  if (initXSlider) initXSlider.value = 10;
  if (initYSlider) initYSlider.value = 10;
  const initXVal = document.getElementById('blur-x-val');
  const initYVal = document.getElementById('blur-y-val');
  if (initXVal) initXVal.innerText = '10px';
  if (initYVal) initYVal.innerText = '10px';

  const blurToggle = document.getElementById('toggle-blur');
  if (blurToggle) blurToggle.checked = false;

  // Initialize text size slider
  const textSizeSlider = document.getElementById('text-size-slider');
  if (textSizeSlider) textSizeSlider.value = 16;
  const textSizeVal = document.getElementById('text-size-val');
  if (textSizeVal) textSizeVal.innerText = '16px';

  updateBlurBoxLimits();
  window.addEventListener('resize', () => {
    updateBlurBoxLimits();
  });

  // Enable passive touch listeners on all sliders for smooth mobile interactions
  initPassiveSliderTouch();

  // Set default marquee animation
  updateMarqueeAnimation();

  // Video Time Update & Playback listeners
  previewVideo.addEventListener('timeupdate', updateVideoTime);
  previewVideo.addEventListener('play', () => {
    const fb = document.getElementById('video-fallback-poster');
    if (fb) fb.style.display = 'none';
    const btn = document.getElementById('btn-play-toggle');
    if (btn) btn.innerText = '⏸ ផ្អាក';
  });
  previewVideo.addEventListener('pause', () => {
    const btn = document.getElementById('btn-play-toggle');
    if (btn) btn.innerText = '▶️ ចាក់';
  });
  previewVideo.addEventListener('ended', () => {
    const btn = document.getElementById('btn-play-toggle');
    if (btn) btn.innerText = '▶️ ចាក់';
  });

  // Effect button watcher: Part1 effect change
  document.getElementById('text-part1-effect')?.addEventListener('change', () => {
    updateDualTonePreview();
  });
  document.getElementById('text-part2-effect')?.addEventListener('change', () => {
    updateDualTonePreview();
  });
});
