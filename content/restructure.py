#!/usr/bin/env python3
"""Reorganise wifi-professionals.com: topic categories, Blog -> Library, About post -> About page.

Run in stages so each can be checked (credentials are read from ~/.config/wifi-pro-lab/wp.env, never printed):
  python3 -I content/restructure.py step1   # backup; create/rename categories; rename Blog page; create About page
  python3 -I content/restructure.py step3   # assign every post to its one topic category
  python3 -I content/restructure.py step4   # delete the old empty categories (only if they really are empty)
  python3 -I content/restructure.py step5   # draft the old About post and the off-topic StrikerZden post
The plan itself is in content/category-plan.json (post id -> category slug).
"""
import json, os, sys, base64, urllib.request, urllib.error

BASE = "https://www.wifi-professionals.com/wp-json/wp/v2"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = dict(l.rstrip("\n").split("=", 1) for l in open(os.path.expanduser("~/.config/wifi-pro-lab/wp.env")) if "=" in l)
pw = env["WP_APP_PASSWORD"].strip().strip('"').strip("'").replace(" ", "")
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0",
     "Authorization": "Basic " + base64.b64encode(f"{env['WP_USER']}:{pw}".encode()).decode()}


def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=H)
    try:
        return json.load(urllib.request.urlopen(req, timeout=90))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()[:300]}


NEW = {
    "standards-protocols": ("Standards & Protocols", "How 802.11 actually works: frames, handshakes, access methods and the amendments behind them."),
    "analysis-troubleshooting": ("Analysis & Troubleshooting", "Capturing, reading and explaining what happens on the air: Wireshark, reason codes, sticky clients and airtime."),
    "rf-design": ("RF & Design", "Radio fundamentals and planning: power, path loss, channels and coverage."),
    "resources-community": ("Resources & Community", "Tools, channels, kits and the Wi-Fi community, including the CWNE journey."),
}
RENAME = {  # existing category id -> (name, slug, description)
    4: ("Exam Prep", "exam-prep", "Study notes for the CWNP certifications: CWNA, CWSP, CWDP and CWAP."),
    9: ("Home Wi-Fi", "home-wifi", "Plain-English advice for better Wi-Fi at home."),
    10: ("News", "news", "Industry news and announcements."),
}
IDS_FILE = os.path.join(ROOT, "content", "restructure-ids.json")


def ids():
    return json.load(open(IDS_FILE)) if os.path.exists(IDS_FILE) else {}


def step1():
    posts, p = [], 1
    while True:
        r = call("GET", f"/posts?per_page=100&page={p}&status=any&_fields=id,status,sticky,categories,slug,title")
        posts += r
        if len(r) < 100:
            break
        p += 1
    cats = call("GET", "/categories?per_page=100&_fields=id,name,slug,count,description")
    os.makedirs(os.path.join(ROOT, "backups"), exist_ok=True)
    json.dump({"posts": posts, "categories": cats}, open(os.path.join(ROOT, "backups", "categories-before-restructure-2.json"), "w"), indent=1)
    print("backup saved:", len(posts), "posts,", len(cats), "categories")
    out = ids()
    for slug, (name, desc) in NEW.items():
        r = call("POST", "/categories", {"name": name, "slug": slug, "description": desc})
        if "error" in r and r.get("body", "").find("term_exists") >= 0:
            r = call("GET", f"/categories?slug={slug}")[0]
        print("category", slug, "->", r.get("id") or r)
        out[slug] = r.get("id")
    for cid, (name, slug, desc) in RENAME.items():
        r = call("POST", f"/categories/{cid}", {"name": name, "slug": slug, "description": desc})
        print("renamed", cid, "->", r.get("name"), r.get("slug") or r)
        out[slug] = cid
    r = call("POST", "/pages/10", {"title": "Library", "slug": "library"})
    print("page 10 ->", r.get("title", {}).get("rendered") or r, r.get("link"))
    about = call("GET", "/posts/701?context=edit&_fields=id,title,content,excerpt,featured_media")
    body = {"title": "About", "slug": "about", "status": "publish", "content": about["content"]["raw"], "excerpt": about["excerpt"]["raw"], "featured_media": about.get("featured_media") or 0}
    ex = call("GET", "/pages?slug=about&status=any&_fields=id,link")
    if isinstance(ex, list) and ex:
        r = call("POST", f"/pages/{ex[0]['id']}", body)
    else:
        r = call("POST", "/pages", body)
    print("About page ->", r.get("id") or r, r.get("link"))
    out["about_page"] = r.get("id")
    json.dump(out, open(IDS_FILE, "w"), indent=1)


def step3():
    plan = json.load(open(os.path.join(ROOT, "content", "category-plan.json")))["mapping"]
    out = ids()
    done = 0
    for pid, slug in plan.items():
        r = call("POST", f"/posts/{pid}", {"categories": [out[slug]]})
        if "error" in r:
            print("ERR", pid, r)
        else:
            done += 1
    print("posts assigned:", done, "of", len(plan))


def step4():
    for cid, slug in ((3, "general"), (5, "fun"), (8, "youtube-channels")):
        cur = call("GET", f"/categories/{cid}?_fields=id,slug,count")
        if cur.get("count", 1) == 0:
            r = call("DELETE", f"/categories/{cid}?force=true")
            print("deleted", slug, "->", r.get("deleted", r))
        else:
            print("NOT deleting", slug, "still has", cur.get("count"), "posts")


def step5():
    print("StrikerZden:", call("POST", "/posts/926", {"status": "draft", "sticky": False, "categories": [1]}).get("status"))
    print("old About post:", call("POST", "/posts/701", {"status": "draft"}).get("status"))


if __name__ == "__main__":
    {"step1": step1, "step3": step3, "step4": step4, "step5": step5}[sys.argv[1]]()
