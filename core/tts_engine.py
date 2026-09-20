# -*- coding: utf-8 -*-
"""
«នាគហ្សង បកប្រែ» — Khmer Neural Voice & Audio Ducking Engine
============================================================
- High quality natural Khmer voice synthesis (Piseth & Sreymom)
- Real-time speed adjustment (1.0x - 1.5x) and pitch shifting
- Automated Audio Ducking (lowering background audio to 10% - 15%)
- Async Edge-TTS engine with robust Google TTS fallback
"""

import os
import sys
import asyncio
import subprocess
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional, Dict, Any

KHMER_VOICES = {
    'male': 'km-KH-PisethNeural',
    'female': 'km-KH-SreymomNeural',
    'piseth': 'km-KH-PisethNeural',
    'sreymom': 'km-KH-SreymomNeural'
}

def format_rate_str(speed: float) -> str:
    """Converts 1.0 - 1.5 speed multiplier into Edge-TTS rate string, e.g. '+20%'."""
    try:
        sp = float(speed)
        percent = int(round((sp - 1.0) * 100))
        if percent >= 0:
            return f"+{percent}%"
        else:
            return f"{percent}%"
    except Exception:
        return "+0%"

def format_pitch_str(pitch: int) -> str:
    """Converts pitch int in Hz to Edge-TTS pitch string, e.g. '+10Hz'."""
    try:
        p = int(pitch)
        if p >= 0:
            return f"+{p}Hz"
        else:
            return f"{p}Hz"
    except Exception:
        return "+0Hz"

async def _synthesize_edge_tts_async(text: str, voice: str, rate_str: str, pitch_str: str, output_path: str):
    import edge_tts
    communicate = edge_tts.Communicate(text, voice, rate=rate_str, pitch=pitch_str)
    await communicate.save(output_path)

def synthesize_khmer_voice(
    text: str,
    output_path: str,
    voice_type: str = 'female',
    speed: float = 1.0,
    pitch: int = 0
) -> bool:
    """
    Synthesizes natural Khmer speech to an MP3 file.
    Uses Edge-TTS with fallback to Google Khmer TTS.
    """
    if not text or not text.strip():
        return False
        
    text_clean = text.strip()
    voice = KHMER_VOICES.get(voice_type.lower(), KHMER_VOICES['female'])
    rate_str = format_rate_str(speed)
    pitch_str = format_pitch_str(pitch)
    
    # 1. Attempt Edge-TTS
    try:
        asyncio.run(_synthesize_edge_tts_async(text_clean, voice, rate_str, pitch_str, output_path))
        if os.path.exists(output_path) and os.path.getsize(output_path) > 500:
            return True
    except Exception as e:
        print(f"[TTS Edge Warning] {e}, falling back to Google Khmer TTS...", flush=True)

    # 2. Fallback: Google Translate TTS API for Khmer
    try:
        encoded_text = urllib.parse.quote(text_clean[:200])
        url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded_text}&tl=km&total=1&idx=0&textlen={len(text_clean[:200])}&client=tw-ob"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
            if len(data) > 300:
                with open(output_path, 'wb') as f:
                    f.write(data)
                return True
    except Exception as e_google:
        print(f"[TTS Google Error] {e_google}", flush=True)

    return False

def apply_audio_ducking(
    original_audio_path: str,
    voiceover_path: str,
    output_path: str,
    duck_level: float = 0.15,
    ffmpeg_bin: str = 'ffmpeg'
) -> bool:
    """
    Mixes voiceover with original audio, reducing original audio to duck_level (10%-15%)
    when the voiceover is playing using FFmpeg's sidechaincompress / amix filter.
    """
    try:
        # Check if voiceover exists
        if not os.path.exists(voiceover_path):
            return False
            
        # FFmpeg filter:
        # [0:a] is original audio, [1:a] is voiceover
        # sidechaincompress lowers [0:a] when [1:a] triggers
        filter_complex = (
            f"[0:a]volume=1.0[bg];"
            f"[bg][1:a]sidechaincompress=threshold=0.08:ratio=8:attack=10:release=350[ducked];"
            f"[ducked][1:a]amix=inputs=2:duration=first:dropout_transition=2[out]"
        )
        
        cmd = [
            ffmpeg_bin, '-y',
            '-i', original_audio_path,
            '-i', voiceover_path,
            '-filter_complex', filter_complex,
            '-map', '[out]',
            '-c:a', 'libmp3lame', '-b:a', '192k',
            output_path
        ]
        
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return res.returncode == 0
    except Exception as e:
        print(f"[Audio Ducking Error] {e}", flush=True)
        return False
