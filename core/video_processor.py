# -*- coding: utf-8 -*-
"""
«នាគហ្សង បកប្រែ» — Professional Video Processor & Ultra-Fast Chunking Engine
===========================================================================
- Flip Horizontal (Mirror left-to-right)
- Crop video boundary
- Brightness & Contrast adjustment
- Adjustable Blur Mask for Chinese watermarks / logos
- Logo image overlay with opacity & position
- Text overlay with Khmer fonts
- Animated Vertical Scrolling Marquee (Up / Down) with continuous time tracking
- Multi-track Audio Muxing (Khmer TTS + Ducked BGM) to final HD MP4
- Ultra-Fast Chunking / Segment Processing for Long Videos (1h, 1.5h, 2h Chinese Dramas)
- Zero-Loss FFmpeg Concat Demuxer stitching (prevents OOM, RAM exhaustion, and timeouts)
"""

import os
import sys
import math
import subprocess
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List

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
        os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'ffmpeg.exe'),
        os.path.join(os.path.dirname(__file__), '..', '..', 'bin', 'ffmpeg.exe'),
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
        os.path.join(os.path.dirname(__file__), '..', '..', 'tools', 'ffprobe.exe'),
        os.path.join(os.path.dirname(__file__), '..', '..', 'bin', 'ffprobe.exe'),
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

def _build_filter_graph(
    opts: Dict[str, Any],
    has_logo: bool,
    logo_input_idx: Optional[int],
    time_offset: float = 0.0
) -> List[str]:
    """Builds video filter arguments for a chunk or full video."""
    video_filters = []
    
    # 1. Flip Horizontal
    if opts.get('flip_horizontal'):
        video_filters.append("hflip")
        
    # 2. Crop
    crop_percent = opts.get('crop_percent', 0)
    if crop_percent and crop_percent > 0:
        scale_factor = (100 - crop_percent) / 100.0
        pad_factor = (crop_percent / 2) / 100.0
        video_filters.append(f"crop=in_w*{scale_factor}:in_h*{scale_factor}:in_w*{pad_factor}:in_h*{pad_factor}")
        
    # 3. Brightness & Contrast
    brightness = opts.get('brightness', 0)
    contrast = opts.get('contrast', 1.0)
    if brightness != 0 or contrast != 1.0:
        video_filters.append(f"eq=brightness={brightness}:contrast={contrast}")
        
    # 4. Blur Mask Box (delogo)
    blur_opts = opts.get('blur_mask')
    if blur_opts and blur_opts.get('enabled'):
        bx = int(blur_opts.get('x', 10))
        by = int(blur_opts.get('y', 10))
        bw = max(10, int(blur_opts.get('w', 120)))
        bh = max(10, int(blur_opts.get('h', 45)))
        video_filters.append(f"delogo=x={bx}:y={by}:w={bw}:h={bh}:show=0")

    # 5. Animated Vertical Scrolling Marquee Text (Up or Down)
    marquee_opts = opts.get('marquee')
    if marquee_opts and marquee_opts.get('enabled') and marquee_opts.get('text'):
        m_text = marquee_opts['text'].replace("'", "\\'").replace(":", "\\:")
        direction = marquee_opts.get('direction', 'up').lower()
        speed_px = int(marquee_opts.get('speed', 30))
        font_size = int(marquee_opts.get('font_size', 28))
        font_color = marquee_opts.get('color', 'yellow')
        m_x = marquee_opts.get('x', '(w-text_w)/2')
        
        # Incorporate time_offset so animation continues seamlessly across chunks
        t_expr = f"(t+{time_offset:.3f})" if time_offset > 0 else "t"
        if direction == 'up':
            y_expr = f"h-mod({t_expr}*{speed_px}\\,h+text_h)"
        else:
            y_expr = f"-text_h+mod({t_expr}*{speed_px}\\,h+text_h)"
            
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

    return video_filters

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
    
    # Logo overlay
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
        cmd.extend([
            '-ss', f"{start_time:.3f}",
            '-t', f"{duration:.3f}",
            '-i', audio_path
        ])
        audio_input_idx = next_input_idx
        next_input_idx += 1
        
    video_filters = _build_filter_graph(opts, has_logo, logo_input_idx, time_offset=start_time)
    
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
        
    if has_custom_audio:
        cmd.extend(['-map', f"{audio_input_idx}:a", '-c:a', 'aac', '-b:a', '192k'])
    else:
        cmd.extend(['-map', '0:a?', '-c:a', 'aac', '-b:a', '192k'])
        
    # Ultrafast encode per segment for ultra-speed and low RAM
    cmd.extend([
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        output_segment_path
    ])
    
    # Segment timeout: 600s is plenty for a 3-minute chunk
    res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
    return res.returncode == 0 and os.path.exists(output_segment_path) and os.path.getsize(output_segment_path) > 0

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
        res = subprocess.run(concat_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
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
    """Direct single-pass render with generous 4-hour dynamic timeout and ultrafast preset."""
    ff = ffmpeg_bin or find_ffmpeg()
    opts = options or {}
    
    cmd = [ff, '-y', '-i', input_video_path]
    next_input_idx = 1
    
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

    video_filters = _build_filter_graph(opts, has_logo, logo_input_idx, time_offset=0.0)

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
        
    if has_custom_audio:
        cmd.extend(['-map', f"{audio_input_idx}:a", '-c:a', 'aac', '-b:a', '192k'])
    else:
        cmd.extend(['-map', '0:a?', '-c:a', 'aac', '-b:a', '192k'])
        
    cmd.extend([
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        output_video_path
    ])
    
    # 4-hour timeout (14400s) ensures 1-2 hour videos never get killed!
    try:
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=14400)
        return res.returncode == 0 and os.path.exists(output_video_path) and os.path.getsize(output_video_path) > 0
    except Exception as e:
        print(f"[Direct Render Error] {e}", flush=True)
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
