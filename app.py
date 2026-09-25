# -*- coding: utf-8 -*-
"""
«នាគហ្សង បកប្រែ» (Neak Zong Translate AI) — Cloud Backend Server
==============================================================
- Mobile-First AI Video Translator, Khmer Voice Dubbing Studio & Video Editor
- 24/7 Cloud Support for Render.com, HuggingFace, and Local Runners
- REST APIs for Upload, Translation, Neural TTS, Audio Ducking, and HD Export
- Admin License Management System (Seconds, Minutes, Hours, Days, Lifetime)
- Ultra-Fast Chunking / Segment Engine for Long Chinese Dramas (1h, 1.5h, 2h)
"""

import os
import sys
import time
import json
import uuid
import threading
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory, Response

# Ensure UTF-8 output
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / 'uploads'
EXPORTS_DIR = BASE_DIR / 'exports'
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Add parent directory to sys.path for internal imports
sys.path.insert(0, str(BASE_DIR))

from core.translator import translate_single_query, translate_srt, parse_srt, format_srt
from core.tts_engine import synthesize_khmer_voice, apply_audio_ducking, generate_synced_cues_voiceover
from core.audio_separator import separate_vocals_and_bgm
from core.video_processor import extract_audio_from_video, render_final_video, find_ffmpeg, get_video_duration, extract_video_thumbnail
from core.asr_engine import ChineseSpeechRecognizer
from core.license_manager import license_mgr, DEFAULT_ADMIN_PASSWORD
from core.telegram_bot_service import bot_service, BOT_USERNAME, ADMIN_ID

# ── Lazy ASR Engine Loader (Cold Start Optimization) ───────────
_asr_engine = None

def get_asr_engine():
    global _asr_engine
    if _asr_engine is None:
        from core.asr_engine import ChineseSpeechRecognizer
        _asr_engine = ChineseSpeechRecognizer(model_size="tiny")
    return _asr_engine

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['JSON_AS_ASCII'] = False
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1 GB upload limit for long drama videos

PORT = int(os.environ.get('PORT', 5060))
START_TIME = time.time()
PROCESSING_JOBS = {}

# Start 24/7 Telegram Bot Service only if explicitly enabled
ENABLE_TELEGRAM_BOT = os.environ.get("ENABLE_TELEGRAM_BOT", "0") == "1"
if ENABLE_TELEGRAM_BOT:
    try:
        threading.Thread(target=bot_service.start, daemon=True, name="NeakZongBotThread").start()
    except Exception as _e_bot:
        print(f"Warning: Failed to start Telegram Bot service: {_e_bot}", flush=True)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

def require_active_license():
    """Validates that a valid, unexpired license is active. Returns error Response or None."""
    valid, msg, info = license_mgr.verify_license_validity()
    if not valid:
        return jsonify({
            'status': 'error',
            'error': f'តម្រូវឱ្យមាន License Key សកម្មដើម្បីបកប្រែ ឬ Export វីដេអូ! ({msg})',
            'license_required': True,
            'message': msg
        }), 403
    return None

# ══════════════════════════════════════════════════════════════
# 🟢 1. HEALTH & KEEP-ALIVE (For Render.com 24/7)
# ══════════════════════════════════════════════════════════════

@app.route('/healthz')
def healthz():
    """Ultra-lightweight health-check endpoint for Keep-Alive pings (Instant 200 OK)"""
    return "OK", 200

@app.route('/health')
@app.route('/ping')
def health():
    uptime = int(time.time() - START_TIME)
    h, m, s = uptime // 3600, (uptime % 3600) // 60, uptime % 60
    valid, lic_msg, lic_info = license_mgr.verify_license_validity()
    return jsonify({
        'status': 'ok',
        'app_name': 'នាគហ្សង បកប្រែ (Neak Zong Translate AI)',
        'version': '1.0.9-MOBILE-STUDIO',
        'uptime': f'{h}h {m}m {s}s',
        'ffmpeg_available': bool(find_ffmpeg()),
        'mode': 'Cloud-24-7',
        'license_active': valid,
        'license_remaining': lic_info.get('remaining_text', lic_msg),
        'telegram_bot': {
            'online': bot_service.is_running,
            'mode': bot_service.mode,
            'username': f'@{BOT_USERNAME}',
            'admin_id': ADMIN_ID,
            'webhook_url': bot_service.webhook_url,
            'updates_processed': bot_service.updates_processed
        }
    })

# ── 24/7 CLOUD KEEP-ALIVE SENTINEL (Prevents Render Free Inactivity Sleep) ─────
import urllib.request

def _start_keep_alive_sentinel():
    def _pinger():
        time.sleep(25)  # Initial wait for server to bind
        target_host = os.environ.get("RENDER_EXTERNAL_URL") or "https://neak-zong-translate.onrender.com"
        ping_url = target_host.rstrip("/") + "/healthz"
        print(f"[Keep-Alive] 24/7 Sentinel active targeting: {ping_url}", flush=True)

        while True:
            try:
                time.sleep(420)  # 7 minutes (Render free sleeps at 15m)
                req = urllib.request.Request(
                    ping_url,
                    headers={"User-Agent": "NeakZong-KeepAlive-Sentinel/1.0"}
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    if resp.status == 200:
                        print(f"[Keep-Alive] Periodic ping successful ({time.strftime('%H:%M:%S')}) — Render 24/7 active!", flush=True)
            except Exception as e:
                print(f"[Keep-Alive] Ping notice: {e}", flush=True)

    t = threading.Thread(target=_pinger, daemon=True, name="NeakZongKeepAliveSentinel")
    t.start()

_start_keep_alive_sentinel()


# ══════════════════════════════════════════════════════════════
# 🤖 TELEGRAM BOT WEBHOOK & STATUS APIS (24/7 CLOUD HOSTING)
# ══════════════════════════════════════════════════════════════

@app.route('/api/telegram-webhook', methods=['POST'])
def api_telegram_webhook():
    """Receives incoming updates from Telegram Webhook immediately."""
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({'status': 'ignored', 'reason': 'empty_payload'}), 200

        ok = bot_service.process_webhook_update(data)
        return jsonify({'status': 'ok' if ok else 'queued'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/telegram/status', methods=['GET'])
def api_telegram_status():
    """Returns Telegram Bot health & stats."""
    uptime = int(time.time() - bot_service.start_time) if bot_service.start_time else 0
    return jsonify({
        'status': 'ok',
        'bot_online': bot_service.is_running,
        'mode': bot_service.mode,
        'username': f'@{BOT_USERNAME}',
        'bot_id': 8988340001,
        'admin_id': ADMIN_ID,
        'webhook_url': bot_service.webhook_url,
        'uptime_seconds': uptime,
        'updates_processed': bot_service.updates_processed
    })

@app.route('/api/telegram/setup-webhook', methods=['GET', 'POST'])
def api_telegram_setup_webhook():
    """Dynamically sets the Telegram webhook URL."""
    target_url = request.args.get('url') or (request.get_json(silent=True) or {}).get('url')
    if not target_url:
        target_url = os.environ.get('RENDER_EXTERNAL_URL')
    if not target_url:
        target_url = request.host_url

    import asyncio
    if bot_service._loop and bot_service.app:
        fut = asyncio.run_coroutine_threadsafe(bot_service.set_webhook_url(target_url), bot_service._loop)
        try:
            ok, msg = fut.result(timeout=10)
            return jsonify({'status': 'ok' if ok else 'error', 'message': msg, 'webhook_url': bot_service.webhook_url})
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)}), 500
    return jsonify({'status': 'error', 'message': 'Bot service loop not active'}), 503

# ══════════════════════════════════════════════════════════════
# 🔑 2. LICENSE KEY MANAGEMENT & ACTIVATION APIS
# ══════════════════════════════════════════════════════════════

@app.route('/api/license/status', methods=['GET'])
def api_license_status():
    """Returns current active license status on this device/server."""
    valid, msg, info = license_mgr.verify_license_validity()
    return jsonify({
        'status': 'ok',
        'valid': valid,
        'message': msg,
        'info': info
    })

@app.route('/api/license/activate', methods=['POST'])
def api_license_activate():
    """Activates a License Key entered by mobile/web user."""
    data = request.get_json() or {}
    key_str = data.get('key', '')
    device_id = data.get('device_id', '')
    ok, msg, rec = license_mgr.activate_key(key_str, device_id=device_id)
    if ok:
        return jsonify({
            'status': 'ok',
            'message': msg,
            'license': rec
        })
    return jsonify({
        'status': 'error',
        'message': msg
    }), 400

@app.route('/api/admin/license/generate', methods=['POST'])
def api_admin_license_generate():
    """Admin Endpoint: Creates new License Key with specific duration."""
    data = request.get_json() or {}
    pwd = data.get('password', '')
    if pwd != DEFAULT_ADMIN_PASSWORD:
        return jsonify({'status': 'error', 'message': 'Admin Password មិនត្រឹមត្រូវឡើយ'}), 401
        
    dtype = data.get('type', 'days') # seconds, minutes, hours, days, weeks, months, years, lifetime
    val = data.get('value', 30)
    note = data.get('note', '')
    record = license_mgr.create_license(duration_type=dtype, duration_val=val, note=note)
    return jsonify({
        'status': 'ok',
        'license': record,
        'message': f"បង្កើត License Key {record['key']} ជោគជ័យ!"
    })

@app.route('/api/admin/license/list', methods=['GET'])
def api_admin_license_list():
    """Admin Endpoint: Lists all generated license keys."""
    pwd = request.args.get('password', '')
    if pwd != DEFAULT_ADMIN_PASSWORD:
        return jsonify({'status': 'error', 'message': 'Admin Password មិនត្រឹមត្រូវឡើយ'}), 401
    all_lic = license_mgr.load_all()
    return jsonify({
        'status': 'ok',
        'licenses': all_lic
    })

@app.route('/api/admin/license/revoke', methods=['POST'])
def api_admin_license_revoke():
    """Admin Endpoint: Revokes or deletes a license key."""
    data = request.get_json() or {}
    pwd = data.get('password', '')
    if pwd != DEFAULT_ADMIN_PASSWORD:
        return jsonify({'status': 'error', 'message': 'Admin Password មិនត្រឹមត្រូវឡើយ'}), 401
    key_str = data.get('key', '')
    ok = license_mgr.revoke_license(key_str)
    return jsonify({'status': 'ok' if ok else 'error'})

# ══════════════════════════════════════════════════════════════
# 🔵 3. PWA & WEB APP SHELL
# ══════════════════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/sw.js')
def service_worker():
    resp = send_from_directory('static', 'sw.js')
    resp.headers['Service-Worker-Allowed'] = '/'
    resp.headers['Cache-Control'] = 'no-cache'
    return resp

@app.route('/exports/<path:filename>')
def download_export(filename):
    return send_from_directory(EXPORTS_DIR, filename, as_attachment=True)

# ══════════════════════════════════════════════════════════════
# 🟡 4. REST APIS (Upload, Media, Translation, Voice, Render)
# ══════════════════════════════════════════════════════════════

def generate_fast_h264_preview(src_video: str, out_preview: str, max_duration: int = 180) -> bool:
    """
    Transcodes any video (including H.265/HEVC, VP9, AV1, 4K) into ultra-compatible H.264 MP4 with faststart.
    Plays natively with zero lag on 100% of mobile WebViews and browsers.
    """
    ff = find_ffmpeg()
    try:
        cmd = [
            ff, '-y',
            '-ss', '0',
            '-t', str(max_duration),
            '-i', str(src_video),
            '-vf', "scale='trunc(min(720,iw)/2)*2':-2:flags=fast_bilinear",
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '26',
            '-c:a', 'aac',
            '-b:a', '96k',
            '-movflags', '+faststart',
            str(out_preview)
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=40)
        return res.returncode == 0 and os.path.exists(out_preview) and os.path.getsize(out_preview) > 0
    except Exception as e:
        print(f"[Preview Transcode Error] {e}", flush=True)
        return False

@app.route('/api/upload', methods=['POST'])
def api_upload():
    """Uploads a video or subtitle file from phone/PC and auto-extracts video thumbnail."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': 'Empty filename'}), 400
        
    ext = Path(f.filename).suffix.lower()
    file_id = str(uuid.uuid4())[:8]
    safe_name = f"upload_{file_id}{ext}"
    dest_path = UPLOADS_DIR / safe_name
    f.save(str(dest_path))
    
    file_url = f"/api/files/{safe_name}"
    is_video = ext in ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.ts', '.3gp', '.m4v']
    is_srt = ext in ['.srt', '.vtt', '.txt']

    thumbnail_url = None
    preview_url = None
    if is_video:
        thumb_name = f"thumb_{file_id}.jpg"
        thumb_path = UPLOADS_DIR / thumb_name
        try:
            if extract_video_thumbnail(str(dest_path), str(thumb_path)):
                thumbnail_url = f"/api/files/{thumb_name}"
        except Exception as e:
            print(f"[Upload] Thumbnail generation failed: {e}", flush=True)

        preview_name = f"preview_{file_id}.mp4"
        preview_path = UPLOADS_DIR / preview_name
        preview_url = f"/api/preview/{safe_name}"
        threading.Thread(
            target=generate_fast_h264_preview,
            args=(str(dest_path), str(preview_path)),
            daemon=True
        ).start()

    return jsonify({
        'status': 'ok',
        'filename': safe_name,
        'original_name': f.filename,
        'filepath': str(dest_path),
        'file_url': file_url,
        'thumbnail_url': thumbnail_url or f"/api/thumbnail/{safe_name}",
        'preview_url': preview_url or f"/api/preview/{safe_name}",
        'size': os.path.getsize(dest_path),
        'is_video': is_video,
        'is_srt': is_srt
    })

@app.route('/api/preview/<filename>')
def serve_video_preview(filename):
    """
    Serves a fast, webview-compatible H.264 preview stream.
    If the preview transcode exists, streams it immediately; otherwise generates on-demand.
    """
    stem = Path(filename).stem.replace('upload_', '')
    preview_name = f"preview_{stem}.mp4"
    preview_path = UPLOADS_DIR / preview_name

    if preview_path.exists() and preview_path.stat().st_size > 0:
        return send_from_directory(UPLOADS_DIR, preview_name, mimetype='video/mp4')

    src_path = UPLOADS_DIR / filename
    if not src_path.exists():
        for candidate in UPLOADS_DIR.glob(f"*{stem}*"):
            if candidate.suffix.lower() in ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.ts', '.3gp']:
                src_path = candidate
                break

    if src_path.exists():
        if generate_fast_h264_preview(str(src_path), str(preview_path)):
            return send_from_directory(UPLOADS_DIR, preview_name, mimetype='video/mp4')
        return send_from_directory(UPLOADS_DIR, src_path.name, mimetype='video/mp4')

    return jsonify({'error': 'Preview not available'}), 404

@app.route('/api/thumbnail/<filename>')
def serve_video_thumbnail(filename):
    """Serves or dynamically extracts a poster thumbnail image for a video."""
    stem = Path(filename).stem
    if stem.startswith('thumb_'):
        thumb_file = UPLOADS_DIR / f"{stem}.jpg"
        if thumb_file.exists():
            return send_from_directory(UPLOADS_DIR, f"{stem}.jpg")

    thumb_name = f"thumb_{stem.replace('upload_', '')}.jpg"
    thumb_path = UPLOADS_DIR / thumb_name
    if thumb_path.exists():
        return send_from_directory(UPLOADS_DIR, thumb_name)

    video_path = UPLOADS_DIR / filename
    if not video_path.exists():
        for candidate in UPLOADS_DIR.glob(f"*{stem}*"):
            if candidate.suffix.lower() in ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.ts', '.3gp', '.m4v']:
                video_path = candidate
                break

    if video_path.exists():
        if extract_video_thumbnail(str(video_path), str(thumb_path)):
            return send_from_directory(UPLOADS_DIR, thumb_name)

    return jsonify({'error': 'Thumbnail not found'}), 404

@app.route('/api/files/<filename>')
def serve_uploaded_file(filename):
    return send_from_directory(UPLOADS_DIR, filename)

@app.route('/api/extract-audio', methods=['POST'])
def api_extract_audio():
    """Extracts MP3 audio track from an uploaded video."""
    data = request.get_json() or {}
    video_filename = data.get('filename')
    if not video_filename:
        return jsonify({'error': 'filename is required'}), 400
        
    video_path = UPLOADS_DIR / video_filename
    if not video_path.exists():
        return jsonify({'error': 'Video file not found'}), 404
        
    audio_filename = f"extracted_{video_path.stem}.mp3"
    audio_path = EXPORTS_DIR / audio_filename
    
    success = extract_audio_from_video(str(video_path), str(audio_path))
    if success:
        return jsonify({
            'status': 'ok',
            'audio_filename': audio_filename,
            'audio_url': f"/exports/{audio_filename}",
            'size': os.path.getsize(audio_path)
        })
    else:
        return jsonify({'error': 'Failed to extract audio track'}), 500

@app.route('/api/translate', methods=['POST'])
def api_translate():
    """Translates Chinese text, SRT subtitle, or auto-transcribes video speech into natural Khmer."""
    lic_err = require_active_license()
    if lic_err:
        return lic_err

    data = request.get_json() or {}
    text = data.get('text', '')
    srt_content = data.get('srt_content', '')
    video_filename = data.get('video_filename', '')
    
    # 1. Direct SRT provided
    if srt_content:
        translated_srt, cues = translate_srt(srt_content)
        return jsonify({
            'status': 'ok',
            'translated_srt': translated_srt,
            'cues_count': len(cues),
            'sample_cues': cues[:5]
        })
        
    # 2. Auto-Speech-to-Text from Video if video_filename is given
    if video_filename:
        video_path = UPLOADS_DIR / video_filename
        if video_path.exists():
            print(f"[Auto-ASR] Transcribing speech from {video_filename}...", flush=True)
            cues = get_asr_engine().transcribe_to_cues(str(video_path), language="zh")
            if cues:
                chinese_srt = ChineseSpeechRecognizer.cues_to_srt(cues)
                translated_srt, t_cues = translate_srt(chinese_srt)
                combined_km = ' '.join([c.get('text_km', '') for c in t_cues])
                return jsonify({
                    'status': 'ok',
                    'auto_transcribed': True,
                    'chinese_srt': chinese_srt,
                    'translated_srt': translated_srt,
                    'cues_count': len(t_cues),
                    'translated_text': combined_km
                })
        
    if text:
        translated = translate_single_query(text, source_lang='zh-CN', target_lang='km')
        return jsonify({
            'status': 'ok',
            'original': text,
            'translated': translated
        })
        
    return jsonify({'error': 'text, srt_content, or video_filename is required'}), 400

@app.route('/api/tts', methods=['POST'])
def api_tts():
    """Generates natural Khmer speech audio file."""
    lic_err = require_active_license()
    if lic_err:
        return lic_err

    data = request.get_json() or {}
    text = data.get('text', '')
    voice = data.get('voice', 'female') # 'male' (Piseth) or 'female' (Sreymom)
    speed = float(data.get('speed', 1.0)) # 1.0x to 1.5x
    pitch = int(data.get('pitch', 0))
    
    if not text:
        return jsonify({'error': 'text is required'}), 400
        
    tts_id = str(uuid.uuid4())[:8]
    out_filename = f"tts_{voice}_{tts_id}.mp3"
    out_path = EXPORTS_DIR / out_filename
    
    success = synthesize_khmer_voice(text, str(out_path), voice_type=voice, speed=speed, pitch=pitch)
    if success:
        return jsonify({
            'status': 'ok',
            'audio_url': f"/exports/{out_filename}",
            'filename': out_filename,
            'voice': voice,
            'speed': speed
        })
    else:
        return jsonify({'error': 'Failed to synthesize Khmer speech'}), 500

@app.route('/api/duck-audio', methods=['POST'])
def api_duck_audio():
    """Applies sidechain audio ducking between original audio and voiceover."""
    lic_err = require_active_license()
    if lic_err:
        return lic_err

    data = request.get_json() or {}
    bg_audio_name = data.get('bg_audio')
    voice_audio_name = data.get('voice_audio')
    duck_level = float(data.get('duck_level', 0.15))
    
    bg_path = EXPORTS_DIR / bg_audio_name if (EXPORTS_DIR / bg_audio_name).exists() else UPLOADS_DIR / bg_audio_name
    voice_path = EXPORTS_DIR / voice_audio_name if (EXPORTS_DIR / voice_audio_name).exists() else UPLOADS_DIR / voice_audio_name
    
    if not bg_path.exists() or not voice_path.exists():
        return jsonify({'error': 'Audio files not found'}), 404
        
    out_filename = f"ducked_{str(uuid.uuid4())[:8]}.mp3"
    out_path = EXPORTS_DIR / out_filename
    
    success = apply_audio_ducking(str(bg_path), str(voice_path), str(out_path), duck_level=duck_level)
    if success:
        return jsonify({
            'status': 'ok',
            'audio_url': f"/exports/{out_filename}",
            'filename': out_filename
        })
    else:
        return jsonify({'error': 'Audio ducking failed'}), 500

@app.route('/api/render', methods=['POST'])
def api_render():
    """
    Renders video with all professional edits applied (supports long chunking).
    """
    lic_err = require_active_license()
    if lic_err:
        return lic_err

    data = request.get_json() or {}
    video_name = data.get('video_name')
    if not video_name:
        return jsonify({'error': 'video_name is required'}), 400
        
    video_path = UPLOADS_DIR / video_name
    if not video_path.exists():
        return jsonify({'error': 'Video file not found'}), 404
        
    options = data.get('options', {})
    audio_name = data.get('audio_name')
    audio_path = str(EXPORTS_DIR / audio_name) if audio_name and (EXPORTS_DIR / audio_name).exists() else None
    if not audio_path:
        # Check if there is any recently generated TTS or ducked audio for this video session
        v_stem = Path(video_name).stem
        candidates = list(EXPORTS_DIR.glob(f"*{v_stem}*.mp3")) + list(EXPORTS_DIR.glob("ducked_*.mp3")) + list(EXPORTS_DIR.glob("tts_*.mp3"))
        valid_candidates = [c for c in candidates if c.exists() and c.stat().st_size > 1000]
        if valid_candidates:
            valid_candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            audio_path = str(valid_candidates[0])
    
    out_filename = f"NeakZong_{str(uuid.uuid4())[:8]}.mp4"
    out_path = EXPORTS_DIR / out_filename
    
    job_id = str(uuid.uuid4())[:8]
    PROCESSING_JOBS[job_id] = {'status': 'processing', 'progress': 10, 'step': 'Starting Render...', 'filename': out_filename}
    
    def _run_render_worker():
        try:
            def _prog_cb(pct, step_msg):
                PROCESSING_JOBS[job_id]['progress'] = pct
                PROCESSING_JOBS[job_id]['step'] = step_msg
                
            success = render_final_video(
                str(video_path), str(out_path),
                audio_path=audio_path,
                options=options,
                progress_callback=_prog_cb
            )
            if success:
                PROCESSING_JOBS[job_id]['status'] = 'completed'
                PROCESSING_JOBS[job_id]['progress'] = 100
                PROCESSING_JOBS[job_id]['step'] = 'Done!'
                PROCESSING_JOBS[job_id]['download_url'] = f"/exports/{out_filename}"
            else:
                PROCESSING_JOBS[job_id]['status'] = 'failed'
                PROCESSING_JOBS[job_id]['error'] = 'FFmpeg render error'
        except Exception as e:
            PROCESSING_JOBS[job_id]['status'] = 'failed'
            PROCESSING_JOBS[job_id]['error'] = str(e)
            
    threading.Thread(target=_run_render_worker, daemon=True).start()
    
    return jsonify({
        'status': 'started',
        'job_id': job_id,
        'filename': out_filename
    })

@app.route('/api/job/<job_id>')
def api_job_status(job_id):
    job = PROCESSING_JOBS.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(job)

@app.route('/api/auto-process', methods=['POST'])
def api_auto_process():
    """
    1-Click End-to-End Pipeline with Ultra-Fast Chunking for Long Videos:
    Upload Video -> Extract Audio -> Translate Chinese to Khmer ->
    Generate Khmer TTS -> Duck Audio -> Apply Overlays -> Export MP4 HD
    """
    lic_err = require_active_license()
    if lic_err:
        return lic_err

    data = request.get_json() or {}
    video_name = data.get('video_name')
    srt_content = data.get('srt_content')
    voice = data.get('voice', 'female')
    speed = float(data.get('speed', 1.0))
    options = data.get('options', {})
    
    if not video_name:
        return jsonify({'error': 'video_name is required'}), 400
        
    video_path = UPLOADS_DIR / video_name
    if not video_path.exists():
        return jsonify({'error': 'Video not found'}), 404
        
    job_id = f"auto_{str(uuid.uuid4())[:8]}"
    out_filename = f"NeakZong_Auto_{job_id}.mp4"
    out_path = EXPORTS_DIR / out_filename
    
    PROCESSING_JOBS[job_id] = {'status': 'processing', 'progress': 10, 'step': 'ទាញយកសំឡេងពីវីដេអូ (Extracting Audio)...'}
    
    def _pipeline_worker():
        try:
            # 1. Extract audio (10% -> 25%)
            bg_audio = EXPORTS_DIR / f"bg_{job_id}.mp3"
            extract_audio_from_video(str(video_path), str(bg_audio))
            PROCESSING_JOBS[job_id]['progress'] = 25
            PROCESSING_JOBS[job_id]['step'] = 'AI កំពុងស្ដាប់សំឡេងចិន (Whisper ASR)...'
            
            # 2. Chinese Speech Recognition & Khmer Translation (30% -> 50%)
            khmer_text = ""
            active_cues = []
            if srt_content:
                PROCESSING_JOBS[job_id]['progress'] = 35
                PROCESSING_JOBS[job_id]['step'] = 'កំពុងបកប្រែ Subtitles ជាភាសាខ្មែរ...'
                t_srt, active_cues = translate_srt(srt_content)
                khmer_text = ' '.join([c.get('text_km', '') for c in active_cues])
                PROCESSING_JOBS[job_id]['progress'] = 50
            else:
                # 100% Auto: AI listens to Chinese speech & translates to Khmer
                PROCESSING_JOBS[job_id]['progress'] = 30
                PROCESSING_JOBS[job_id]['step'] = 'AI Faster-Whisper កំពុងសម្គាល់ការសន្ទនាតួអង្គ...'
                cues = get_asr_engine().transcribe_to_cues(str(video_path), language="zh", timeout_sec=18.0)
                PROCESSING_JOBS[job_id]['progress'] = 45
                PROCESSING_JOBS[job_id]['step'] = 'កំពុងបកប្រែការសន្ទនាចិនជាភាសាខ្មែរ...'
                if cues:
                    chinese_srt = ChineseSpeechRecognizer.cues_to_srt(cues)
                    t_srt, active_cues = translate_srt(chinese_srt)
                    khmer_text = ' '.join([c.get('text_km', '') for c in active_cues])
                else:
                    khmer_text = "រឿងភាគចិនពិសេស បកប្រែជាភាសាខ្មែរដោយ នាគហ្សង បកប្រែ AI"
                PROCESSING_JOBS[job_id]['progress'] = 50
                
            # 3. Synchronized Khmer TTS with Lip-Sync atempo (50% -> 70%)
            PROCESSING_JOBS[job_id]['progress'] = 55
            PROCESSING_JOBS[job_id]['step'] = 'កំពុងបង្កើតសំឡេងខ្មែរ AI Neural & សមកាលកម្មមាត់ (Lip-Sync)...'
            
            tts_audio = EXPORTS_DIR / f"tts_{job_id}.mp3"
            total_dur = get_video_duration(str(video_path)) or 10.0
            synced_ok = False
            if active_cues:
                try:
                    synced_ok = generate_synced_cues_voiceover(
                        active_cues, total_dur, str(tts_audio),
                        voice_type=voice, speed=speed, ffmpeg_bin=find_ffmpeg()
                    )
                except Exception as e_sync:
                    print(f"[Voice Sync Warning] {e_sync}, fallback to continuous", flush=True)

            if not synced_ok or not tts_audio.exists():
                synthesize_khmer_voice(khmer_text, str(tts_audio), voice_type=voice, speed=speed)
            
            PROCESSING_JOBS[job_id]['progress'] = 68
            # 4. Ducking (70% -> 75%)
            PROCESSING_JOBS[job_id]['progress'] = 75
            PROCESSING_JOBS[job_id]['step'] = 'Mixing Audio & Ducking BGM (75%)...'
            ducked_audio = EXPORTS_DIR / f"ducked_{job_id}.mp3"
            duck_ok = apply_audio_ducking(str(bg_audio), str(tts_audio), str(ducked_audio), duck_level=0.15, ffmpeg_bin=find_ffmpeg())
            audio_to_use = str(ducked_audio) if (duck_ok and ducked_audio.exists() and ducked_audio.stat().st_size > 1000) else str(tts_audio)
            
            # 5. Render Video with Chunking Progress Callback (80% -> 100%)
            PROCESSING_JOBS[job_id]['progress'] = 80
            PROCESSING_JOBS[job_id]['step'] = 'Rendering Final HD Video (Ultra-Fast Engine)...'
            
            def _prog_cb(pct, step_msg):
                PROCESSING_JOBS[job_id]['progress'] = pct
                PROCESSING_JOBS[job_id]['step'] = step_msg
                
            success = render_final_video(
                str(video_path), str(out_path),
                audio_path=audio_to_use,
                options=options,
                progress_callback=_prog_cb
            )
            
            if success:
                PROCESSING_JOBS[job_id]['progress'] = 100
                PROCESSING_JOBS[job_id]['status'] = 'completed'
                PROCESSING_JOBS[job_id]['step'] = '✓ ជោគជ័យ ១០០%!'
                PROCESSING_JOBS[job_id]['download_url'] = f"/exports/{out_filename}"
            else:
                PROCESSING_JOBS[job_id]['status'] = 'failed'
                PROCESSING_JOBS[job_id]['error'] = 'Video rendering failed'
        except Exception as e:
            PROCESSING_JOBS[job_id]['status'] = 'failed'
            PROCESSING_JOBS[job_id]['error'] = str(e)
            
    threading.Thread(target=_pipeline_worker, daemon=True).start()
    return jsonify({
        'status': 'started',
        'job_id': job_id,
        'filename': out_filename
    })
    
@app.route('/apk')
@app.route('/download/apk')
@app.route('/download-apk')
def direct_download_apk():
    apk_name = 'NeakZong_Translate_v1.0.apk'
    apk_path = BASE_DIR / 'static' / apk_name
    if not apk_path.exists():
        # Fallback to root if needed
        apk_path = BASE_DIR.parent / apk_name
    return send_from_directory(apk_path.parent, apk_path.name, as_attachment=True)

if __name__ == '__main__':
    print("=" * 65, flush=True)
    print("  🐉 «នាគហ្សង បកប្រែ» — NEAK ZONG TRANSLATE AI SERVER", flush=True)
    print(f"  [>] Version : 1.0.9-MOBILE-STUDIO (Dark Cyberpunk Dragon)", flush=True)
    print(f"  [>] Port    : {PORT}", flush=True)
    print(f"  [>] FFmpeg  : {find_ffmpeg()}", flush=True)
    print("=" * 65, flush=True)
    app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True)
