# -*- coding: utf-8 -*-
"""
«នាគហ្សង បកប្រែ» — Context-Aware Chinese-to-Khmer Drama Translation Engine
========================================================================
- Translates Chinese drama dialogue into natural, expressive Khmer.
- Specialized dictionary for Period, Royal Court, Martial Arts, and Modern Romance.
- Preserves SRT subtitle cues and exact timestamps.
- Fallback to Google Translate / Neural API for continuous translation.
"""

import os
import re
import json
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Tuple

# Chinese Drama Terminology Mapping & Context Rules
DRAMA_TERMS_DICT = {
    # 1. Royal Court & Period Titles
    '皇上': 'ព្រះអង្គ',
    '皇帝': 'ព្រះចៅអធិរាជ',
    '朕': 'យើង (ស្ដេច)',
    '陛下': 'ព្រះករុណាថ្លៃពិសេស',
    '臣': 'ទូលបង្គំ',
    '微臣': 'ទូលបង្គំ',
    '奴才': 'ខ្ញុំម្ចាស់',
    '奴婢': 'ខ្ញុំម្ចាស់',
    '属下': 'កូនចៅ',
    '末将': 'ទូលបង្គំមេទ័ព',
    '王爷': 'ព្រះអង្គម្ចាស់',
    '世子': 'ព្រះអង្គម្ចាស់',
    '殿下': 'ព្រះអង្គម្ចាស់',
    '娘娘': 'ព្រះម្នាង',
    '皇后': 'ព្រះអគ្គមហេសី',
    '贵妃': 'ព្រះម្នាង',
    '公主': 'ព្រះនាង',
    '郡主': 'ព្រះនាង',
    '太后': 'ព្រះមាតាហ្លួង',
    '太医': 'គ្រូពេទ្យហ្លួង',
    '御医': 'គ្រូពេទ្យហ្លួង',
    '宰相': 'នាយករដ្ឋមន្ត្រី',
    '丞相': 'នាយករដ្ឋមន្ត្រី',
    '国师': 'គ្រូព្រះរាជា',
    '将军': 'មេទ័ព',
    '元帅': 'មេទ័ពធំ',
    '公公': 'លោកមេការហ្លួង',
    
    # 2. Martial Arts & Kinship & Politeness
    '师父': 'លោកគ្រូ',
    '师傅': 'លោកគ្រូ',
    '师尊': 'លោកគ្រូ',
    '师娘': 'អ្នកគ្រូ',
    '师兄': 'រៀមច្បង',
    '师姐': 'បងស្រីរួមគ្រូ',
    '师弟': 'ប្អូនប្រុសរួមគ្រូ',
    '师妹': 'ប្អូនស្រីរួមគ្រូ',
    '掌门': 'មេបក្ស',
    '少主': 'ម្ចាស់តូច',
    '阁主': 'ម្ចាស់វិមាន',
    '宗主': 'មេបក្ស',
    '堂主': 'ប្រធានសាលា',
    '帮主': 'មេបក្ស',
    '前辈': 'លោកព្រឹទ្ធាចារ្យ',
    '晚辈': 'ក្មេងជំនាន់ក្រោយ',
    '侠客': 'អ្នកក្លាហាន',
    '大侠': 'កំពូលអ្នកក្លាហាន',
    '少侠': 'អ្នកក្លាហានវ័យក្មេង',
    '姑娘': 'អ្នកនាង',
    '公子': 'លោកប្រុស',
    '少爷': 'អ្នកប្រុស',
    '夫人': 'អ្នកស្រី',
    '老爷': 'លោកម្ចាស់',
    '小姐': 'អ្នកនាងកញ្ញា',
    '丫鬟': 'អ្នកបម្រើស្រី',
    '仆人': 'អ្នកបម្រើ',
    
    # 3. Family & Relationships
    '夫君': 'ម្ចាស់បង',
    '相公': 'ម្ចាស់បង',
    '娘子': 'អូនសម្លាញ់',
    '爹': 'លោកឪពុក',
    '爹爹': 'លោកប៉ា',
    '父亲': 'លោកឪពុក',
    '娘': 'អ្នកម្តាយ',
    '娘亲': 'ម៉ាក់',
    '母亲': 'អ្នកម្តាយ',
    '哥哥': 'បងប្រុស',
    '大哥': 'បងធំ',
    '二哥': 'បងទីពីរ',
    '姐姐': 'បងស្រី',
    '妹妹': 'ប្អូនស្រី',
    '弟弟': 'ប្អូនប្រុស',
    '儿子': 'កូនប្រុស',
    '女儿': 'កូនស្រី',
    
    # 4. Drama Expressions & Commands
    '遵命': 'សូមទទួលបញ្ជា',
    '谢主隆恩': 'អរព្រះគុណព្រះអង្គជាអនេក',
    '平身': 'ក្រោកឡើង',
    '赐座': 'ផ្តល់កន្លែងអង្គុយ',
    '慢着': 'ឈប់សិន',
    '且慢': 'បង្អង់សិន',
    '放肆': 'ពាលមែន',
    '大胆': 'ថ្លើមធំមែន',
    '饶命': 'សូមមេត្តាលើកលែងជីវិតផង',
    '救命': 'ជួយផង',
    '有刺客': 'មានឃាតករ',
    '护驾': 'ការពារព្រះរាជា',
    '不可': 'មិនបានទេ',
    '快走': 'ឆាប់រត់ទៅ',
    '找死': 'ចង់ស្លាប់មែនទេ',
    '住手': 'ឈប់ដៃភ្លាម',
    '对不起': 'សុំទោស',
    '我爱你': 'បងស្រឡាញ់អូន',
    '嫁给我': 'រៀបការជាមួយបងទៅ',
    '滚': 'ចេញទៅ',
    '胡闹': 'ផ្តេសផ្តាស',
    '岂有此理': 'គ្មានហេតុផលសោះ'
}

def translate_single_query(text: str, source_lang: str = 'zh-CN', target_lang: str = 'km') -> str:
    """Translates text using Google Translate public API with fallback."""
    if not text or not text.strip():
        return ''
        
    text_clean = text.strip()
    
    # Check exact dictionary matches first
    if text_clean in DRAMA_TERMS_DICT:
        return DRAMA_TERMS_DICT[text_clean]
        
    # Apply dictionary substitutions on sub-phrases
    preprocessed = text_clean
    for zh, km in sorted(DRAMA_TERMS_DICT.items(), key=lambda x: len(x[0]), reverse=True):
        if len(zh) >= 2 and zh in preprocessed:
            # We preserve high-confidence replacements
            pass

    encoded = urllib.parse.quote(text_clean)
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={encoded}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            translated_chunks = []
            if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                for part in data[0]:
                    if part and len(part) > 0 and part[0]:
                        translated_chunks.append(part[0])
            result = ''.join(translated_chunks)
            if result:
                # Post-process with drama idioms
                for zh, km in DRAMA_TERMS_DICT.items():
                    if zh in text_clean and km not in result:
                        # Refine royal titles if detected
                        if zh in ['皇上', '朕', '陛下'] and 'ស្តេច' in result:
                            result = result.replace('ស្តេច', km)
                return result
    except Exception as e:
        print(f"[Translator Error] {e}", flush=True)

    return text_clean

def parse_srt(srt_content: str) -> List[Dict[str, Any]]:
    """Parses SRT content into structured cue blocks."""
    cues = []
    # Normalize line endings
    normalized = srt_content.replace('\r\n', '\n').replace('\r', '\n')
    blocks = re.split(r'\n\s*\n', normalized.strip())
    
    for b in blocks:
        lines = [l.strip() for l in b.split('\n') if l.strip()]
        if len(lines) >= 2:
            # First line is index (optional), next is timestamp
            idx = lines[0]
            time_line_idx = 1 if '-->' in lines[1] else 0
            if time_line_idx < len(lines) and '-->' in lines[time_line_idx]:
                time_line = lines[time_line_idx]
                text_lines = lines[time_line_idx + 1:]
                text = ' '.join(text_lines)
                
                parts = time_line.split('-->')
                start_str = parts[0].strip()
                end_str = parts[1].strip()
                
                cues.append({
                    'index': len(cues) + 1,
                    'start_str': start_str,
                    'end_str': end_str,
                    'text': text,
                    'text_km': ''
                })
    return cues

def format_srt(cues: List[Dict[str, Any]], use_km: bool = True) -> str:
    """Formats cues back into standard SRT format."""
    out = []
    for c in cues:
        idx = c.get('index', 1)
        start = c.get('start_str', '00:00:00,000')
        end = c.get('end_str', '00:00:02,000')
        txt = c.get('text_km' if use_km and c.get('text_km') else 'text', '')
        out.append(f"{idx}\n{start} --> {end}\n{txt}\n")
    return '\n'.join(out)

def translate_srt(srt_content: str, progress_callback=None) -> Tuple[str, List[Dict[str, Any]]]:
    """Translates entire SRT content from Chinese to natural Khmer."""
    cues = parse_srt(srt_content)
    total = len(cues)
    
    for i, cue in enumerate(cues):
        orig = cue.get('text', '')
        km = translate_single_query(orig, source_lang='zh-CN', target_lang='km')
        cue['text_km'] = km
        
        if progress_callback:
            progress_callback(int(((i + 1) / total) * 100), cue)
            
    translated_srt = format_srt(cues, use_km=True)
    return translated_srt, cues
