# -*- coding: utf-8 -*-
"""
«នាគហ្សង បកប្រែ» — Professional Video Processor & Copyright Shield Engine
========================================================================
- Flip Horizontal (Mirror left-to-right)
- Crop video boundary
- Brightness & Contrast adjustment
- Adjustable Blur Mask for Chinese watermarks / logos
- Logo image overlay with opacity & position
- Text overlay with Khmer fonts
- Animated Vertical Scrolling Marquee (Up / Down) with speed control
- Multi-track Audio Muxing (Khmer TTS + Ducked BGM) to final HD MP4
"""

import os
import sys
import subprocess
import shutil
from typing import Dict, Any, Optional

def find_ffmpeg() -> str:
    """Finds FFmpeg executable in system PATH, imageio_ffmpeg, or local tools."""
    # 1. Check PATH first
    which_ff = shutil.which("ffmpeg")
    if which_ff:
        return which_ff

    # 2. Check bundled imageio_ffmpeg
    try:
        import imageio_ffmpeg
        ff_img = imageio_ffmpeg.get_ffmpeg_exe()
        if ff_img and os.path.exists(ff_img):
            return ff_img
    except Exception:
        pass
        
    candidates = [
        os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'ffmpeg.exe'),
        os.path.join(os.path.dirname(__file__), '..', '..', 'bin', 'ffmpeg.exe'),
        r'C:\ffmpeg\bin\ffmpeg.exe',
        r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
            
    return 'ffmpeg'

def extract_audio_from_video(video_path: str, output_audio_path: str, ffmpeg_bin: Optional[str] = None) -> bool:
    """Extracts MP3 audio track from video file."""
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
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return res.returncode == 0 and os.path.exists(output_audio_path)
    except Exception as e:
        print(f"[Extract Audio Error] {e}", flush=True)
        return False

def render_final_video(
    input_video_path: str,
    output_video_path: str,
    audio_path: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    ffmpeg_bin: Optional[str] = None
) -> bool:
    """
    Renders video with all professional edits applied:
    - Flip Horizontal
    - Crop
    - Brightness / Contrast
    - Blur Mask Box
    - Logo Overlay
    - Text Overlay
    - Vertical Marquee Scrolling Text
    - Mixed Dubbed Audio
    """
    ff = ffmpeg_bin or find_ffmpeg()
    opts = options or {}
    
    video_filters = []
    
    # 1. Flip Horizontal
    if opts.get('flip_horizontal'):
        video_filters.append("hflip")
        
    # 2. Crop
    crop_percent = opts.get('crop_percent', 0)
    if crop_percent and crop_percent > 0:
        # e.g. crop 4% = in_w*0.96:in_h*0.96:(in_w*0.02):(in_h*0.02)
        scale_factor = (100 - crop_percent) / 100.0
        pad_factor = (crop_percent / 2) / 100.0
        video_filters.append(f"crop=in_w*{scale_factor}:in_h*{scale_factor}:in_w*{pad_factor}:in_h*{pad_factor}")
        
    # 3. Brightness & Contrast
    brightness = opts.get('brightness', 0) # -0.5 to 0.5
    contrast = opts.get('contrast', 1.0)   # 0.5 to 2.0
    if brightness != 0 or contrast != 1.0:
        video_filters.append(f"eq=brightness={brightness}:contrast={contrast}")
        
    # 4. Blur Mask Box (delogo / boxblur)
    blur_opts = opts.get('blur_mask')
    if blur_opts and blur_opts.get('enabled'):
        bx = int(blur_opts.get('x', 10))
        by = int(blur_opts.get('y', 10))
        bw = max(10, int(blur_opts.get('w', 120)))
        bh = max(10, int(blur_opts.get('h', 45)))
        # Delogo works cleanly for masking existing channel logos/watermarks
        video_filters.append(f"delogo=x={bx}:y={by}:w={bw}:h={bh}:show=0")

    # 5. Animated Vertical Scrolling Marquee Text (Up or Down)
    marquee_opts = opts.get('marquee')
    if marquee_opts and marquee_opts.get('enabled') and marquee_opts.get('text'):
        m_text = marquee_opts['text'].replace("'", "\\'").replace(":", "\\:")
        direction = marquee_opts.get('direction', 'up').lower()
        speed_px = int(marquee_opts.get('speed', 30))  # pixels per second
        font_size = int(marquee_opts.get('font_size', 28))
        font_color = marquee_opts.get('color', 'yellow')
        m_x = marquee_opts.get('x', '(w-text_w)/2')  # centered horizontally
        
        if direction == 'up':
            # Starts from bottom of video, scrolls up continuously
            y_expr = f"h-mod(t*{speed_px}\\,h+text_h)"
        else:
            # Starts from top of video, scrolls down continuously
            y_expr = f"-text_h+mod(t*{speed_px}\\,h+text_h)"
            
        draw_marquee = (
            f"drawtext=text='{m_text}':fontcolor={font_color}:fontsize={font_size}:"
            f"box=1:boxcolor=black@0.65:boxborderw=6:"
            f"x={m_x}:y={y_expr}"
        )
        video_filters.append(draw_marquee)

    # 6. Static Text Overlay
    text_opts = opts.get('text_overlay')
    if text_opts and text_opts.get('enabled') and text_opts.get('text'):
        s_text = text_opts['text'].replace("'", "\\'").replace(":", "\\:")
        tx = text_opts.get('x', '20')
        ty = text_opts.get('y', '20')
        tsize = text_opts.get('size', 26)
        tcolor = text_opts.get('color', 'white')
        border_w = text_opts.get('border_w', 2)
        border_c = text_opts.get('border_color', 'black')
        
        draw_static = (
            f"drawtext=text='{s_text}':fontcolor={tcolor}:fontsize={tsize}:"
            f"borderw={border_w}:bordercolor={border_c}:x={tx}:y={ty}"
        )
        video_filters.append(draw_static)

    # Compile FFmpeg Command with clean multi-input stream mapping
    cmd = [ff, '-y', '-i', input_video_path]
    next_input_idx = 1
    
    # Check Logo overlay image
    logo_opts = opts.get('logo_overlay')
    has_logo = logo_opts and logo_opts.get('enabled') and logo_opts.get('path') and os.path.exists(logo_opts['path'])
    logo_input_idx = None
    if has_logo:
        cmd.extend(['-i', logo_opts['path']])
        logo_input_idx = next_input_idx
        next_input_idx += 1
        
    has_custom_audio = audio_path and os.path.exists(audio_path)
    audio_input_idx = None
    if has_custom_audio:
        cmd.extend(['-i', audio_path])
        audio_input_idx = next_input_idx
        next_input_idx += 1

    # Filter graph
    if has_logo:
        lx = logo_opts.get('x', '20')
        ly = logo_opts.get('y', '20')
        l_scale = logo_opts.get('scale', 0.2)
        l_opacity = logo_opts.get('opacity', 0.85)
        vf_base = ','.join(video_filters) if video_filters else 'null'
        filter_complex = (
            f"[0:v]{vf_base}[vid];"
            f"[{logo_input_idx}:v]scale=iw*{l_scale}:-1,format=rgba,colorchannelmixer=aa={l_opacity}[logo];"
            f"[vid][logo]overlay={lx}:{ly}[vout]"
        )
        cmd.extend(['-filter_complex', filter_complex, '-map', '[vout]'])
    elif video_filters:
        filter_complex = f"[0:v]{','.join(video_filters)}[vout]"
        cmd.extend(['-filter_complex', filter_complex, '-map', '[vout]'])
    else:
        cmd.extend(['-map', '0:v'])
        
    # Audio mapping
    if has_custom_audio:
        cmd.extend(['-map', f"{audio_input_idx}:a", '-c:a', 'aac', '-b:a', '192k'])
    else:
        cmd.extend(['-map', '0:a?', '-c:a', 'copy'])
        
    # Standard Video Codec for maximum mobile & browser compatibility
    cmd.extend([
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        output_video_path
    ])
    
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        return res.returncode == 0 and os.path.exists(output_video_path)
    except Exception as e:
        print(f"[Render Video Error] {e}", flush=True)
        return False
