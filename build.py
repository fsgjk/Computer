#!/usr/bin/env python3
"""Build script: sync data from live page first, then build."""
import json, re, urllib.request, sys

LIVE_URL = "https://fsgjk.github.io/Computer/"
LOCAL_DATA = "ledger_clean.json"

# Step 1: Try to pull live data
print("Syncing data from live page...")
try:
    req = urllib.request.Request(LIVE_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode("utf-8")
    match = re.search(r"var DATA = (\[.*?\]);", html, re.DOTALL)
    if match:
        live_data = json.loads(match.group(1))
        print(f"  Live: {len(live_data)} records")
        with open(LOCAL_DATA, "w") as f:
            json.dump(live_data, f, ensure_ascii=False)
        print(f"  Saved to {LOCAL_DATA}")
    else:
        print("  WARNING: Could not extract DATA from live page, using local file")
except Exception as e:
    print(f"  WARNING: Could not fetch live page ({e}), using local file")

# Step 2: Build
print("Building...")
with open(LOCAL_DATA, "r") as f:
    data = json.load(f)

with open("app.js", "r") as f:
    js = f.read()

users = {
    "admin": {"pwd": "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", "name": "管理员", "role": "admin"},
    "user": {"pwd": "e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446", "name": "普通用户", "role": "user"},
}
js = js.replace("__USERS__", json.dumps(users, ensure_ascii=False))
js = js.replace("__DATA__", json.dumps(data, ensure_ascii=False))

with open("index.html", "r") as f:
    html = f.read()

first_script = html.find("<script>")
last_script_end = html.rfind("</script>")

if first_script >= 0 and last_script_end >= 0:
    before = html[:first_script]
    after = html[last_script_end + len("</script>"):]
    new_html = before + "<script>\n" + js + "\n</script>\n" + after
else:
    print("ERROR: no script tags")
    sys.exit(1)

with open("index.html", "w") as f:
    f.write(new_html)

count = new_html.count("<script>")
print(f"Done: {len(new_html)} bytes, {count} script block(s), {len(data)} records")
