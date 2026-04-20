"""
TikTok DM Auto-Sender
Pakai cookies.json dari ekstensi browser → tidak perlu tutup Chrome
"""

import asyncio
import csv
import json
import random
import logging
import sys
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PWTimeout
from colorama import init, Fore, Style

init(autoreset=True)

BASE    = Path(__file__).parent
LOG_DIR = BASE / "log"
LOG_DIR.mkdir(exist_ok=True)

log_file = LOG_DIR / f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)


# ===== LOAD CONFIG =====
def load_config():
    with open(BASE / "config.json", encoding="utf-8") as f:
        return json.load(f)


# ===== LOAD COOKIES =====
def load_cookies(path: Path):
    """
    Terima format Puppeteer/EditThisCookie/Cookie-Editor.
    Konversi ke format Playwright.
    """
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    # Beberapa ekstensi export sebagai dict {name: {…}}, ubah ke list
    if isinstance(raw, dict):
        raw = list(raw.values())

    cookies = []
    for c in raw:
        # Playwright butuh sameSite kapital pertama: None/Lax/Strict
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
        # expires: Puppeteer pakai angka; -1 = session cookie
        exp = c.get("expirationDate") or c.get("expires") or -1
        if exp and float(exp) > 0:
            cookie["expires"] = float(exp)

        cookies.append(cookie)

    return cookies


# ===== LOAD KOL LIST =====
def load_kol_csv(path: Path):
    kols = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            username = (row.get("TikTok") or row.get("tiktok") or "").strip().lstrip("@")
            nama     = (row.get("Nama")   or row.get("nama")   or "").strip()
            status   = (row.get("Status") or row.get("status") or "new").strip().lower()
            if username:
                kols.append({"username": username, "nama": nama or username, "status": status})
    return kols


# ===== SESSION LOG =====
def load_sent():
    f = LOG_DIR / "sent.txt"
    return set(f.read_text("utf-8").splitlines()) if f.exists() else set()

def mark_sent(username):
    with open(LOG_DIR / "sent.txt", "a", encoding="utf-8") as f:
        f.write(username + "\n")

def save_result(username, nama, status, note=""):
    result_file = LOG_DIR / "results.csv"
    is_new = not result_file.exists()
    with open(result_file, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if is_new:
            w.writerow(["timestamp", "username", "nama", "status", "catatan"])
        w.writerow([datetime.now().strftime("%Y-%m-%d %H:%M:%S"), username, nama, status, note])


# ===== HELPERS =====
def fill_message(template, nama, cfg):
    return (template
        .replace("{nama}",   nama)
        .replace("{brand}",  cfg.get("brand",  "Brand"))
        .replace("{produk}", cfg.get("produk", "Produk"))
        .replace("{komisi}", str(cfg.get("komisi", "10"))))

async def rand_sleep(mn, mx):
    await asyncio.sleep(random.uniform(mn, mx))

def print_banner():
    print(Fore.CYAN + """
╔══════════════════════════════════════╗
║     TikTok DM Auto-Sender  v2.0     ║
║     Mode: Cookie Session            ║
╚══════════════════════════════════════╝""")

def print_row(i, total, username, status, note=""):
    color = {
        "SUKSES": Fore.GREEN,
        "GAGAL":  Fore.RED,
        "SKIP":   Fore.YELLOW,
    }.get(status, Fore.WHITE)
    print(f"  [{i:>3}/{total}] {color}{status:<6}{Style.RESET_ALL}  @{username:<30} {Fore.WHITE}{note}")


# ===== SEND DM =====
async def send_dm(page, username, message):
    url = f"https://www.tiktok.com/@{username}"
    log.info(f"→ {url}")

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=25000)
    except PWTimeout:
        return False, "Timeout load profil"

    await rand_sleep(2, 4)

    # Cek akun tidak ditemukan
    if await page.locator("text=Couldn't find this account").count():
        return False, "Akun tidak ditemukan"

    # Cari tombol Message
    msg_btn = None
    for sel in [
        '[data-e2e="message-btn"]',
        'button:has-text("Message")',
        'button:has-text("Pesan")',
        'button[aria-label*="message" i]',
        'button[aria-label*="pesan" i]',
    ]:
        try:
            el = page.locator(sel).first
            if await el.is_visible(timeout=3000):
                msg_btn = el
                break
        except Exception:
            continue

    if not msg_btn:
        return False, "Tombol pesan tidak ada (private / perlu follow dulu)"

    await msg_btn.click()
    await rand_sleep(2, 3)

    # Cari input box
    input_box = None
    for sel in [
        '[data-e2e="message-input"]',
        'div[contenteditable="true"]',
        'textarea',
        '[placeholder*="message" i]',
        '[placeholder*="pesan" i]',
    ]:
        try:
            el = page.locator(sel).last
            if await el.is_visible(timeout=5000):
                input_box = el
                break
        except Exception:
            continue

    if not input_box:
        return False, "Kotak input tidak muncul"

    await input_box.click()
    await rand_sleep(0.3, 0.8)

    # Ketik natural
    for char in message:
        await input_box.type(char, delay=random.randint(15, 75))

    await rand_sleep(1, 2)

    # Kirim
    sent = False
    for sel in [
        '[data-e2e="send-btn"]',
        'button:has-text("Send")',
        'button:has-text("Kirim")',
        'button[aria-label="Send"]',
        'button[type="submit"]',
    ]:
        try:
            btn = page.locator(sel).last
            if await btn.is_visible(timeout=2000):
                await btn.click()
                sent = True
                break
        except Exception:
            continue

    if not sent:
        await input_box.press("Enter")

    await rand_sleep(1.5, 2.5)
    return True, "OK"


# ===== MAIN =====
async def main():
    print_banner()
    cfg = load_config()

    # --- Pilih file cookies ---
    cookie_files = list(BASE.glob("cookies*.json")) + list(BASE.glob("*.json"))
    cookie_files = [f for f in cookie_files if f.name != "config.json"]

    if not cookie_files:
        print(Fore.RED + "\nERROR: File cookies.json tidak ditemukan di folder bot/")
        print(Fore.WHITE + """
Cara ambil cookies TikTok:
1. Buka Chrome → login ke TikTok
2. Install ekstensi: "EditThisCookie" atau "Cookie-Editor"
3. Buka TikTok.com → klik ikon ekstensi
4. Pilih Export → simpan sebagai cookies.json
5. Taruh file cookies.json di folder bot/
""")
        input("Tekan Enter untuk keluar...")
        return

    if len(cookie_files) == 1:
        cookies_path = cookie_files[0]
        print(Fore.GREEN + f"Cookies ditemukan: {cookies_path.name}")
    else:
        print(Fore.CYAN + "\nPilih file cookies:")
        for i, f in enumerate(cookie_files):
            print(f"  [{i+1}] {f.name}")
        try:
            cookies_path = cookie_files[int(input("Nomor: ").strip()) - 1]
        except (ValueError, IndexError):
            print(Fore.RED + "Pilihan tidak valid."); return

    try:
        cookies = load_cookies(cookies_path)
        print(Fore.GREEN + f"{len(cookies)} cookies dimuat.")
    except Exception as e:
        print(Fore.RED + f"Gagal baca cookies: {e}"); return

    # --- Pilih file CSV ---
    csv_files = list(BASE.glob("*.csv")) + list(BASE.parent.glob("kol-export*.csv"))
    if not csv_files:
        print(Fore.RED + "\nERROR: File CSV tidak ditemukan.")
        print("Export dari web app KOL Manager → simpan di folder bot/")
        input("Tekan Enter untuk keluar..."); return

    if len(csv_files) == 1:
        csv_path = csv_files[0]
        print(Fore.GREEN + f"CSV ditemukan: {csv_path.name}")
    else:
        print(Fore.CYAN + "\nPilih file CSV KOL:")
        for i, f in enumerate(csv_files):
            print(f"  [{i+1}] {f.name}")
        try:
            csv_path = csv_files[int(input("Nomor: ").strip()) - 1]
        except (ValueError, IndexError):
            print(Fore.RED + "Pilihan tidak valid."); return

    kols = load_kol_csv(csv_path)
    print(Fore.GREEN + f"{len(kols)} KOL dimuat.")

    # Filter sudah dikirim
    sent_set = load_sent()
    if cfg.get("skip_already_sent", True):
        before = len(kols)
        kols = [k for k in kols
                if k["username"] not in sent_set
                and k["status"] not in ("contacted", "replied", "deal")]
        skipped = before - len(kols)
        if skipped:
            print(Fore.YELLOW + f"{skipped} KOL dilewati (sudah dikirim / status aktif)")

    max_sess = cfg.get("max_per_session", 30)
    if len(kols) > max_sess:
        print(Fore.YELLOW + f"Sesi ini dibatasi {max_sess} KOL.")
        kols = kols[:max_sess]

    if not kols:
        print(Fore.GREEN + "\nSemua KOL sudah dihubungi!"); return

    print(f"\nSiap kirim ke {Fore.CYAN}{len(kols)}{Style.RESET_ALL} KOL")
    print(f"Delay: {cfg['delay_min']}–{cfg['delay_max']} detik antar pesan")
    input(Fore.WHITE + "\nTekan Enter untuk mulai...\n")

    # --- Launch browser dengan cookies ---
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=cfg.get("headless", False),
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

        # Inject cookies → sudah "login"
        await context.add_cookies(cookies)
        page = await context.new_page()

        # Verifikasi login
        await page.goto("https://www.tiktok.com", wait_until="domcontentloaded")
        await rand_sleep(3, 4)

        if await page.locator('[data-e2e="nav-login-btn"]').count():
            print(Fore.RED + "\nKookies tidak valid / sudah expired!")
            print("Ambil ulang cookies dari ekstensi browser.")
            await browser.close(); return

        print(Fore.GREEN + "Login berhasil via cookies!\n")
        print(f"  {'NO':<5} {'STATUS':<8} {'USERNAME':<32} CATATAN")
        print("  " + "─" * 65)

        sukses = gagal = 0
        for i, kol in enumerate(kols, 1):
            username = kol["username"]
            nama     = kol["nama"]
            message  = fill_message(cfg["message_template"], nama, cfg)

            ok, note = await send_dm(page, username, message)

            if ok:
                sukses += 1
                mark_sent(username)
                save_result(username, nama, "SUKSES")
                print_row(i, len(kols), username, "SUKSES")
            else:
                gagal += 1
                save_result(username, nama, "GAGAL", note)
                print_row(i, len(kols), username, "GAGAL", note)

            if i < len(kols):
                delay = random.randint(cfg["delay_min"], cfg["delay_max"])
                print(f"       ↳ jeda {delay} detik...\n")
                await asyncio.sleep(delay)

        await browser.close()

    print(Fore.CYAN + f"""
╔══════════════════════════════╗
  Sesi selesai!
  ✓ Sukses : {sukses}
  ✗ Gagal  : {gagal}
  Log      : bot/log/results.csv
╚══════════════════════════════╝""")
    input("\nTekan Enter untuk keluar...")


if __name__ == "__main__":
    asyncio.run(main())
