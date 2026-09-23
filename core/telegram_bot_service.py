# -*- coding: utf-8 -*-
"""
Telegram Bot Service for «នាគហ្សង បកប្រែ» (Neak Zong Translate AI)
================================================================
- 24/7 Cloud Support on Render.com & VPS
- Dual Mode: Fast Webhook (/api/telegram-webhook) + Auto-Fallback Background Polling
- Safe Resource Management: Concurrency Semaphore (1) to protect mobile tool performance
- Granular License Integration: Generates valid NZ-XXXX-XXXX keys on Admin Approval
- Store Management: Orders, Payment Slips, Duration Tuning, and Product Delivery
"""

import os
import sys
import json
import html
import time
import secrets
import logging
import asyncio
import threading
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger("telegram_bot_service")
logger.setLevel(logging.INFO)

# Telegram Bot Imports
try:
    from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.ext import (
        Application,
        ApplicationBuilder,
        CommandHandler,
        CallbackQueryHandler,
        MessageHandler,
        ContextTypes,
        filters
    )
    HAS_TELEGRAM = True
except ImportError:
    HAS_TELEGRAM = False
    logger.warning("python-telegram-bot library not installed yet.")

BASE_DIR = Path(__file__).resolve().parent.parent
ORDERS_FILE = BASE_DIR / "orders.json"
TOOLS_DIR = BASE_DIR / "tools"
TOOLS_DIR.mkdir(parents=True, exist_ok=True)

# ----------------- CONFIGURATION -----------------
BOT_TOKEN = os.environ.get("BOT_TOKEN", "8988340001:AAFmFVqdRmPeO6hGtEi5KthPBhwLMFJPRJg")
ADMIN_ID = int(os.environ.get("ADMIN_ID", "6261369112"))  # Admin Telegram ID (@KH_Admin168)
BOT_USERNAME = "dramatool_pro_bot"

# Safe Resource Semaphore: Only 1 heavy bot background job runs at a time
BOT_RESOURCE_SEMAPHORE = threading.Semaphore(1)

# Available Products
PRODUCTS = {
    "tool_drama": {
        "name": "🎬 Tool កាត់តសម្រាយរឿង Pro («នាគហ្សង បកប្រែ»)",
        "price": "$15.00 (5,000៛ Demo)",
        "desc": "ឧបករណ៍កាត់ត បាំងអក្សរចិន បកប្រែ និងបញ្ចូលសំឡេង AI ស្វ័យប្រវត្តិ Lip-Sync 100%។",
        "qr_image": str(BASE_DIR / "qr_drama.png"),
        "file_path": str(TOOLS_DIR / "DramaTool_Pro.zip")
    },
    "tool_downloader": {
        "name": "📥 Drama Video Downloader",
        "price": "$10.00",
        "desc": "ឧបករណ៍ទាញយកវីដេអូរឿងភាគខ្លីពី YouTube, Douyin, TikTok 1080p។",
        "qr_image": str(BASE_DIR / "qr_downloader.png"),
        "file_path": str(TOOLS_DIR / "DramaTool_Pro.zip")
    }
}


def load_orders() -> Dict[str, Any]:
    if not ORDERS_FILE.exists():
        return {}
    try:
        with open(ORDERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_orders(data: Dict[str, Any]):
    try:
        with open(ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving orders: {e}")


def parse_duration_string(text: str):
    import re
    text = text.lower().strip()
    days, hours, minutes, seconds = 0, 0, 0, 0

    d_match = re.search(r'(\d+)\s*d', text)
    h_match = re.search(r'(\d+)\s*h', text)
    m_match = re.search(r'(\d+)\s*m', text)
    s_match = re.search(r'(\d+)\s*s', text)

    matched = False
    if d_match:
        days = int(d_match.group(1))
        matched = True
    if h_match:
        hours = int(h_match.group(1))
        matched = True
    if m_match:
        minutes = int(m_match.group(1))
        matched = True
    if s_match:
        seconds = int(s_match.group(1))
        matched = True

    if not matched and text.isdigit():
        hours = int(text)

    return days, hours, minutes, seconds


def get_pending_admin_keyboard(order_id: str):
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("⏳ ១ ថ្ងៃ (តេស្ត)", callback_data=f"tune_{order_id}_1d"),
            InlineKeyboardButton("🗓️ ១ ខែ (30 ថ្ងៃ)", callback_data=f"tune_{order_id}_30d")
        ],
        [
            InlineKeyboardButton("📦 ៦ ខែ (180 ថ្ងៃ)", callback_data=f"tune_{order_id}_180d"),
            InlineKeyboardButton("⭐ ១ ឆ្នាំ (365 ថ្ងៃ)", callback_data=f"tune_{order_id}_365d")
        ],
        [
            InlineKeyboardButton("⚙️ កំណត់ម៉ោងផ្ទាល់ខ្លួន (Custom)", callback_data=f"tune_{order_id}_custom"),
            InlineKeyboardButton("♾️ Lifetime (រហូត)", callback_data=f"appr_{order_id}_lifetime")
        ],
        [
            InlineKeyboardButton("❌ បដិសេធ (Reject)", callback_data=f"rejt_{order_id}")
        ]
    ])


class TelegramBotService:
    def __init__(self):
        self.app: Optional[Application] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self.is_running = False
        self.mode = "stopped"  # "webhook" or "polling"
        self.webhook_url = ""
        self.start_time = 0
        self.last_update_time = 0
        self.updates_processed = 0

    def start(self, webhook_base_url: str = ""):
        """Starts the Telegram Bot in a dedicated background event loop thread."""
        if not HAS_TELEGRAM:
            logger.warning("Telegram Bot disabled: python-telegram-bot is not available.")
            return

        if self.is_running:
            logger.info("Telegram Bot service is already active.")
            return

        self._thread = threading.Thread(target=self._run_event_loop, args=(webhook_base_url,), daemon=True)
        self._thread.start()

    def _run_event_loop(self, webhook_base_url: str):
        """Dedicated background thread running the asyncio event loop."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._async_init_and_start(webhook_base_url))
            self._loop.run_forever()
        except Exception as e:
            logger.error(f"Telegram Bot loop encountered error: {e}", exc_info=True)
        finally:
            self.is_running = False

    async def _async_init_and_start(self, webhook_base_url: str):
        """Initializes python-telegram-bot Application and registers handlers."""
        logger.info(f"Initializing Telegram Bot with Token: ***{BOT_TOKEN[-6:]}")
        self.app = ApplicationBuilder().token(BOT_TOKEN).build()

        # Register Handlers
        self.app.add_handler(CommandHandler("start", self._cmd_start))
        self.app.add_handler(CommandHandler("help", self._cmd_help))
        self.app.add_handler(CommandHandler("status", self._cmd_status))
        self.app.add_handler(CommandHandler("ping", self._cmd_ping))
        self.app.add_handler(CallbackQueryHandler(self._cb_product_click, pattern="^buy_"))
        self.app.add_handler(CallbackQueryHandler(self._cb_admin_decision, pattern="^(tune_|mod_|prompt_|back_|confirm_|appr_|rejt_)"))
        self.app.add_handler(MessageHandler(filters.PHOTO | filters.Document.IMAGE, self._msg_slip))
        self.app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), self._msg_admin_text))

        await self.app.initialize()
        await self.app.start()

        self.start_time = time.time()
        self.is_running = True

        # Check if Webhook or Polling mode
        env_url = os.environ.get("WEBHOOK_URL") or os.environ.get("RENDER_EXTERNAL_URL") or webhook_base_url
        if env_url and env_url.startswith("http"):
            full_webhook = env_url.rstrip("/") + "/api/telegram-webhook"
            try:
                logger.info(f"Setting Telegram Webhook to: {full_webhook}")
                await self.app.bot.set_webhook(url=full_webhook, drop_pending_updates=True)
                self.webhook_url = full_webhook
                self.mode = "webhook"
                logger.info(f"Telegram Webhook configured successfully: {full_webhook}")
            except Exception as e:
                logger.error(f"Failed to set webhook, falling back to polling: {e}")
                self.mode = "polling"
                await self._start_polling_safe()
        else:
            self.mode = "polling"
            logger.info("No external Webhook URL provided. Running in Background Polling mode.")
            await self._start_polling_safe()

    async def _start_polling_safe(self):
        """Starts non-blocking background polling on the current event loop."""
        try:
            await self.app.bot.delete_webhook(drop_pending_updates=True)
            if hasattr(self.app, 'updater') and self.app.updater:
                await self.app.updater.start_polling(poll_interval=1.5, timeout=20, drop_pending_updates=True)
                logger.info("Telegram Bot Polling started smoothly.")
        except Exception as e:
            logger.error(f"Error starting polling: {e}")

    def process_webhook_update(self, update_dict: dict) -> bool:
        """Processes an incoming JSON update from Flask route /api/telegram-webhook."""
        if not self.is_running or not self.app or not self._loop:
            logger.warning("Bot service is not ready to process webhook update.")
            return False

        try:
            update = Update.de_json(update_dict, self.app.bot)
            if update:
                self.last_update_time = time.time()
                self.updates_processed += 1
                asyncio.run_coroutine_threadsafe(self.app.process_update(update), self._loop)
                return True
        except Exception as e:
            logger.error(f"Error submitting update to bot loop: {e}")
        return False

    async def set_webhook_url(self, target_url: str) -> Tuple[bool, str]:
        """Manually or dynamically updates the Telegram webhook URL."""
        if not self.app:
            return False, "Bot is not initialized."
        try:
            full_url = target_url.rstrip("/") + "/api/telegram-webhook" if not target_url.endswith("/api/telegram-webhook") else target_url
            if hasattr(self.app, 'updater') and self.app.updater and self.app.updater.running:
                await self.app.updater.stop()
            await self.app.bot.set_webhook(url=full_url, drop_pending_updates=True)
            self.webhook_url = full_url
            self.mode = "webhook"
            return True, f"Webhook set to {full_url}"
        except Exception as e:
            return False, str(e)

    # ══════════════════════════════════════════════════════════════
    # 🤖 BOT HANDLERS IMPLEMENTATION
    # ══════════════════════════════════════════════════════════════

    async def _cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        keyboard = []
        for p_id, p_info in PRODUCTS.items():
            btn_text = f"{p_info['name']} — {p_info['price']}"
            keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"buy_{p_id}")])

        reply_markup = InlineKeyboardMarkup(keyboard)
        welcome_text = (
            "👋 <b>សួស្ដី! សូមស្វាគមន៍មកកាន់ «នាគហ្សង បកប្រែ» & Drama Tool Shop (24/7 Cloud)</b>\n\n"
            "ប្រព័ន្ធលក់ និងចែកចាយ License Key ផ្លូវការសម្រាប់ Tool កាត់តសម្រាយរឿង និង AI Voice Studio។\n\n"
            "👉 <b>សូមជ្រើសរើសសេវាកម្ម ឬកម្មវិធីដែលអ្នកចង់ទិញខាងក្រោម៖</b>"
        )
        if update.message:
            await update.message.reply_text(welcome_text, reply_markup=reply_markup, parse_mode="HTML")

    async def _cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        help_text = (
            "📖 <b>ជំនួយការប្រើប្រាស់ Drama Tool Bot 24/7</b>\n\n"
            "• ចុច /start ដើម្បីមើលផលិតផល និងតារាងតម្លៃ\n"
            "• ជ្រើសរើស Tool រួចផ្ញើរូបភាពវិក្កយបត្រ (Payment Slip) មកទីនេះ\n"
            "• Admin នឹង Approve និងទម្លាក់ License Key ជូនស្វ័យប្រវត្តិ ២៤/៧!\n"
            "• ទំនាក់ទំនង Admin: @KH_Admin168"
        )
        if update.message:
            await update.message.reply_text(help_text, parse_mode="HTML")

    async def _cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        uptime = int(time.time() - self.start_time) if self.start_time else 0
        h, m, s = uptime // 3600, (uptime % 3600) // 60, uptime % 60
        status_text = (
            f"⚡ <b>Cloud Server Status (Render.com)</b>\n\n"
            f"• <b>Status:</b> 🟢 ដំណើរការ ២៤/៧ (Online)\n"
            f"• <b>Mode:</b> {self.mode.upper()}\n"
            f"• <b>Uptime:</b> {h}h {m}m {s}s\n"
            f"• <b>Updates Processed:</b> {self.updates_processed}\n"
            f"• <b>Admin ID:</b> <code>{ADMIN_ID}</code>"
        )
        if update.message:
            await update.message.reply_text(status_text, parse_mode="HTML")

    async def _cmd_ping(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.message:
            await update.message.reply_text("🏓 <b>Pong! Server 24/7 ភ្ញាក់ និងឆ្លើយតបយ៉ាងរហ័ស។</b>", parse_mode="HTML")

    async def _cb_product_click(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        if not query:
            return
        await query.answer()

        p_id = query.data.replace("buy_", "")
        product = PRODUCTS.get(p_id)

        if not product:
            await query.edit_message_text("❌ រកមិនឃើញទំនិញនេះទេ។")
            return

        context.user_data["selected_product"] = p_id
        caption = (
            f"📦 <b>{html.escape(product['name'])}</b>\n"
            f"📝 {html.escape(product['desc'])}\n"
            f"💵 តម្លៃ៖ <b>{html.escape(product['price'])}</b>\n\n"
            f"👉 សូមស្កេនទូទាត់ប្រាក់តាម QR រួច <b>ផ្ញើរូបភាពវិក្កយបត្រ (Payment Slip)</b> មកទីនេះ។\n"
            f"⏳ Admin នឹងពិនិត្យផ្ទៀងផ្ទាត់ទឹកប្រាក់ក្នុងគណនី និងអនុម័តទម្លាក់ File + License Key ជូនភ្លាមៗ!"
        )

        qr_path = product.get("qr_image")
        if qr_path and os.path.exists(qr_path):
            try:
                with open(qr_path, "rb") as qr:
                    if query.message:
                        await query.message.reply_photo(photo=qr, caption=caption, parse_mode="HTML")
                return
            except Exception as e:
                logger.warning(f"Could not send photo: {e}")

        if query.message:
            await query.message.reply_text(caption, parse_mode="HTML")

    async def _msg_slip(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Customer sends payment slip image."""
        user = update.effective_user
        if not user or not update.message:
            return

        p_id = context.user_data.get("selected_product") or "tool_drama"
        product = PRODUCTS.get(p_id, PRODUCTS["tool_drama"])

        order_rand = secrets.token_hex(3).upper()
        order_id = f"ORD-{order_rand}"
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        photo_file_id = None
        if update.message.photo:
            photo_file_id = update.message.photo[-1].file_id
        elif update.message.document:
            photo_file_id = update.message.document.file_id

        orders = load_orders()
        orders[order_id] = {
            "order_id": order_id,
            "user_id": user.id,
            "username": user.username or "NoUser",
            "first_name": user.first_name or "",
            "product_id": p_id,
            "product_name": product["name"],
            "price": product["price"],
            "photo_file_id": photo_file_id,
            "status": "pending",
            "created_at": now_str,
            "temp_duration": {"days": 30, "hours": 0, "mins": 0, "secs": 0}
        }
        save_orders(orders)

        # 1. Customer Notification
        await update.message.reply_text(
            "⏳ <b>សូមរង់ចាំបន្តិច Admin កំពុងផ្ទៀងផ្ទាត់ទឹកប្រាក់ក្នុងគណនី...</b>",
            parse_mode="HTML"
        )

        # 2. Admin Notification
        admin_caption = (
            f"🔔 <b>[NEW ORDER PENDING] ភ្ញៀវបានផ្ញើស្លីបបង់ប្រាក់!</b>\n\n"
            f"👤 <b>អតិថិជន:</b> {html.escape(user.first_name or '')} (@{html.escape(user.username or 'NoUser')})\n"
            f"🆔 <b>Telegram ID:</b> <code>{user.id}</code>\n"
            f"📦 <b>ទំនិញ:</b> {html.escape(product['name'])}\n"
            f"💵 <b>តម្លៃ:</b> {html.escape(product['price'])}\n"
            f"🧾 <b>Order ID:</b> <code>{order_id}</code>\n"
            f"⏰ <b>កាលបរិច្ឆេទ:</b> {now_str}\n\n"
            f"👇 <b>សូមពិនិត្យមើលរូបវិក្កយបត្រខាងលើ និងជ្រើសរើស/កំណត់ម៉ោង License Key ជូនអតិថិជន៖</b>"
        )
        reply_markup = get_pending_admin_keyboard(order_id)

        try:
            if photo_file_id:
                await context.bot.send_photo(
                    chat_id=ADMIN_ID,
                    photo=photo_file_id,
                    caption=admin_caption,
                    reply_markup=reply_markup,
                    parse_mode="HTML"
                )
            else:
                await context.bot.send_message(
                    chat_id=ADMIN_ID,
                    text=admin_caption,
                    reply_markup=reply_markup,
                    parse_mode="HTML"
                )
        except Exception as e_adm:
            logger.warning(f"Admin notify warning: {e_adm}")

    async def _render_tuning_ui(self, query, order_id: str, order: dict):
        dur = order.get("temp_duration") or {"days": 30, "hours": 0, "mins": 0, "secs": 0}
        d, h, m, s = dur.get("days", 0), dur.get("hours", 0), dur.get("mins", 0), dur.get("secs", 0)
        total_secs = d * 86400 + h * 3600 + m * 60 + s
        now_utc = datetime.now(timezone.utc)
        expiry_dt = now_utc + timedelta(seconds=total_secs)

        parts = []
        if d > 0: parts.append(f"<b>{d}</b> ថ្ងៃ")
        if h > 0: parts.append(f"<b>{h}</b> ម៉ោង")
        if m > 0: parts.append(f"<b>{m}</b> នាទី")
        if s > 0: parts.append(f"<b>{s}</b> វិនាទី")
        dur_summary = " ".join(parts) if parts else f"<b>{total_secs}</b> វិនាទី"

        caption = (
            f"⚙️ <b>[DURATION TUNING] កំណត់សុពលភាព License Key</b>\n\n"
            f"🧾 <b>Order ID:</b> <code>{order_id}</code>\n"
            f"👤 <b>អតិថិជន:</b> {html.escape(order.get('first_name',''))} (@{html.escape(order.get('username','NoUser'))})\n"
            f"📦 <b>ទំនិញ:</b> {html.escape(order.get('product_name',''))}\n\n"
            f"⏱️ <b>រយៈពេលកំណត់បច្ចុប្បន្ន៖</b> {dur_summary}\n"
            f"📅 <b>ថ្ងៃផុតកំណត់៖</b> <code>{expiry_dt.strftime('%Y-%m-%d %H:%M:%S')} UTC</code>\n\n"
            f"👇 <b>ចុចប៊ូតុងខាងក្រោមដើម្បីបន្ថែម/បន្ថយ ម៉ោង/នាទី៖</b>"
        )
        kb = [
            [
                InlineKeyboardButton("➕ 1 ថ្ងៃ", callback_data=f"mod_{order_id}_add_1d"),
                InlineKeyboardButton("➕ 12 ម៉ោង", callback_data=f"mod_{order_id}_add_12h"),
                InlineKeyboardButton("➕ 1 ម៉ោង", callback_data=f"mod_{order_id}_add_1h")
            ],
            [
                InlineKeyboardButton("➖ 1 ថ្ងៃ", callback_data=f"mod_{order_id}_sub_1d"),
                InlineKeyboardButton("➖ 12 ម៉ោង", callback_data=f"mod_{order_id}_sub_12h"),
                InlineKeyboardButton("➖ 1 ម៉ោង", callback_data=f"mod_{order_id}_sub_1h")
            ],
            [
                InlineKeyboardButton("➕ 30 នាទី", callback_data=f"mod_{order_id}_add_30m"),
                InlineKeyboardButton("➕ 10 វិនាទី", callback_data=f"mod_{order_id}_add_10s"),
                InlineKeyboardButton("➖ 30 នាទី", callback_data=f"mod_{order_id}_sub_30m")
            ],
            [
                InlineKeyboardButton("🚀 បង្កើត Key & ផ្ញើទៅភ្ញៀវ (Approve)", callback_data=f"confirm_{order_id}")
            ],
            [
                InlineKeyboardButton("🔙 ត្រឡប់ក្រោយ (Back)", callback_data=f"back_{order_id}")
            ]
        ]
        markup = InlineKeyboardMarkup(kb)
        try:
            if query.message.photo:
                await query.edit_message_caption(caption=caption, reply_markup=markup, parse_mode="HTML")
            else:
                await query.edit_message_text(text=caption, reply_markup=markup, parse_mode="HTML")
        except Exception as e:
            logger.warning(f"UI edit warning: {e}")

    async def _execute_approval(self, query, context: ContextTypes.DEFAULT_TYPE, order_id: str, order: dict, key_type: str = "expiry", days: int = 0, hours: int = 0, mins: int = 0, secs: int = 0):
        """Generates real license via LicenseManager and delivers to customer."""
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Use Neak Zong License Manager for real key creation
        try:
            from core.license_manager import license_mgr
            if key_type == "lifetime":
                lic_rec = license_mgr.create_license(duration_type="lifetime", duration_val=0, note=f"Order {order_id} Lifetime")
                key = lic_rec["key"]
                desc = "♾️ ប្រើប្រាស់បានជារៀងរហូត (Lifetime VIP)"
            else:
                total_secs = days * 86400 + hours * 3600 + mins * 60 + secs
                if total_secs <= 0:
                    total_secs = 86400  # Default 1 day
                lic_rec = license_mgr.create_license(duration_type="seconds", duration_val=total_secs, note=f"Order {order_id}")
                key = lic_rec["key"]
                parts = []
                if days > 0: parts.append(f"{days} ថ្ងៃ")
                if hours > 0: parts.append(f"{hours} ម៉ោង")
                if mins > 0: parts.append(f"{mins} នាទី")
                if secs > 0: parts.append(f"{secs} វិនាទី")
                desc = " ".join(parts) if parts else f"{total_secs} វិនាទី"
        except Exception as e_lic:
            logger.error(f"License gen error: {e_lic}")
            key = f"NZ-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"
            desc = "Active License"

        # Update Order Record
        orders = load_orders()
        order["status"] = "approved"
        order["license_key"] = key
        order["license_desc"] = desc
        order["approved_at"] = now_str
        orders[order_id] = order
        save_orders(orders)

        target_user_id = order["user_id"]
        product_id = order.get("product_id", "tool_drama")
        product = PRODUCTS.get(product_id, PRODUCTS["tool_drama"])

        # Customer Delivery
        customer_delivery_msg = (
            f"🎉 <b>ការទូទាត់ប្រាក់ត្រូវបាន Admin យល់ព្រម (APPROVED)!</b>\n\n"
            f"🔐 <b>ACTIVATION LICENSE KEY របស់អ្នក៖</b>\n"
            f"👉 <code>{key}</code>\n"
            f"⏳ <b>សុពលភាព៖</b> {html.escape(desc)}\n\n"
            f"📋 <b>របៀបប្រើប្រាស់លើ «នាគហ្សង បកប្រែ»៖</b>\n"
            f"1. បើកកម្មវិធីលើទូរសព្ទដៃ ឬ Browser របស់អ្នក\n"
            f"2. ចុចប៊ូតុង <b>«ដោះសោ License» (🔑)</b>\n"
            f"3. ចម្លង Key <code>{key}</code> បិទភ្ជាប់ រួចចុច <b>Activate</b> ជាការស្រេច!"
        )

        try:
            # Send file if exists
            file_target = product.get("file_path", "")
            if file_target and os.path.exists(file_target):
                with open(file_target, "rb") as doc:
                    await context.bot.send_document(
                        chat_id=target_user_id,
                        document=doc,
                        caption=f"📁 <b>{html.escape(product['name'])}</b>\n✅ កញ្ចប់កម្មវិធីរួចរាល់សម្រាប់ដំឡើង!",
                        parse_mode="HTML"
                    )
            await context.bot.send_message(
                chat_id=target_user_id,
                text=customer_delivery_msg,
                parse_mode="HTML"
            )
        except Exception as e_send:
            logger.error(f"Error delivering to customer {target_user_id}: {e_send}")

        # Update Admin Message
        new_admin_caption = (
            f"✅ <b>[APPROVED] បានយល់ព្រម និងផ្ញើ Key ជូនអតិថិជនរួចរាល់!</b>\n\n"
            f"👤 <b>អតិថិជន:</b> {html.escape(order.get('first_name', ''))} (@{html.escape(order.get('username', 'NoUser'))})\n"
            f"🆔 <b>Telegram ID:</b> <code>{order['user_id']}</code>\n"
            f"📦 <b>ទំនិញ:</b> {html.escape(order.get('product_name', ''))}\n"
            f"🔑 <b>Key:</b> <code>{key}</code>\n"
            f"⏳ <b>សុពលភាព:</b> {html.escape(desc)}\n"
            f"⏰ <b>Approved At:</b> {now_str}"
        )
        try:
            if query.message.photo:
                await query.edit_message_caption(caption=new_admin_caption, parse_mode="HTML")
            else:
                await query.edit_message_text(text=new_admin_caption, parse_mode="HTML")
        except Exception as e_edit:
            logger.warning(f"Error editing admin message: {e_edit}")

        await query.answer("✅ បាន Approve និងទម្លាក់ Key ទៅភ្ញៀវរួចរាល់!", show_alert=True)

    async def _cb_admin_decision(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        admin_user = update.effective_user
        if not query or not admin_user:
            return

        if admin_user.id != ADMIN_ID:
            await query.answer("❌ អ្នកមិនមានសិទ្ធិជា Admin ឡើយ!", show_alert=True)
            return

        data = query.data
        orders = load_orders()

        # Preset tuning entry
        if data.startswith("tune_"):
            parts = data.split("_")
            order_id = parts[1]
            preset = parts[2] if len(parts) > 2 else "custom"
            order = orders.get(order_id)
            if not order:
                await query.answer("❌ រកមិនឃើញ Order នេះទេ!", show_alert=True)
                return

            preset_map = {
                "1d": {"days": 1, "hours": 0, "mins": 0, "secs": 0},
                "30d": {"days": 30, "hours": 0, "mins": 0, "secs": 0},
                "180d": {"days": 180, "hours": 0, "mins": 0, "secs": 0},
                "365d": {"days": 365, "hours": 0, "mins": 0, "secs": 0},
                "custom": {"days": 0, "hours": 1, "mins": 0, "secs": 0}
            }
            order["temp_duration"] = preset_map.get(preset, {"days": 1, "hours": 0, "mins": 0, "secs": 0})
            orders[order_id] = order
            save_orders(orders)
            await query.answer()
            await self._render_tuning_ui(query, order_id, order)
            return

        # Modify values
        if data.startswith("mod_"):
            parts = data.split("_")
            order_id, op, val_str = parts[1], parts[2], parts[3]
            order = orders.get(order_id)
            if not order:
                await query.answer("❌ រកមិនឃើញ Order នេះទេ!", show_alert=True)
                return

            dur = order.get("temp_duration") or {"days": 30, "hours": 0, "mins": 0, "secs": 0}
            total_secs = dur.get("days", 0) * 86400 + dur.get("hours", 0) * 3600 + dur.get("mins", 0) * 60 + dur.get("secs", 0)
            delta = 0
            if val_str == "1d": delta = 86400
            elif val_str == "12h": delta = 43200
            elif val_str == "1h": delta = 3600
            elif val_str == "30m": delta = 1800
            elif val_str == "10s": delta = 10

            if op == "add":
                total_secs += delta
            else:
                total_secs = max(10, total_secs - delta)

            d = total_secs // 86400
            rem = total_secs % 86400
            h = rem // 3600
            rem %= 3600
            m = rem // 60
            s = rem % 60
            order["temp_duration"] = {"days": d, "hours": h, "mins": m, "secs": s}
            orders[order_id] = order
            save_orders(orders)
            await query.answer()
            await self._render_tuning_ui(query, order_id, order)
            return

        # Confirm approval
        if data.startswith("confirm_"):
            order_id = data.replace("confirm_", "")
            order = orders.get(order_id)
            if not order:
                await query.answer("❌ រកមិនឃើញ Order នេះទេ!", show_alert=True)
                return
            dur = order.get("temp_duration") or {"days": 30, "hours": 0, "mins": 0, "secs": 0}
            await self._execute_approval(
                query, context, order_id, order,
                key_type="expiry",
                days=dur.get("days", 0),
                hours=dur.get("hours", 0),
                mins=dur.get("mins", 0),
                secs=dur.get("secs", 0)
            )
            return

        # Direct lifetime approval
        if data.startswith("appr_") and "_lifetime" in data:
            order_id = data.replace("appr_", "").replace("_lifetime", "")
            order = orders.get(order_id)
            if not order:
                await query.answer("❌ រកមិនឃើញ Order នេះទេ!", show_alert=True)
                return
            await self._execute_approval(query, context, order_id, order, key_type="lifetime")
            return

        # Reject order
        if data.startswith("rejt_"):
            order_id = data.replace("rejt_", "")
            order = orders.get(order_id)
            if not order:
                await query.answer("❌ រកមិនឃើញ Order នេះទេ!", show_alert=True)
                return
            order["status"] = "rejected"
            orders[order_id] = order
            save_orders(orders)

            try:
                await context.bot.send_message(
                    chat_id=order["user_id"],
                    text="❌ <b>ការទូទាត់ប្រាក់មិនត្រឹមត្រូវ ឬត្រូវបានបដិសេធ (REJECTED)។</b>\nសូមទាក់ទង Admin @KH_Admin168 ប្រសិនបើមានបញ្ហា!",
                    parse_mode="HTML"
                )
            except Exception as e_rej:
                logger.warning(f"Could not notify customer of rejection: {e_rej}")

            try:
                if query.message.photo:
                    await query.edit_message_caption(caption=f"❌ <b>[REJECTED] បានបដិសេធ Order {order_id} រួចរាល់។</b>", parse_mode="HTML")
                else:
                    await query.edit_message_text(text=f"❌ <b>[REJECTED] បានបដិសេធ Order {order_id} រួចរាល់។</b>", parse_mode="HTML")
            except Exception:
                pass
            await query.answer("❌ បានបដិសេធ Order រួចរាល់!", show_alert=True)
            return

        # Back
        if data.startswith("back_"):
            order_id = data.replace("back_", "")
            order = orders.get(order_id)
            if not order:
                await query.answer()
                return
            caption = (
                f"🔔 <b>[ORDER PENDING] Order ID: <code>{order_id}</code></b>\n\n"
                f"👤 <b>អតិថិជន:</b> {html.escape(order.get('first_name', ''))} (@{html.escape(order.get('username', 'NoUser'))})\n"
                f"💵 <b>តម្លៃ:</b> {html.escape(order.get('price', ''))}\n\n"
                f"👇 <b>សូមជ្រើសរើសរយៈពេល License Key ជូនអតិថិជន៖</b>"
            )
            markup = get_pending_admin_keyboard(order_id)
            try:
                if query.message.photo:
                    await query.edit_message_caption(caption=caption, reply_markup=markup, parse_mode="HTML")
                else:
                    await query.edit_message_text(text=caption, reply_markup=markup, parse_mode="HTML")
            except Exception:
                pass
            await query.answer()

    async def _msg_admin_text(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Allows Admin to type custom duration string (e.g. '12h', '2d 5h')."""
        user = update.effective_user
        if not user or user.id != ADMIN_ID or not update.message:
            return

        text = update.message.text.strip()
        orders = load_orders()
        active_order_id = None
        for o_id, o_data in reversed(list(orders.items())):
            if o_data.get("status") == "pending":
                active_order_id = o_id
                break

        if not active_order_id or active_order_id not in orders:
            return

        d, h, m, s = parse_duration_string(text)
        if d == 0 and h == 0 and m == 0 and s == 0:
            return

        order = orders[active_order_id]
        order["temp_duration"] = {"days": d, "hours": h, "mins": m, "secs": s}
        orders[active_order_id] = order
        save_orders(orders)

        total_secs = d * 86400 + h * 3600 + m * 60 + s
        now_utc = datetime.now(timezone.utc)
        expiry_dt = now_utc + timedelta(seconds=total_secs)

        parts = []
        if d > 0: parts.append(f"{d} ថ្ងៃ")
        if h > 0: parts.append(f"{h} ម៉ោង")
        if m > 0: parts.append(f"{m} នាទី")
        if s > 0: parts.append(f"{s} វិនាទី")
        dur_str = " ".join(parts) if parts else f"{total_secs} វិនាទី"

        await update.message.reply_text(
            f"⚙️ <b>បានប្តូររយៈពេលសម្រាប់ Order <code>{active_order_id}</code>៖</b>\n"
            f"👉 <b>{dur_str}</b>\n"
            f"📅 ផុតកំណត់៖ <code>{expiry_dt.strftime('%Y-%m-%d %H:%M:%S')} UTC</code>\n\n"
            f"💡 <i>សូមពិនិត្យផ្ទាំង Pending ខាងលើ និងចុច [🚀 បង្កើត Key & ផ្ញើទៅភ្ញៀវ (Approve)] ដើម្បីបញ្ជាក់!</i>",
            parse_mode="HTML"
        )


# Singleton instance
bot_service = TelegramBotService()
