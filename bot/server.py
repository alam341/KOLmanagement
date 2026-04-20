"""
KOL Bot Server — jalan di background, terima perintah dari web app
"""
import asyncio
import csv
import json
import random
import threading
import logging
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from playwright.async_api import async_playwright, TimeoutError as PWTimeout

# ===== SETUP =====
BASE    = Path(__file__).parent
LOG_DIR = BASE / "log"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
log = logging.getLogger(__name__)

app   = Flask(__name__)
CORS(app)

# State bot
bot_state = {
    "running": False,
    "progress": [],
    "current": 0,
    "total": 0,
    "sukses": 0,
    "gagal": 0,
    "done": False,
    "stop_flag": False,
}

# ===== HELPERS =====
def convert_cookies(raw):
    """Konversi cookies format Puppeteer/EditThisCookie ke Playwright."""
    if isinstance(raw, dict):
        raw = list(raw.values())
    result = []
    for c in raw:
        same_site = str(c.get("sameSite") or "None").capitalize()
        if same_site not in ("None", "Lax", "Strict"):
            same_site = "None"
        cookie = {
            "name":     c.get("name", ""),
            "value":    c.get("value", ""),
            "domain":   c.get("domain", ".tiktok.com"),
            "path":     c.get("path", "/"),
            "secure":   bool(c.get("secure", True)),
            "httpOnly": bool(c.get("httpOnly", False)),
            "sameSite": same_site,
        }
        exp = c.get("expirationDate") or c.get("expires") or -1
        if exp and float(exp) > 0:
            cookie["expires"] = float(exp)
        result.append(cookie)
    return result

def fill_message(template, kol):
    return (template
        .replace("{nama}",      kol.get("name", ""))
        .replace("{brand}",     kol.get("brand", "Brand"))
        .replace("{produk}",    kol.get("product", "Produk"))
        .replace("{komisi}",    str(kol.get("komisi", "10")))
        .replace("{username}",  kol.get("tiktok", ""))
        .replace("{followers}", kol.get("followers", ""))
        .replace("{niche}",     kol.get("niche", "")))

def save_result(username, nama, status, note=""):
    f = LOG_DIR / "results.csv"
    is_new = not f.exists()
    with open(f, "a", newline="", encoding="utf-8") as fp:
        w = csv.writer(fp)
        if is_new:
            w.writerow(["timestamp", "username", "nama", "status", "catatan"])
        w.writerow([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), username, nama, status, note])

def add_log(msg, status="info"):
    bot_state["progress"].append({
        "time": datetime.now().strftime("%H:%M:%S"),
        "msg":  msg,
        "status": status,
    })
    log.info(msg)

# ===== PLAYWRIGHT =====
async def send_dm(page, username, message):
    try:
        await page.goto(f"https://www.tiktok.com/@{username}", wait_until="domcontentloaded", timeout=25000)
    except PWTimeout:
        return False, "Timeout load profil"

    await asyncio.sleep(random.uniform(2, 3))

    if await page.locator("text=Couldn't find this account").count():
        return False, "Akun tidak ditemukan"

    # Cari tombol Message
    msg_btn = None
    for sel in ['[data-e2e="message-btn"]','button:has-text("Message")','button:has-text("Pesan")']:
        try:
            el = page.locator(sel).first
            if await el.is_visible(timeout=3000):
                msg_btn = el; break
        except Exception:
            continue

    if not msg_btn:
        return False, "Tombol pesan tidak ada (private/perlu follow)"

    await msg_btn.click()
    await asyncio.sleep(random.uniform(2, 3))

    # Cari input
    input_box = None
    for sel in ['[data-e2e="message-input"]','div[contenteditable="true"]','textarea']:
        try:
            el = page.locator(sel).last
            if await el.is_visible(timeout=5000):
                input_box = el; break
        except Exception:
            continue

    if not input_box:
        return False, "Kotak input tidak muncul"

    await input_box.click()
    await asyncio.sleep(random.uniform(0.3, 0.7))

    for char in message:
        await input_box.type(char, delay=random.randint(15, 70))

    await asyncio.sleep(random.uniform(1, 1.5))

    sent = False
    for sel in ['[data-e2e="send-btn"]','button:has-text("Send")','button:has-text("Kirim")']:
        try:
            btn = page.locator(sel).last
            if await btn.is_visible(timeout=2000):
                await btn.click(); sent = True; break
        except Exception:
            continue

    if not sent:
        await input_box.press("Enter")

    await asyncio.sleep(random.uniform(1.5, 2))
    return True, "OK"

async def run_bot_async(cookies_raw, kols, template, delay_min, delay_max):
    bot_state["running"]   = True
    bot_state["done"]      = False
    bot_state["stop_flag"] = False
    bot_state["sukses"]    = 0
    bot_state["gagal"]     = 0
    bot_state["current"]   = 0
    bot_state["total"]     = len(kols)
    bot_state["progress"]  = []

    add_log(f"Bot dimulai — {len(kols)} KOL", "info")

    try:
        cookies = convert_cookies(cookies_raw)
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=False,
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="id-ID",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            await context.add_cookies(cookies)
            page = await context.new_page()

            await page.goto("https://www.tiktok.com", wait_until="domcontentloaded")
            await asyncio.sleep(3)

            if await page.locator('[data-e2e="nav-login-btn"]').count():
                add_log("Cookies tidak valid / expired!", "error")
                await browser.close()
                bot_state["running"] = False
                bot_state["done"]    = True
                return

            add_log("Login berhasil ✓", "success")

            for i, kol in enumerate(kols):
                if bot_state["stop_flag"]:
                    add_log("Bot dihentikan oleh user.", "info")
                    break

                bot_state["current"] = i + 1
                username = kol.get("tiktok", "").lstrip("@")
                nama     = kol.get("name", username)
                message  = fill_message(template, kol)

                add_log(f"[{i+1}/{len(kols)}] Mengirim ke @{username}...", "info")
                ok, note = await send_dm(page, username, message)

                if ok:
                    bot_state["sukses"] += 1
                    save_result(username, nama, "SUKSES")
                    add_log(f"✓ @{username} — SUKSES", "success")
                else:
                    bot_state["gagal"] += 1
                    save_result(username, nama, "GAGAL", note)
                    add_log(f"✗ @{username} — {note}", "error")

                if i < len(kols) - 1 and not bot_state["stop_flag"]:
                    delay = random.randint(delay_min, delay_max)
                    add_log(f"Jeda {delay} detik...", "info")
                    await asyncio.sleep(delay)

            await browser.close()

    except Exception as e:
        add_log(f"Error: {str(e)}", "error")

    bot_state["running"] = False
    bot_state["done"]    = True
    add_log(f"Selesai! Sukses: {bot_state['sukses']}, Gagal: {bot_state['gagal']}", "success")

def run_bot_thread(cookies, kols, template, delay_min, delay_max):
    asyncio.run(run_bot_async(cookies, kols, template, delay_min, delay_max))

# ===== API ROUTES =====
@app.route("/status", methods=["GET"])
def status():
    return jsonify({"ok": True, "running": bot_state["running"]})

@app.route("/run", methods=["POST"])
def run_bot():
    if bot_state["running"]:
        return jsonify({"ok": False, "error": "Bot sedang berjalan!"}), 400

    data = request.json
    if not data:
        return jsonify({"ok": False, "error": "Data tidak valid"}), 400

    cookies   = data.get("cookies")
    kols      = data.get("kols", [])
    template  = data.get("template", "")
    delay_min = int(data.get("delay_min", 30))
    delay_max = int(data.get("delay_max", 60))

    if not cookies:
        return jsonify({"ok": False, "error": "Cookies tidak ada"}), 400
    if not kols:
        return jsonify({"ok": False, "error": "Pilih minimal 1 KOL"}), 400
    if not template:
        return jsonify({"ok": False, "error": "Template pesan kosong"}), 400

    t = threading.Thread(target=run_bot_thread, args=(cookies, kols, template, delay_min, delay_max), daemon=True)
    t.start()
    return jsonify({"ok": True, "total": len(kols)})

@app.route("/progress", methods=["GET"])
def progress():
    return jsonify({
        "running":  bot_state["running"],
        "done":     bot_state["done"],
        "current":  bot_state["current"],
        "total":    bot_state["total"],
        "sukses":   bot_state["sukses"],
        "gagal":    bot_state["gagal"],
        "logs":     bot_state["progress"][-30:],
    })

@app.route("/stop", methods=["POST"])
def stop_bot():
    bot_state["stop_flag"] = True
    return jsonify({"ok": True})

@app.route("/read-results", methods=["GET"])
def read_results():
    f = LOG_DIR / "results.csv"
    if not f.exists():
        return jsonify({"rows": []})
    rows = []
    with open(f, newline="", encoding="utf-8") as fp:
        for row in csv.DictReader(fp):
            rows.append(row)
    return jsonify({"rows": rows})

if __name__ == "__main__":
    print("\n" + "="*45)
    print("  KOL Bot Server berjalan di background")
    print("  Buka web app → menu Auto DM TikTok")
    print("="*45 + "\n")
    app.run(host="127.0.0.1", port=5678, debug=False)
