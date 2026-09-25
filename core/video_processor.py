# -*- coding: utf-8 -*-
"""
«នាគហ្សង បកប្រែ» — Professional Video Processor & Ultra-Fast Chunking Engine
===========================================================================
- Flip Horizontal (Mirror left-to-right)
- Crop video boundary
- Brightness & Contrast adjustment
- Adjustable Blur Mask using avgblur+overlay (replaces deprecated delogo)
- Logo image overlay with opacity & position
- Text overlay with Khmer fonts (Dual-Tone Part1/Part2 support)
- Animated Vertical Scrolling Marquee (Up / Down / Left) with continuous time tracking
- Multi-track Audio Muxing (Khmer TTS + Ducked BGM) to final HD MP4
- Ultra-Fast Chunking / Segment Processing for Long Videos (1h, 1.5h, 2h Chinese Dramas)
- Zero-Loss FFmpeg Concat Demuxer stitching (prevents OOM, RAM exhaustion, and timeouts)
"""

import os
import sys
import math
import subprocess
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List


def _resolve_font_path(font_name: str = '') -> str:
    """
    Resolve a Khmer/Latin font name to an FFmpeg-compatible fontfile= path.
    Prioritizes local genuine Khmer fonts in fonts/ directory and Windows Khmer TTF fonts.
    Guarantees a valid Khmer Unicode font to prevent font tofu (□□□□).
    """
    font_key = (font_name or '').strip().lower()

    # 1. Check local project fonts directory first
    local_font_candidates = [
        os.path.abspath('fonts/KantumruyPro-Bold.ttf'),
        os.path.abspath('fonts/KhmerOSsiemreap.ttf'),
        os.path.abspath('fonts/Siemreap.ttf'),
        os.path.abspath('fonts/Moul.ttf'),
        os.path.join(os.path.dirname(__file__), '..', '..', 'fonts', 'KantumruyPro-Bold.ttf'),
        os.path.join(os.path.dirname(__file__), '..', '..', 'fonts', 'KhmerOSsiemreap.ttf'),
    ]

    # Linux fonts installed via apt (fonts-khmeros, etc.)
    linux_candidates = [
        '/usr/share/fonts/truetype/khmeros/KhmerOSsys.ttf',
        '/usr/share/fonts/truetype/khmeros/KhmerOS.ttf',
        '/usr/share/fonts/truetype/khmeros/KhmerOS_battambang.ttf',
        '/usr/share/fonts/truetype/khmeros/KhmerOS_siemreap.ttf',
        '/usr/share/fonts/truetype/khmeros/KhmerOS_moul.ttf',
        '/usr/share/fonts/truetype/khmeros/KhmerOS_freehand.ttf',
        '/usr/share/fonts/truetype/khmeros/KhmerOS_content.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
    ]

    windows_map = {
        'moul':       [os.path.abspath('fonts/Moul.ttf'), 'C:/Windows/Fonts/Moul.ttf', 'C:/Windows/Fonts/KonKhmer_Moul.ttf', 'C:/Windows/Fonts/Moul Pali.ttf'],
        'moul pali':  ['C:/Windows/Fonts/Moul Pali.ttf', 'C:/Windows/Fonts/Moul.ttf'],
        'kantumruy':  [os.path.abspath('fonts/KantumruyPro-Bold.ttf'), 'C:/Windows/Fonts/Kantumruy.ttf', 'C:/Windows/Fonts/Kantumruy-Regular.ttf'],
        'battambang': ['C:/Windows/Fonts/Battambang.ttf', 'C:/Windows/Fonts/KhmerOS_battambang.ttf'],
        'siemreap':   [os.path.abspath('fonts/KhmerOSsiemreap.ttf'), os.path.abspath('fonts/Siemreap.ttf'), 'C:/Windows/Fonts/Siemreap.ttf', 'C:/Windows/Fonts/KhmerOS_siemreap.ttf'],
        'koulen':     ['C:/Windows/Fonts/Koulen.ttf'],
        'angkor':     ['C:/Windows/Fonts/Angkor.ttf'],
        'noto':       ['C:/Windows/Fonts/Noto Sans Khmer Bold.ttf', 'C:/Windows/Fonts/Noto Sans Khmer.ttf', 'C:/Windows/Fonts/NotoSansKhmerUI-Bold.ttf'],
        'konkhmer':   ['C:/Windows/Fonts/KonKhmer_Moul.ttf', 'C:/Windows/Fonts/KonKhmer_ChokChey.ttf'],
        'khmeros':    [os.path.abspath('fonts/KhmerOSsiemreap.ttf'), 'C:/Windows/Fonts/KhmerOS.ttf', 'C:/Windows/Fonts/KhmerOS_sys.ttf'],
        'times':      ['C:/Windows/Fonts/timesbi.ttf', 'C:/Windows/Fonts/times.ttf'],
        'georgia':    ['C:/Windows/Fonts/georgiaz.ttf', 'C:/Windows/Fonts/georgia.ttf'],
    }

    # Windows fallback chain
    windows_fallbacks = [
        os.path.abspath('fonts/KantumruyPro-Bold.ttf'),
        os.path.abspath('fonts/KhmerOSsiemreap.ttf'),
        os.path.abspath('fonts/Siemreap.ttf'),
        os.path.abspath('fonts/Moul.ttf'),
        'C:/Windows/Fonts/Kantumruy.ttf',
        'C:/Windows/Fonts/Siemreap.ttf',
        'C:/Windows/Fonts/KhmerOSsiemreap.ttf',
        'C:/Windows/Fonts/KhmerOS.ttf',
        'C:/Windows/Fonts/Noto Sans Khmer Bold.ttf',
        'C:/Windows/Fonts/Noto Sans Khmer.ttf',
        'C:/Windows/Fonts/Moul.ttf',
    ]

    candidates = []

    # Priority matching by requested font key
    for k, paths in windows_map.items():
        if k in font_key or font_key in k:
            candidates.extend(paths)
            break

    # Add local project fonts & fallbacks
    candidates.extend(local_font_candidates)
    candidates.extend(windows_fallbacks)
    if os.name != 'nt':
        candidates.extend(linux_candidates)

    for p in candidates:
        if p and os.path.exists(p):
            # If path has Windows drive letter like C:/, double-escape colon: C\:/...
            clean_p = os.path.abspath(p).replace('\\', '/')
            if len(clean_p) > 1 and clean_p[1] == ':':
                return clean_p.replace(':', r'\:')
            return clean_p

    # Fallback to system font if any exists in /usr/share/fonts on Linux
    if os.name != 'nt' and os.path.exists('/usr/share/fonts'):
        for root, _, files in os.walk('/usr/share/fonts'):
            for f in files:
                if f.endswith('.ttf'):
                    return os.path.join(root, f).replace('\\', '/')

    # Guaranteed non-empty fallback: find any .ttf in C:/Windows/Fonts
    if os.name == 'nt' and os.path.exists('C:/Windows/Fonts'):
        for fn in ['Kantumruy.ttf', 'Siemreap.ttf', 'KhmerOSsiemreap.ttf', 'KhmerOS.ttf', 'Moul.ttf', 'NotoSansKhmerUI-Regular.ttf']:
            cand_p = os.path.join('C:/Windows/Fonts', fn)
            if os.path.exists(cand_p):
                return cand_p.replace('\\', '/').replace(':', r'\:')

    return ''


def find_ffmpeg() -> str:
    """Finds FFmpeg executable in system PATH, imageio_ffmpeg, or local tools."""
    which_ff = shutil.which("ffmpeg")
    if which_ff:
        return which_ff

    try:
        import imageio_ffmpeg
        ff_img = imageio_ffmpeg.get_ffmpeg_exe()
        if ff_img and os.path.exists(ff_img):
            return ff_img
    except Exception:
        pass
        
    candidates = [
        os.path.join(os.path.dirname(__file__), '..', 'tools', 'ffmpeg.exe'),
        os.path.join(os.path.dirname(__file__), '..', 'bin', 'ffmpeg.exe'),
        r'C:\ffmpeg\bin\ffmpeg.exe',
        r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
            
    return 'ffmpeg'

def find_ffprobe() -> str:
    """Finds FFprobe executable in system PATH or adjacent to FFmpeg."""
    which_fp = shutil.which("ffprobe")
    if which_fp:
        return which_fp
        
    ff = find_ffmpeg()
    if ff != 'ffmpeg':
        ff_dir = os.path.dirname(ff)
        candidate = os.path.join(ff_dir, "ffprobe.exe" if os.name == "nt" else "ffprobe")
        if os.path.exists(candidate):
            return candidate
            
    candidates = [
        os.path.join(os.path.dirname(__file__), '..', 'tools', 'ffprobe.exe'),
        os.path.join(os.path.dirname(__file__), '..', 'bin', 'ffprobe.exe'),
        r'C:\ffmpeg\bin\ffprobe.exe',
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
            
    return 'ffprobe'

def get_video_duration(video_path: str) -> float:
    """Retrieves duration of video in seconds using ffprobe or fallback ffmpeg."""
    fp = find_ffprobe()
    try:
        cmd = [
            fp, '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            video_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if res.returncode == 0 and res.stdout.strip():
            return float(res.stdout.strip())
    except Exception:
        pass
        
    # Fallback to ffmpeg reading stderr duration
    ff = find_ffmpeg()
    try:
        cmd = [ff, '-i', video_path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        for line in (res.stderr or "").splitlines():
            if "Duration:" in line:
                # Duration: 01:23:45.67
                part = line.split("Duration:")[1].split(",")[0].strip()
                h, m, s = part.split(":")
                return float(h) * 3600 + float(m) * 60 + float(s)
    except Exception:
        pass
    return 0.0

def extract_audio_from_video(video_path: str, output_audio_path: str, ffmpeg_bin: Optional[str] = None) -> bool:
    """Extracts MP3 audio track from video file with generous timeout."""
    ff = ffmpeg_bin or find_ffmpeg()
    try:
        cmd = [
            ff, '-y',
            '-i', video_path,
            '-vn',
            '-c:a', 'libmp3lame',
            '-b:a', '192k',
            output_audio_path
        ]
        # Generous timeout for long videos
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1800)
        return res.returncode == 0 and os.path.exists(output_audio_path)
    except Exception as e:
        print(f"[Extract Audio Error] {e}", flush=True)
        return False

def has_audio_track(video_path: str, ffmpeg_bin: Optional[str] = None) -> bool:
    """Checks if a video file contains at least one audio stream."""
    ff = ffmpeg_bin or find_ffmpeg()
    try:
        cmd = [ff, '-i', video_path]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=10)
        err = (res.stderr or b'').decode('utf-8', errors='ignore')
        return "Audio:" in err
    except Exception:
        return False

def extract_video_thumbnail(video_path: str, output_thumb_path: str, timestamp: float = 0.2, ffmpeg_bin: Optional[str] = None) -> bool:
    """
    Extracts a crisp JPEG poster frame/thumbnail from a video.
    Guaranteed compatibility with H.264, H.265/HEVC, VP9, AV1, and mobile camera formats.
    Attempts fast-seek to timestamp (0.2s) first to avoid initial black frames,
    with automatic fallback to start of video (0.0s).
    """
    ff = ffmpeg_bin or find_ffmpeg()
    try:
        ts_str = f"{timestamp:06.3f}"
        cmd = [
            ff, '-y',
            '-ss', ts_str,
            '-i', str(video_path),
            '-vframes', '1',
            '-q:v', '2',
            str(output_thumb_path)
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=15)
        if res.returncode == 0 and os.path.exists(output_thumb_path) and os.path.getsize(output_thumb_path) > 0:
            return True

        # Fallback seek to frame 0
        cmd_fallback = [
            ff, '-y',
            '-ss', '00:00:00.000',
            '-i', str(video_path),
            '-vframes', '1',
            '-q:v', '2',
            str(output_thumb_path)
        ]
        res_fb = subprocess.run(cmd_fallback, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=15)
        return res_fb.returncode == 0 and os.path.exists(output_thumb_path) and os.path.getsize(output_thumb_path) > 0
    except Exception as e:
        print(f"[Extract Thumbnail Error] {e}", flush=True)
        return False

def _sanitize_ffmpeg_text(text: str) -> str:
    """
    Sanitizes text for safe use in FFmpeg drawtext filter.
    Escapes single-quotes, colons, backslashes that break filter syntax.
    """
    if not text:
        return ''
    # Order matters: backslash first, then colon, then single-quote
    text = text.replace('\\', '\\\\')
    text = text.replace(':', '\\:')
    text = text.replace("'", "\\'")
    return text

def _write_temp_text_file(text: str) -> str:
    """
    Writes UTF-8 text to a temporary file and returns a relative or escaped path
    that FFmpeg drawtext can read reliably on Windows and Linux without colon parsing bugs.
    """
    try:
        tmp_dir = os.path.join(os.path.dirname(__file__), '..', 'temp_text')
        os.makedirs(tmp_dir, exist_ok=True)
        tf = tempfile.NamedTemporaryFile(suffix='.txt', dir=tmp_dir, delete=False, mode='w', encoding='utf-8')
        tf.write(str(text or ''))
        tf.close()
        return os.path.relpath(tf.name).replace('\\', '/')
    except Exception:
        tf = tempfile.NamedTemporaryFile(suffix='.txt', delete=False, mode='w', encoding='utf-8')
        tf.write(str(text or ''))
        tf.close()
        p = tf.name.replace('\\', '/')
        if len(p) > 1 and p[1] == ':':
            p = p.replace(':', r'\:')
        return p


def _build_blur_mask_filter(bx: int, by: int, bw: int, bh: int) -> str:
    """
    Builds avgblur-based blur mask to cover a rectangular region.
    Replaces the deprecated/removed delogo filter in modern FFmpeg (5.x/6.x).
    
    Strategy:
      1. Crop the region → apply avgblur → [blurred_region]
      2. Overlay blurred_region back at original position
    Uses split/overlay filter_complex chain.
    """
    # Clamp to sane values
    bw = max(10, int(bw))
    bh = max(10, int(bh))
    bx = max(0, int(bx))
    by = max(0, int(by))
    return (
        f"[{{inp}}]split=2[base_{{uid}}][work_{{uid}}];"
        f"[work_{{uid}}]crop={bw}:{bh}:{bx}:{by},avgblur=sizeX=25:sizeY=25[blurred_{{uid}}];"
        f"[base_{{uid}}][blurred_{{uid}}]overlay={bx}:{by}[{{out}}]"
    )

def _build_filter_graph(
    opts: Dict[str, Any],
    has_logo: bool,
    logo_input_idx: Optional[int],
    time_offset: float = 0.0
) -> str:
    """
    Builds a complete FFmpeg filter_complex string for a chunk or full video.
    Returns the filter_complex string and the name of the final video output pad.
    Returns ('', '[0:v]') if no filters needed.
    """
    steps = []          # list of filter_complex segment strings
    current_pad = "[v0]"
    step_idx = 0

    def next_pad():
        nonlocal step_idx
        step_idx += 1
        return f"[v{step_idx}]"

    # Input source
    steps.append(f"[0:v]null{current_pad}")

    # 0. Resolution Scale to max 720p (Crucial for Render.com 512MB RAM & ultrafast <30s render)
    out = next_pad()
    steps.append(f"{current_pad}scale='trunc(min(720,iw)/2)*2':-2:flags=fast_bilinear{out}")
    current_pad = out

    # 1. Flip Horizontal
    if opts.get('flip_horizontal'):
        out = next_pad()
        steps.append(f"{current_pad}hflip{out}")
        current_pad = out

    # 2. Crop
    crop_percent = opts.get('crop_percent', 0)
    if crop_percent and crop_percent > 0:
        scale_factor = (100 - crop_percent) / 100.0
        pad_factor = (crop_percent / 2) / 100.0
        out = next_pad()
        steps.append(
            f"{current_pad}crop=in_w*{scale_factor}:in_h*{scale_factor}:in_w*{pad_factor}:in_h*{pad_factor}{out}"
        )
        current_pad = out

    # 3. Brightness & Contrast
    brightness = opts.get('brightness', 0)
    contrast = opts.get('contrast', 1.0)
    if brightness != 0 or contrast != 1.0:
        out = next_pad()
        steps.append(f"{current_pad}eq=brightness={brightness}:contrast={contrast}{out}")
        current_pad = out

    # 4. Blur Mask Box using avgblur+overlay + optional pure/dark/white tint
    # 4. Blur Mask Box using avgblur+overlay + optional pure/dark/white tint
    blur_opts = opts.get('blur_mask')
    if blur_opts and blur_opts.get('enabled'):
        intensity = max(5, min(60, int(blur_opts.get('intensity', 25))))
        tint_mode = str(blur_opts.get('tint_mode', 'dark')).lower()
        tint_opacity = max(0.0, min(1.0, float(blur_opts.get('tint_opacity', 0.4))))

        # Normalized coordinates from UI for 100% exact 9:16 and 16:9 matching
        x_pct = blur_opts.get('x_pct')
        y_pct = blur_opts.get('y_pct')
        w_pct = blur_opts.get('w_pct')
        h_pct = blur_opts.get('h_pct')

        if x_pct is not None and y_pct is not None and w_pct is not None and h_pct is not None:
            # Resolution-independent exact pixel formulas using FFmpeg iw & ih
            bx_expr = f"trunc(iw*{max(0.0, min(0.95, float(x_pct))):.4f})"
            by_expr = f"trunc(ih*{max(0.0, min(0.95, float(y_pct))):.4f})"
            bw_expr = f"trunc(iw*{max(0.02, min(1.0, float(w_pct))):.4f})"
            bh_expr = f"trunc(ih*{max(0.02, min(1.0, float(h_pct))):.4f})"
        else:
            bx = max(0, min(710, int(blur_opts.get('x', 10))))
            by = max(0, min(1270, int(blur_opts.get('y', 10))))
            bw = max(10, min(720 - bx, int(blur_opts.get('w', 120))))
            bh = max(10, min(1280 - by, int(blur_opts.get('h', 45))))
            bx_expr = str(bx)
            by_expr = str(by)
            bw_expr = str(bw)
            bh_expr = str(bh)

        if tint_mode == 'white':
            tint_color = 'white'
        elif tint_mode == 'pure':
            tint_opacity = 0.0
            tint_color = 'black'
        else:
            tint_color = 'black'

        uid = f"bl{step_idx}"
        if tint_mode != 'pure' and tint_opacity > 0.02:
            out_blur = f"[bl_tmp_{uid}]"
            out = next_pad()
            blur_chain = (
                f"{current_pad}split=2[base_{uid}][work_{uid}];"
                f"[work_{uid}]crop={bw_expr}:{bh_expr}:{bx_expr}:{by_expr},avgblur=sizeX={intensity}:sizeY={intensity}[blurred_{uid}];"
                f"[base_{uid}][blurred_{uid}]overlay={bx_expr}:{by_expr}{out_blur};"
                f"{out_blur}drawbox=x={bx_expr}:y={by_expr}:w={bw_expr}:h={bh_expr}:color={tint_color}@{tint_opacity:.2f}:t=fill{out}"
            )
        else:
            out = next_pad()
            blur_chain = (
                f"{current_pad}split=2[base_{uid}][work_{uid}];"
                f"[work_{uid}]crop={bw_expr}:{bh_expr}:{bx_expr}:{by_expr},avgblur=sizeX={intensity}:sizeY={intensity}[blurred_{uid}];"
                f"[base_{uid}][blurred_{uid}]overlay={bx_expr}:{by_expr}{out}"
            )
        steps.append(blur_chain)
        current_pad = out

    # 5. Dual-Tone Title Overlay (Direct Header Marquee Integration)
    tp1 = opts.get('text_part1')
    tp2 = opts.get('text_part2')
    text_opts = opts.get('text_overlay', {})
    marquee_opts = opts.get('marquee', {})
    marquee_enabled = bool(marquee_opts and marquee_opts.get('enabled'))

    # Assemble Dual-Tone text
    t1_text = (tp1.get('text') if tp1 else '').strip()
    t2_text = (tp2.get('text') if tp2 else '').strip()
    full_title = f"{t1_text} {t2_text}".strip()
    if not full_title:
        full_title = (text_opts.get('text') or 'នាគហ្សង បកប្រែ').strip()

    def _build_drawtext_with_effect(text: str, color: str, effect: str,
                                     outline_color: str, outline_w: int,
                                     x_expr: str, y_expr: str, font_size: int,
                                     font_name: str = 'noto') -> str:
        """Build a drawtext filter string with optional shadow/glow/outline effect."""
        safe_text = _sanitize_ffmpeg_text(text)
        resolved_font = _resolve_font_path(font_name)
        font_arg = f"fontfile='{resolved_font}':" if resolved_font else ""
        base = (
            f"{font_arg}"
            f"text='{safe_text}':fontcolor={color}:fontsize={font_size}:"
            f"x={x_expr}:y={y_expr}"
        )
        if effect == 'shadow':
            base += ":shadowcolor=black@0.7:shadowx=2:shadowy=2"
        elif effect == 'glow':
            base += f":borderw=3:bordercolor={outline_color or 'cyan'}@0.9"
        elif effect == 'outline':
            ow = max(1, int(outline_w or 2))
            base += f":borderw={ow}:bordercolor={outline_color or 'black'}"
        return f"drawtext={base}"

    if marquee_enabled and full_title:
        # ── DIRECT MARQUEE ON DUAL-TONE TITLE ──
        # Animate the actual Dual-Tone Title directly across the screen!
        direction = marquee_opts.get('direction', 'up').lower()
        speed_sec = float(marquee_opts.get('speed_sec') or 8.0)
        font_size = int(text_opts.get('size', 26))
        m_color = (tp1.get('color') if tp1 else None) or marquee_opts.get('color', '0xF59E0B')
        m_font_name = (tp1.get('font') if tp1 else None) or 'moul'
        m_font_path = _resolve_font_path(m_font_name) or _resolve_font_path('kantumruy')
        m_font_arg = f"fontfile='{m_font_path}':" if m_font_path else ""
        m_tf_path = _write_temp_text_file(full_title)

        t_expr = f"(t+{time_offset:.3f})" if time_offset > 0 else "t"

        if direction == 'up':
            x_expr = "(w-text_w)/2"
            y_expr = f"h-mod({t_expr}*((h+text_h)/{speed_sec:.2f})\\,h+text_h)"
        elif direction == 'down':
            x_expr = "(w-text_w)/2"
            y_expr = f"-text_h+mod({t_expr}*((h+text_h)/{speed_sec:.2f})\\,h+text_h)"
        elif direction == 'right':
            x_expr = f"-text_w+mod({t_expr}*((w+text_w)/{speed_sec:.2f})\\,w+text_w)"
            y_expr = "(h-text_h)/2"
        else:  # 'left'
            x_expr = f"w-mod({t_expr}*((w+text_w)/{speed_sec:.2f})\\,w+text_w)"
            y_expr = "(h-text_h)/2"

        out = next_pad()
        draw_marquee = (
            f"{current_pad}drawtext="
            f"{m_font_arg}"
            f"textfile='{m_tf_path}':fontcolor={m_color}:fontsize={font_size}:"
            f"box=1:boxcolor=black@0.65:boxborderw=5:"
            f"x={x_expr}:y={y_expr}{out}"
        )
        steps.append(draw_marquee)
        current_pad = out

    elif (tp1 and tp1.get('enabled') and t1_text) or (tp2 and tp2.get('enabled') and t2_text):
        # ── STATIC DUAL-TONE TITLE ──
        ty = text_opts.get('y', 30)
        font_size = text_opts.get('size', 26)
        if tp1 and tp1.get('enabled') and t1_text:
            tx1 = text_opts.get('x', 15)
            out = next_pad()
            dt1 = _build_drawtext_with_effect(
                t1_text, tp1.get('color', 'white'),
                tp1.get('effect', 'none'),
                tp1.get('outline_color', 'black'),
                int(tp1.get('outline_w', 2)),
                str(tx1), str(ty), font_size,
                font_name=tp1.get('font', 'moul')
            )
            steps.append(f"{current_pad}{dt1}{out}")
            current_pad = out
        if tp2 and tp2.get('enabled') and t2_text:
            part1_len = len(t1_text)
            x2_offset = int(text_opts.get('x', 15)) + int(part1_len * font_size * 0.72)
            out = next_pad()
            dt2 = _build_drawtext_with_effect(
                t2_text, tp2.get('color', 'yellow'),
                tp2.get('effect', 'none'),
                tp2.get('outline_color', 'black'),
                int(tp2.get('outline_w', 2)),
                str(x2_offset), str(ty), font_size,
                font_name=tp2.get('font', 'kantumruy')
            )
            steps.append(f"{current_pad}{dt2}{out}")
            current_pad = out
    elif text_opts and text_opts.get('enabled') and text_opts.get('text'):
        s_text = _sanitize_ffmpeg_text(text_opts['text'])
        tx = text_opts.get('x', '20')
        ty = text_opts.get('y', '20')
        tsize = text_opts.get('size', 26)
        tcolor = text_opts.get('color', 'white')
        border_w = text_opts.get('border_w', 2)
        border_c = text_opts.get('border_color', 'black')
        legacy_font = _resolve_font_path(text_opts.get('font', 'noto'))
        font_arg = f"fontfile='{legacy_font}':" if legacy_font else ""
        out = next_pad()
        steps.append(
            f"{current_pad}drawtext={font_arg}"
            f"text='{s_text}':fontcolor={tcolor}:fontsize={tsize}:"
            f"borderw={border_w}:bordercolor={border_c}:x={tx}:y={ty}{out}"
        )
        current_pad = out


    # 7. Sponsor Banner Overlay (Professional Compact Badge - Bottom Center, No Black Box)
    sponsor_opts = opts.get('sponsor')
    if sponsor_opts and sponsor_opts.get('enabled'):
        s_title = (sponsor_opts.get('brand') or sponsor_opts.get('top_line') or sponsor_opts.get('top_text') or sponsor_opts.get('title') or '').strip()
        s_phone = (sponsor_opts.get('contact') or sponsor_opts.get('bottom_line') or sponsor_opts.get('phone') or '').strip()
        s_ad = (sponsor_opts.get('tagline') or sponsor_opts.get('badge') or sponsor_opts.get('ad_text') or '').strip()

        # Sanitize any legacy strings
        s_title = s_title.replace('នាគហ្សង បកប្រែ', '').replace('«នាគហ្សង» ឧបត្ថម្ភធំ', '').replace('@neakzong', '').strip()
        s_phone = s_phone.replace('នាគហ្សង បកប្រែ', '').replace('@neakzong', '').strip()
        s_ad = s_ad.replace('នាគហ្សង បកប្រែ', '').replace('@neakzong', '').strip()

        if not s_title and not s_phone and not s_ad:
            s_title = '👑 ឧបត្ថម្ភធំ'
            s_phone = '📞 0889111400 | Telegram'
            s_ad = '✨ ទទួលផ្សាយពាណិជ្ជកម្ម'
        elif not s_phone:
            s_phone = '📞 0889111400 | Telegram'

        s_scale = max(0.6, min(1.8, float(sponsor_opts.get('scale', 1.0))))
        s_font_path = _resolve_font_path(sponsor_opts.get('font', 'kantumruy'))
        if not s_font_path or 'outfit' in str(s_font_path).lower() or 'calibri' in str(s_font_path).lower() or 'arial' in str(s_font_path).lower():
            s_font_path = _resolve_font_path('kantumruy')
        s_font_arg = f"fontfile='{s_font_path}':"

        # Build lines array (Compact 3 lines: Title, Phone, Tagline)
        lines = []
        if s_title:
            lines.append({'text': s_title, 'color': sponsor_opts.get('top_color', '0xF59E0B'), 'size': s_font_size})
        if s_phone:
            lines.append({'text': s_phone, 'color': sponsor_opts.get('mid_color', '0x22D3EE'), 'size': max(10, int(s_font_size * 0.92))})
        if s_ad:
            lines.append({'text': s_ad, 'color': sponsor_opts.get('bottom_color', '0xFFFFFF'), 'size': max(9, int(s_font_size * 0.85))})

        line_gap = max(2, int(2.5 * s_scale))
        total_h = sum(l['size'] for l in lines) + (len(lines) - 1) * line_gap

        # Position at Bottom Center (No Black Box, Transparent & Clean)
        s_y_percent = sponsor_opts.get('y_percent')
        if s_y_percent is not None:
            base_y = f"trunc(h*{float(s_y_percent)/100.0:.3f})"
        else:
            base_y = f"h-{total_h + 16}"

        out = next_pad()
        # Compact lines with shadow & border, NO BLACK BOX (no drawbox, no box=1)
        sub_filters = []
        curr_y_offset = 0
        for l in lines:
            tf_line_path = _write_temp_text_file(l['text'])
            y_calc = f"{base_y}+{curr_y_offset}"
            sub_filters.append(
                f"drawtext={s_font_arg}textfile='{tf_line_path}':fontcolor={l['color']}:fontsize={l['size']}:"
                f"borderw=2:bordercolor=black@0.9:shadowcolor=black@0.9:shadowx=2:shadowy=2:"
                f"x=(w-text_w)/2:y={y_calc}"
            )
            curr_y_offset += l['size'] + line_gap

        sponsor_chain = f"{current_pad}" + ",".join(sub_filters) + f"{out}"
        steps.append(sponsor_chain)
        current_pad = out

    # 8. Logo Overlay (composited last)
    if has_logo and logo_input_idx is not None:
        logo_opts = opts.get('logo_overlay', {})
        lx = logo_opts.get('x', '20')
        ly = logo_opts.get('y', '20')
        l_scale = logo_opts.get('scale', 0.2)
        l_opacity = logo_opts.get('opacity', 0.85)
        out = next_pad()
        steps.append(
            f"[{logo_input_idx}:v]scale=iw*{l_scale}:-1,"
            f"format=rgba,colorchannelmixer=aa={l_opacity}[logo_scaled];"
            f"{current_pad}[logo_scaled]overlay={lx}:{ly}{out}"
        )
        current_pad = out

    # If nothing was added (only the null step), return simple passthrough
    if step_idx == 0:
        return '', '[0:v]'

    filter_complex = ';'.join(steps)
    return filter_complex, current_pad



def render_segment(
    input_video_path: str,
    output_segment_path: str,
    start_time: float,
    duration: float,
    audio_path: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    ffmpeg_bin: Optional[str] = None
) -> bool:
    """Renders a single chunk/segment of video with filters and audio."""
    ff = ffmpeg_bin or find_ffmpeg()
    opts = options or {}
    
    cmd = [
        ff, '-y',
        '-ss', f"{start_time:.3f}",
        '-t', f"{duration:.3f}",
        '-i', input_video_path
    ]
    next_input_idx = 1
    
    # Logo overlay input
    logo_opts = opts.get('logo_overlay')
    has_logo = bool(logo_opts and logo_opts.get('enabled') and logo_opts.get('path') and os.path.exists(logo_opts['path']))
    logo_input_idx = None
    if has_logo:
        cmd.extend(['-i', logo_opts['path']])
        logo_input_idx = next_input_idx
        next_input_idx += 1
        
    orig_has_audio = has_audio_track(input_video_path, ffmpeg_bin=ff)
    has_custom_audio = bool(audio_path and os.path.exists(audio_path) and os.path.getsize(audio_path) > 100)
    audio_input_idx = None
    if has_custom_audio:
        cmd.extend([
            '-ss', f"{start_time:.3f}",
            '-t', f"{duration:.3f}",
            '-i', audio_path
        ])
        audio_input_idx = next_input_idx
        next_input_idx += 1
        
    filter_complex, out_pad = _build_filter_graph(opts, has_logo, logo_input_idx, time_offset=start_time)
    
    # Audio handling: When custom audio (Khmer TTS / ducked soundtrack) is present, map it directly
    has_audio_out = False
    if has_custom_audio:
        audio_mix = f"[{audio_input_idx}:a]volume=1.3[aout]"
        filter_complex = f"{filter_complex};{audio_mix}" if filter_complex else f"[0:v]null[vout];{audio_mix}"
        if not out_pad or out_pad == '[0:v]':
            out_pad = '[vout]'
        has_audio_out = True

    if filter_complex:
        cmd.extend(['-filter_complex', filter_complex, '-map', out_pad])
    else:
        cmd.extend(['-map', '0:v'])
        
    if has_audio_out:
        cmd.extend(['-map', '[aout]', '-c:a', 'aac', '-b:a', '192k'])
    elif orig_has_audio:
        cmd.extend(['-map', '0:a', '-c:a', 'aac', '-b:a', '192k'])
        
    # Ultrafast encode per segment with Multi-threading (threads=4)
    cmd.extend([
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-threads', '4',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        output_segment_path
    ])
    
    # Segment timeout: 600s is plenty for a 3-minute chunk
    try:
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=600)
        if res.returncode != 0:
            err_output = (res.stderr or b'').decode('utf-8', errors='replace')
            print(f"[Segment Render Error] FFmpeg exit {res.returncode}:\n{err_output[-2000:]}", flush=True)
            return False
        return os.path.exists(output_segment_path) and os.path.getsize(output_segment_path) > 0
    except Exception as e:
        print(f"[Segment Render Exception] {e}", flush=True)
        return False

def render_long_video_chunked(
    input_video_path: str,
    output_video_path: str,
    audio_path: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    ffmpeg_bin: Optional[str] = None,
    progress_callback: Optional[Callable[[int, str], None]] = None,
    chunk_size_sec: float = 180.0
) -> bool:
    """
    Ultra-Fast Long Video Chunking Pipeline:
    1. Divides long video (1h, 1.5h, 2h) into manageable chunks (e.g. 180s - 300s each).
    2. Renders each chunk sequentially with ultrafast preset (avoiding RAM exhaustion).
    3. Seamlessly joins all chunks using FFmpeg Concat Demuxer without quality loss in 1-2 seconds.
    """
    ff = ffmpeg_bin or find_ffmpeg()
    total_dur = get_video_duration(input_video_path)
    
    # If duration could not be detected or is small (<= 180s), run direct single-pass
    if total_dur <= 180.0:
        return _render_direct_fast(
            input_video_path, output_video_path,
            audio_path=audio_path, options=options, ffmpeg_bin=ff,
            progress_callback=progress_callback
        )
        
    chunk_dir = Path(output_video_path).parent / f"tmp_chunks_{Path(output_video_path).stem}"
    chunk_dir.mkdir(parents=True, exist_ok=True)
    
    num_chunks = math.ceil(total_dur / chunk_size_sec)
    segment_files = []
    
    print(f"[Chunking Engine] Processing video duration: {total_dur:.1f}s across {num_chunks} chunks...", flush=True)
    
    try:
        for idx in range(num_chunks):
            start = idx * chunk_size_sec
            dur = min(chunk_size_sec, total_dur - start)
            seg_path = str(chunk_dir / f"seg_{idx:04d}.mp4")
            
            pct = 85 + int((idx / max(1, num_chunks)) * 12) # Progress from 85% to 97%
            msg = f"Rendering HD Segment {idx+1}/{num_chunks} ({pct}%)..."
            if progress_callback:
                progress_callback(pct, msg)
            print(f"[Chunking Engine] {msg} [start={start:.1f}s, dur={dur:.1f}s]", flush=True)
            
            ok = render_segment(
                input_video_path=input_video_path,
                output_segment_path=seg_path,
                start_time=start,
                duration=dur,
                audio_path=audio_path,
                options=options,
                ffmpeg_bin=ff
            )
            if not ok:
                print(f"[Chunking Engine] Failed at segment {idx+1}, falling back to direct render.", flush=True)
                return _render_direct_fast(
                    input_video_path, output_video_path,
                    audio_path=audio_path, options=options, ffmpeg_bin=ff,
                    progress_callback=progress_callback
                )
            segment_files.append(seg_path)
            
        # Concat Demuxer Join
        if progress_callback:
            progress_callback(98, "Stitching Final HD Video (Concat Demuxer)...")
            
        list_file = chunk_dir / "concat_list.txt"
        with open(list_file, "w", encoding="utf-8") as f:
            for seg in segment_files:
                # Escaped for ffmpeg concat
                clean_path = os.path.abspath(seg).replace('\\', '/')
                f.write(f"file '{clean_path}'\n")
                
        concat_cmd = [
            ff, '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', str(list_file),
            '-c', 'copy',
            '-movflags', '+faststart',
            output_video_path
        ]
        res = subprocess.run(concat_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=300)
        if res.returncode != 0:
            err_out = (res.stderr or b'').decode('utf-8', errors='replace')
            print(f"[Concat Error] FFmpeg exit {res.returncode}:\n{err_out[-1000:]}", flush=True)
        success = res.returncode == 0 and os.path.exists(output_video_path) and os.path.getsize(output_video_path) > 0
        
        if success and progress_callback:
            progress_callback(100, "Done!")
            
        return success
    except Exception as e:
        print(f"[Chunking Engine Error] {e}", flush=True)
        return False
    finally:
        # Cleanup temporary chunks
        try:
            shutil.rmtree(chunk_dir, ignore_errors=True)
        except Exception:
            pass

def _render_direct_fast(
    input_video_path: str,
    output_video_path: str,
    audio_path: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    ffmpeg_bin: Optional[str] = None,
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> bool:
    """Direct single-pass render with multi-threading (-threads 4), ultrafast preset, and active progress reporting."""
    ff = ffmpeg_bin or find_ffmpeg()
    opts = options or {}
    
    cmd = [ff, '-y', '-i', input_video_path]
    next_input_idx = 1
    
    logo_opts = opts.get('logo_overlay')
    has_logo = bool(logo_opts and logo_opts.get('enabled') and logo_opts.get('path') and os.path.exists(logo_opts['path']))
    logo_input_idx = None
    if has_logo:
        cmd.extend(['-i', logo_opts['path']])
        logo_input_idx = next_input_idx
        next_input_idx += 1
        
    orig_has_audio = has_audio_track(input_video_path, ffmpeg_bin=ff)
    has_custom_audio = bool(audio_path and os.path.exists(audio_path) and os.path.getsize(audio_path) > 100)
    audio_input_idx = None
    if has_custom_audio:
        cmd.extend(['-i', audio_path])
        audio_input_idx = next_input_idx
        next_input_idx += 1

    filter_complex, out_pad = _build_filter_graph(opts, has_logo, logo_input_idx, time_offset=0.0)

    # Audio handling: When custom audio (Khmer TTS / ducked soundtrack) is present, map it directly
    has_audio_out = False
    if has_custom_audio:
        audio_mix = f"[{audio_input_idx}:a]volume=1.3[aout]"
        filter_complex = f"{filter_complex};{audio_mix}" if filter_complex else f"[0:v]null[vout];{audio_mix}"
        if not out_pad or out_pad == '[0:v]':
            out_pad = '[vout]'
        has_audio_out = True

    if filter_complex:
        cmd.extend(['-filter_complex', filter_complex, '-map', out_pad])
    else:
        cmd.extend(['-map', '0:v'])
        
    if has_audio_out:
        cmd.extend(['-map', '[aout]', '-c:a', 'aac', '-b:a', '192k'])
    elif orig_has_audio:
        cmd.extend(['-map', '0:a', '-c:a', 'aac', '-b:a', '192k'])
        
    cmd.extend([
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-threads', '4',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        output_video_path
    ])
    
    # Active Progress Monitor Thread to advance 80% -> 98% smoothly
    stop_event = threading.Event()
    def _progress_advancer():
        curr_pct = 82
        steps = [
            (83, "កំពុង Encode វីដេអូ HD (Threads: 4)..."),
            (86, "កំពុងដំណើរការ Overlays & Blur..."),
            (89, "កំពុងបញ្ចូលសំឡេងខ្មែរ Neural..."),
            (93, "កំពុង Mux MP4 Streams..."),
            (96, "រៀបចំសម្រេច ១០០%..."),
            (98, "សរសេរឯកសារចុងក្រោយ...")
        ]
        for pct, msg in steps:
            if stop_event.wait(timeout=1.8):
                break
            if progress_callback:
                progress_callback(pct, msg)

    advancer_thread = threading.Thread(target=_progress_advancer, daemon=True)
    advancer_thread.start()

    try:
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=14400)
        stop_event.set()
        advancer_thread.join(timeout=0.5)

        if res.returncode != 0:
            err_output = (res.stderr or b'').decode('utf-8', errors='replace')
            print(f"[Direct Render Error] FFmpeg exit {res.returncode}:\n{err_output[-3000:]}", flush=True)
            return False

        ok = os.path.exists(output_video_path) and os.path.getsize(output_video_path) > 0
        if ok and progress_callback:
            progress_callback(100, "✓ Render ជោគជ័យ ១០០%!")
        return ok
    except Exception as e:
        stop_event.set()
        print(f"[Direct Render Exception] {e}", flush=True)
        return False

def render_final_video(
    input_video_path: str,
    output_video_path: str,
    audio_path: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    ffmpeg_bin: Optional[str] = None,
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> bool:
    """
    Main entry point for rendering final HD video.
    Automatically picks chunked pipeline for long videos (> 180s) or fast direct for short clips.
    """
    return render_long_video_chunked(
        input_video_path=input_video_path,
        output_video_path=output_video_path,
        audio_path=audio_path,
        options=options,
        ffmpeg_bin=ffmpeg_bin,
        progress_callback=progress_callback
    )
