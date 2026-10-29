#!/usr/bin/env python3
"""Create or update every lab page on the live site from content/lab-pages.json (idempotent).

Pages are matched by slug and parent. Parents are created first because the list is ordered.
Credentials come from ~/.config/wifi-pro-lab/wp.env and are never printed.
  python3 -I content/publish_lab.py            # publish what the JSON says
"""
import json, os, base64, urllib.request, urllib.error

BASE = "https://www.wifi-professionals.com/wp-json/wp/v2"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = dict(l.rstrip("\n").split("=", 1) for l in open(os.path.expanduser("~/.config/wifi-pro-lab/wp.env")) if "=" in l)
pw = env["WP_APP_PASSWORD"].strip().strip('"').strip("'").replace(" ", "")
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0",
     "Authorization": "Basic " + base64.b64encode(f"{env['WP_USER']}:{pw}".encode()).decode()}


def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=H)
    try:
        return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()[:300]}


pages = json.load(open(os.path.join(ROOT, "content", "lab-pages.json")))
ids = {}
for pg in pages:
    parent = ids[pg["parent"]] if pg["parent"] else 0
    found = call("GET", f"/pages?slug={pg['slug']}&parent={parent}&status=any&_fields=id")
    body = {"title": pg["title"], "slug": pg["slug"], "parent": parent, "status": pg["status"], "excerpt": pg["excerpt"],
            "content": pg["content"], "template": pg["template"], "menu_order": pg.get("order", 0)}
    if isinstance(found, list) and found:
        r = call("POST", f"/pages/{found[0]['id']}", body)
        verb = "updated"
    else:
        r = call("POST", "/pages", body)
        verb = "created"
    if "error" in r:
        print("ERR", pg["slug"], r)
        continue
    ids[pg["slug"]] = r["id"]
    print(f"{verb:8} {r['id']:>5}  {r['status']:8} {r['link']}")
json.dump(ids, open(os.path.join(ROOT, "content", "lab-page-ids.json"), "w"), indent=1)
