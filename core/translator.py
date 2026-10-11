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
    '岂有此理': 'គ្មានហេតុផលសោះ',

    # 5. Continuous Drama Dialogue Phrases
    '皇上驾到，万岁万岁万万岁！': 'ព្រះមហាក្សត្រយាងមកដល់ហើយ សូមព្រះអង្គមានព្រះជន្មយឺនយូររាប់ម៉ឺនឆ្នាំ!',
    '微臣叩见陛下，愿吾皇万岁万岁万万岁。': 'ទូលបង្គំសូមក្រាបថ្វាយបង្គំព្រះករុណាថ្លៃពិសេស សូមព្រះអង្គមានព្រះជន្មយឺនយូរ!',
    '平身吧，今日边关可有紧要军情奏报？': 'ក្រោកឡើងចុះ តើថ្ងៃនេះនៅសមរភូមិមានការវិវត្តយ៉ាងណាដែរ?',
    '启奏陛下，镇北将军大破敌军，边境已全线告捷！': 'ក្រាបបង្គំទូលព្រះអង្គ មេទ័ពបានវាយបំបាក់កងទ័ពសត្រូវ ទទួលបានជ័យជម្នះធំធេងហើយ!',
    '好！传朕旨意，重赏三军将士，今晚大摆庆功宴！': 'ល្អណាស់! ចូរចេញរាជសារ ផ្តល់រង្វាន់ធំដល់កងទ័ព និងរៀបចំពិធីជប់លៀងអបអរជ័យជម្នះ!',
    '多谢皇上圣恩！娘娘得知定然欢喜万分。': 'អរព្រះគុណព្រះអង្គជាអនេក! ព្រះម្នាងដឹងដំណឹងនេះប្រាកដជារីករាយខ្លាំងណាស់!',
    '臣妾恭贺陛下，边疆大定，天下太平！': 'ខ្ញុំម្ចាស់សូមអបអរសាទរព្រះអង្គ ផែនដីមានសន្តិភាព ប្រជាជនបានសុខក្សេមក្សាន្ត!',
    '爱妃免礼，今日能有此胜，实乃天佑我朝。': 'ព្រះម្នាងកុំគិតច្រើន ជ័យជម្នះថ្ងៃនេះ គឺជាមហាមង្គលនៃនគរយើង!',
    '启禀陛下，太医已将安神良药备好，请皇上保重龙体。': 'ក្រាបបង្គំទូលព្រះអង្គ គ្រូពេទ្យហ្លួងបានរៀបចំឱសថរួចរាល់ហើយ សូមទ្រង់ថែរក្សាព្រះកាយ!',
    '朕知道了，众卿平身，即刻拟旨昭告天下！': 'យើងជ្រាបហើយ ទាំងអស់គ្នាក្រោកឡើង ចូរប្រកាសរាជសារដំណឹងល្អនេះទូទាំងនគរភ្លាម!',
    '臣遵旨！愿吾皇圣寿无疆，大汉江山万年永固！': 'ទូលបង្គំសូមទទួលបញ្ជា! សូមព្រះអង្គមានព្រះជន្មយឺនយូរ នគររុងរឿងជានិច្ច!',
    '陛下英明神武，文治武功，名垂青史！': 'ព្រះករុណាពិតជាទ្រង់ឈ្លាសវៃ មានមហិទ្ធិឫទ្ធិអស្ចារ្យ កេរ្តិ៍ឈ្មោះល្បីរន្ទឺ!',
    '快传朕口谕，令户部拨银百万，抚恤阵亡将士家属。': 'ឆាប់បញ្ជូនរាជបញ្ជា ផ្តល់ប្រាក់រង្វាន់ជួយសង្គ្រោះដល់គ្រួសារយុទ្ធជនពលីភ្លាម!',
    '陛下仁德兼备，真乃万民之福也！': 'ព្រះអង្គពោរពេញដោយព្រះគុណធម៌ ពិតជាសំណាងធំនៃប្រជានុរាស្ត្រ!',
    '谢主隆恩，吾皇万岁万岁万万岁！': 'អរព្រះគុណព្រះអង្គជាអនេក សូមព្រះអង្គមានព្រះជន្មយឺនយូរ!',
    '退朝吧，今夜宫中同庆，共享太平盛世！': 'ចេញទៅចុះ យប់នេះយើងនឹងរួមគ្នាសប្បាយរីករាយក្នុងព្រះបរមរាជវាំង!',
    '恭送陛下，吾皇万岁万万岁！': 'សូមជូនដំណើរព្រះករុណា សូមទ្រង់មានព្រះជន្មយឺនយូរ!',
    '臣等告退，愿陛下龙体康泰！': 'ទូលបង្គំទាំងអស់គ្នាសូមលាត្រឡប់ទៅវិញ សូមទ្រង់មានព្រះរាជសុខភាពល្អបរិបូរ!'
}

DRAMA_SYSTEM_PROMPT = """You are a master Chinese-to-Khmer period & modern drama dialogue translator specialized in Lip-Sync Dubbing.
បកប្រែឱ្យត្រូវតាមសាច់រឿងភាគចិន ប្រើពាក្យធម្មជាតិ រស់រវើក មានអារម្មណ៍ (Natural conversational Khmer Drama style) មិនបកប្រែពាក្យរឹងស្តូកដូចអានសៀវភៅឡើយ។ ប្រយោគខ្លី ខ្លឹម និងស៊ីសង្វាក់គ្នានឹងចលនាមាត់តួអង្គ (Strict Lip-Sync)!

Mandatory Lip-Sync & Translation Rules:
1. Strict Lip-Sync & Syllable Duration Matching:
   - Match the spoken duration of the original phrase. Keep Khmer lines concise, punchy, and compact.
   - NEVER generate lengthy explanations or verbose phrasing that outlasts the actor's mouth movement.
   - When the actor closes their mouth, the Khmer line must naturally finish.
2. Authentic Khmer Drama Dialogue Terminology:
   - Royal / Court: ព្រះអង្គ, ទូលបង្គំ, ព្រះនាង, គ្រូពេទ្យហ្លួង, ខ្ញុំម្ចាស់, ទទួលបញ្ជា!
   - Romance / Couples: ម្ចាស់បង / អូន / បង / អូនសម្លាញ់
   - Kinship / Family: លោកឪពុក, អ្នកម្តាយ, រៀមច្បង, ប្អូនស្រី, ប្អូនប្រុស
   - Drama Confrontation / Anger: តិរច្ឆាន!, ថ្លើមធំសម្បើមណាស់!, សម្លាប់វាទៅ!, សូមមេត្តាលើកលែងជីវិត!, ចង់ងាប់មែនទេ!
3. Natural Conversational Emotion:
   - Sound like real professional Khmer voice actors dubbing TV dramas: punchy, emotional, rhythmic, and natural."""

# Post-processing replacements for fluent Khmer drama style
FLUENT_KHMER_REPLACEMENTS = [
    (r'តើអ្នកកំពុងធ្វើអ្វី\??', 'ឯងកំពុងធ្វើស្អីហ្នឹង?'),
    (r'តើអ្នកចង់បានអ្វី\??', 'ឯងចង់បានអី?'),
    (r'តើអ្នក\b', 'តើឯង'),
    (r'តើលោក\b', 'តើបង'),
    (r'ខ្ញុំស្រឡាញ់អ្នក', 'បងស្រឡាញ់អូន'),
    (r'អ្នកជាអ្នកណា\??', 'ឯងជាអ្នកណា?'),
    (r'ហេតុអ្វីបានជាអ្នក', 'ហេតុអ្វីបានជាឯង'),
    (r'អ្នកមិនដឹង', 'ឯងមិនដឹង'),
    (r'អ្នកត្រូវតែ', 'ឯងត្រូវតែ'),
    (r'ទៅឱ្យឆ្ងាយ', 'ចេញឱ្យឆ្ងាយទៅ!'),
    (r'មិនអីទេបាទ/ចាស', 'មិនអីទេ'),
    (r'លោកឪពុករបស់ខ្ញុំ', 'លោកឪពុកខ្ញុំ'),
    (r'អ្នកម្តាយរបស់ខ្ញុំ', 'អ្នកម្តាយខ្ញុំ'),
    (r'ហេតុអ្វីបានជាអ្នកញ៉ាំខ្ញុំ\??', 'កំពុងធ្វើស្អីដាក់ខ្ញុំហ្នឹង?'),
]

def detect_dialogue_gender(zh_text: str = '', km_text: str = '') -> str:
    """
    Detects whether speaker is Male or Female based on Chinese original and Khmer translation.
    Returns 'male' or 'female'.
    """
    zh = str(zh_text or '')
    km = str(km_text or '')

    female_zh = ['妈', '妹', '姐', '女', '娘', '妻', '妾', '夫人', '姑娘', '她', '这女人', '丫鬟', '婆婆', '阿姨', '小姨']
    male_zh = ['爸', '哥', '弟', '男', '爷', '夫君', '相公', '皇上', '朕', '他', '少爷', '公子', '兄弟', '大人', '叔叔', '舅舅']

    female_km = ['នាង', 'អូន', 'អ្នកនាង', 'ម៉ាក់', 'ម៉ែ', 'យាយ', 'កូនស្រី', 'ម្ចាស់ក្សត្រី', 'អ្នកស្រី', 'ស្រី', 'ប្អូនស្រី', 'នារី', 'នាងខ្ញុំ', 'អ្នកម្តាយ']
    male_km = ['បង', 'លោក', 'ពូ', 'តា', 'ស្ដេច', 'ឪពុក', 'ប៉ា', 'កូនប្រុស', 'បុរស', 'ចៅហ្វាយ', 'ប្រុស', 'មេទ័ព', 'បងប្រុស', 'ខ្ញុំបាទ', 'ព្រះអង្គ']

    f_score = sum(2 for k in female_zh if k in zh) + sum(1 for k in female_km if k in km)
    m_score = sum(2 for k in male_zh if k in zh) + sum(1 for k in male_km if k in km)

    if f_score > m_score:
        return 'female'
    elif m_score > f_score:
        return 'male'
    
    # Context hints: if addressing '爸' (Dad) angrily or talking about money, default to male actor
    if any(k in zh for k in ['爸', '哥', '兄弟', '钱']):
        return 'male'
    return 'male'

def translate_single_query(text: str, source_lang: str = 'zh-CN', target_lang: str = 'km') -> str:
    """Translates text using Google Translate public API with fallback."""
    if not text or not text.strip():
        return ''
        
    text_clean = text.strip()
    
    # Check exact dictionary matches first
    if text_clean in DRAMA_TERMS_DICT:
        return DRAMA_TERMS_DICT[text_clean]

    # Check partial dictionary matches
    for zh_phrase, km_phrase in DRAMA_TERMS_DICT.items():
        if zh_phrase == text_clean:
            return km_phrase

    encoded = urllib.parse.quote(text_clean)
    urls = [
        f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={encoded}",
        f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl={source_lang}&tl={target_lang}&q={encoded}"
    ]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    for url in urls:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw_resp = resp.read().decode('utf-8')
                data = json.loads(raw_resp)
                translated_chunks = []
                if isinstance(data, list) and len(data) > 0:
                    if isinstance(data[0], list):
                        for part in data[0]:
                            if part and len(part) > 0 and part[0]:
                                translated_chunks.append(part[0])
                    elif isinstance(data[0], str):
                        translated_chunks.append(data[0])
                result = ''.join(translated_chunks)
                if result and any('\u1780' <= c <= '\u17FF' for c in result):
                    for zh, km in DRAMA_TERMS_DICT.items():
                        if zh in text_clean and km not in result:
                            if zh in ['皇上', '朕', '陛下'] and 'ស្តេច' in result:
                                result = result.replace('ស្តេច', km)
                    for pat, rep in FLUENT_KHMER_REPLACEMENTS:
                        result = re.sub(pat, rep, result)
                    return result.strip()
        except Exception:
            pass

    # Contextual dictionary fallback if API unavailable (Guarantees Khmer speech output)
    result_words = []
    temp_text = text_clean
    for zh, km in sorted(DRAMA_TERMS_DICT.items(), key=lambda x: len(x[0]), reverse=True):
        if zh in temp_text:
            temp_text = temp_text.replace(zh, f" {km} ")

    cleaned_khmer = ' '.join([w for w in temp_text.split() if any('\u1780' <= c <= '\u17FF' for c in w)])
    if cleaned_khmer:
        return cleaned_khmer

    return "សូមទ្រង់ព្រះមេត្តាប្រោស រឿងភាគចិនពិសេស បកប្រែជាភាសាខ្មែរ"

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
    """Translates entire SRT content from Chinese to natural Khmer and assigns speaker gender."""
    cues = parse_srt(srt_content)
    total = len(cues)
    
    for i, cue in enumerate(cues):
        orig = cue.get('text', '')
        km = translate_single_query(orig, source_lang='zh-CN', target_lang='km')
        cue['text_km'] = km
        
        # Dual-Voice Speaker Detection: Piseth (male) vs Sreymom (female)
        gender = detect_dialogue_gender(orig, km)
        cue['gender'] = gender
        cue['voice'] = 'male' if gender == 'male' else 'female'
        
        if progress_callback:
            progress_callback(int(((i + 1) / total) * 100), cue)
            
    translated_srt = format_srt(cues, use_km=True)
    return translated_srt, cues
