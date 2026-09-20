# -*- coding: utf-8 -*-
"""
«នាគហ្សង បកប្រែ» — Vocal & Music Separation Engine
===================================================
- Separates original dialogue vocals from background music (BGM).
- Uses center-channel phase cancellation & high-performance acoustic filters.
"""

import os
import subprocess

def separate_vocals_and_bgm(input_audio_path: str, output_bgm_path: str, ffmpeg_bin: str = 'ffmpeg') -> bool:
    """
    Removes center-panned dialogue vocals from stereo audio to isolate BGM and sound effects.
    Uses FFmpeg pan and aeval filters for low latency, zero memory overhead.
    """
    try:
        # Standard OOPS (Out-Of-Phase Stereo) filter with bandpass restoration for BGM
        # Removes voice frequencies centered in stereo while keeping stereo music & instruments
        filter_str = (
            "stereotools=mlev=0:slev=1.2:sbal=0:mpan=0,"
            "equalizer=f=300:t=q:w=1.5:g=-16,"
            "equalizer=f=1200:t=q:w=2.0:g=-18,"
            "equalizer=f=3000:t=q:w=1.8:g=-14,"
            "volume=1.4"
        )
        
        cmd = [
            ffmpeg_bin, '-y',
            '-i', input_audio_path,
            '-af', filter_str,
            '-c:a', 'libmp3lame', '-b:a', '192k',
            output_bgm_path
        ]
        
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return res.returncode == 0 and os.path.exists(output_bgm_path)
    except Exception as e:
        print(f"[Vocal Separation Error] {e}", flush=True)
        return False
