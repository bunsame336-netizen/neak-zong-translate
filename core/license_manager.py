# -*- coding: utf-8 -*-
"""
Neak Zong Translate AI - License Key Management System
======================================================
Provides granular license creation, activation, validation and persistence:
- Lifetime (រហូត)
- Seconds, Minutes, Hours
- Days, 1 Week, 1 Month, 1 Year
- Machine / Client Token Binding & Expiry Verification
"""

import os
import json
import secrets
import threading
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple

LOCK = threading.Lock()
BASE_DIR = Path(__file__).resolve().parent.parent
LICENSE_FILE = BASE_DIR / "licenses.json"
CLIENT_STATE_FILE = BASE_DIR / "active_license.json"

DEFAULT_ADMIN_PASSWORD = os.environ.get("ADMIN_LICENSE_SECRET", "neakzong2026")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _format_khmer_remaining(seconds: float) -> str:
    """Formats remaining seconds into intuitive Khmer string."""
    if seconds <= 0:
        return "ផុតកំណត់ (Expired)"
    
    total_secs = int(seconds)
    days = total_secs // 86400
    hours = (total_secs % 86400) // 3600
    minutes = (total_secs % 3600) // 60
    secs = total_secs % 60
    
    parts = []
    if days > 0:
        parts.append(f"{days} ថ្ងៃ")
    if hours > 0:
        parts.append(f"{hours} ម៉ោង")
    if minutes > 0 and days == 0:
        parts.append(f"{minutes} នាទី")
    if secs > 0 and days == 0 and hours == 0:
        parts.append(f"{secs} វិនាទី")
        
    return "នៅសល់ " + (" ".join(parts) if parts else "១ នាទី")


class LicenseManager:
    def __init__(self, filepath: Optional[Path] = None):
        self.filepath = filepath or LICENSE_FILE
        self._ensure_storage()

    def _ensure_storage(self):
        with LOCK:
            if not self.filepath.exists():
                # Initialize with a default Admin Demo Lifetime Key for immediate convenience
                initial_data = {
                    "NEAK-ZONG-2026-VIP": {
                        "key": "NEAK-ZONG-2026-VIP",
                        "type": "lifetime",
                        "lifetime": True,
                        "duration_val": 0,
                        "created_at": _now_utc().isoformat(),
                        "activated_at": None,
                        "expires_at": None,
                        "status": "active",
                        "note": "Default Admin VIP Lifetime Key"
                    }
                }
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump(initial_data, f, ensure_ascii=False, indent=2)

    def load_all(self) -> Dict[str, Any]:
        with LOCK:
            if not self.filepath.exists():
                return {}
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}

    def save_all(self, data: Dict[str, Any]):
        with LOCK:
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    def generate_key_string(self) -> str:
        p1 = secrets.token_hex(2).upper()
        p2 = secrets.token_hex(2).upper()
        return f"NZ-{p1}-{p2}"

    def create_license(
        self,
        duration_type: str = "days",
        duration_val: int = 30,
        note: str = ""
    ) -> Dict[str, Any]:
        """
        duration_type:
          - 'seconds'
          - 'minutes'
          - 'hours'
          - 'days'
          - 'weeks' (7 days)
          - 'months' (30 days)
          - 'years' (365 days)
          - 'lifetime'
        """
        dtype = duration_type.lower().strip()
        val = max(1, int(duration_val))
        
        all_lic = self.load_all()
        key = self.generate_key_string()
        while key in all_lic:
            key = self.generate_key_string()
            
        record = {
            "key": key,
            "type": dtype,
            "lifetime": (dtype == "lifetime"),
            "duration_val": val,
            "created_at": _now_utc().isoformat(),
            "activated_at": None,
            "expires_at": None,
            "device_id": None,
            "status": "active",
            "note": note
        }
        
        all_lic[key] = record
        self.save_all(all_lic)
        return record

    def activate_key(self, key_str: str, device_id: Optional[str] = None) -> Tuple[bool, str, Dict[str, Any]]:
        """Activates a key for client and computes expiration."""
        cleaned_key = (key_str or "").strip().upper()
        if not cleaned_key:
            return False, "សូមបញ្ចូល License Key", {}
            
        all_lic = self.load_all()
        if cleaned_key not in all_lic:
            return False, "License Key មិនត្រឹមត្រូវឡើយ (Invalid Key)", {}
            
        rec = all_lic[cleaned_key]
        if rec.get("status") == "revoked":
            return False, "License Key នេះត្រូវបាន Admin បិទដំណើរការ (Revoked)", {}
            
        now = _now_utc()
        
        # If already activated and has expiry, check if expired
        if rec.get("expires_at"):
            try:
                exp = datetime.fromisoformat(rec["expires_at"])
                if now > exp:
                    rec["status"] = "expired"
                    self.save_all(all_lic)
                    return False, "License Key នេះបានផុតកំណត់ហើយ (Expired)", rec
            except Exception:
                pass
                
        # First-time activation: compute expires_at
        if not rec.get("activated_at"):
            rec["activated_at"] = now.isoformat()
            dtype = rec.get("type", "days")
            val = rec.get("duration_val", 30)
            
            if dtype == "lifetime":
                rec["expires_at"] = None
            elif dtype == "seconds":
                rec["expires_at"] = (now + timedelta(seconds=val)).isoformat()
            elif dtype == "minutes":
                rec["expires_at"] = (now + timedelta(minutes=val)).isoformat()
            elif dtype == "hours":
                rec["expires_at"] = (now + timedelta(hours=val)).isoformat()
            elif dtype == "days":
                rec["expires_at"] = (now + timedelta(days=val)).isoformat()
            elif dtype == "weeks":
                rec["expires_at"] = (now + timedelta(days=val * 7)).isoformat()
            elif dtype == "months":
                rec["expires_at"] = (now + timedelta(days=val * 30)).isoformat()
            elif dtype == "years":
                rec["expires_at"] = (now + timedelta(days=val * 365)).isoformat()
            else:
                rec["expires_at"] = (now + timedelta(days=val)).isoformat()

        if device_id:
            rec["device_id"] = device_id
            
        rec["status"] = "active"
        all_lic[cleaned_key] = rec
        self.save_all(all_lic)
        
        # Save locally as current active client license
        self.save_client_active_license(rec)
        return True, "Activate License ជោគជ័យ ១០០%!", rec

    def save_client_active_license(self, record: Dict[str, Any]):
        try:
            with open(CLIENT_STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(record, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def get_client_active_license(self) -> Optional[Dict[str, Any]]:
        if not CLIENT_STATE_FILE.exists():
            return None
        try:
            with open(CLIENT_STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def verify_license_validity(self, key_str: Optional[str] = None) -> Tuple[bool, str, Dict[str, Any]]:
        """Verifies if key or client active license is currently valid."""
        rec = None
        all_lic = self.load_all()
        
        if key_str:
            cleaned = key_str.strip().upper()
            rec = all_lic.get(cleaned)
        else:
            rec = self.get_client_active_license()
            if rec and rec.get("key"):
                # Always fetch fresh copy from all_lic if available
                rec = all_lic.get(rec["key"], rec)
                
        if not rec:
            return False, "មិនទាន់មាន License Key នៅឡើយទេ", {}
            
        if rec.get("status") == "revoked":
            return False, "License Key ត្រូវបាន Admin បិទ (Revoked)", rec
            
        if rec.get("lifetime"):
            return True, "សកម្មមួយជីវិត (Lifetime Access)", {
                **rec,
                "is_valid": True,
                "remaining_text": "មួយជីវិត (Lifetime)",
                "remaining_seconds": 999999999
            }
            
        expires_at_str = rec.get("expires_at")
        if not expires_at_str:
            # Activated but no expires_at? If not activated yet, still valid pending first activation
            if not rec.get("activated_at"):
                return True, "Key នៅសកម្ម ត្រៀមប្រើប្រាស់", {
                    **rec,
                    "is_valid": True,
                    "remaining_text": f"សុពលភាព {rec.get('duration_val')} {rec.get('type')}",
                    "remaining_seconds": 86400
                }
            return False, "License មិនត្រឹមត្រូវ", rec
            
        try:
            now = _now_utc()
            exp = datetime.fromisoformat(expires_at_str)
            diff = (exp - now).total_seconds()
            if diff <= 0:
                rec["status"] = "expired"
                if rec.get("key") in all_lic:
                    all_lic[rec["key"]]["status"] = "expired"
                    self.save_all(all_lic)
                return False, "License Key បានផុតកំណត់ហើយ (Expired)", {
                    **rec,
                    "is_valid": False,
                    "remaining_text": "ផុតកំណត់ (Expired)",
                    "remaining_seconds": 0
                }
                
            rem_text = _format_khmer_remaining(diff)
            return True, f"License សកម្ម ({rem_text})", {
                **rec,
                "is_valid": True,
                "remaining_text": rem_text,
                "remaining_seconds": diff
            }
        except Exception as e:
            return False, f"កំហុសក្នុងការផ្ទៀងផ្ទាត់: {e}", rec

    def revoke_license(self, key_str: str) -> bool:
        all_lic = self.load_all()
        cleaned = key_str.strip().upper()
        if cleaned in all_lic:
            all_lic[cleaned]["status"] = "revoked"
            self.save_all(all_lic)
            return True
        return False

    def delete_license(self, key_str: str) -> bool:
        all_lic = self.load_all()
        cleaned = key_str.strip().upper()
        if cleaned in all_lic:
            del all_lic[cleaned]
            self.save_all(all_lic)
            return True
        return False


# Singleton instance
license_mgr = LicenseManager()
