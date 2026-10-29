"""Creates/updates the 'Privacy and cookies' page ."""
import os, json, base64, urllib.request
HTML = '''<!-- wp:html -->
<p><em>Last updated: 17 October 2026.</em></p>
<p>This page explains what personal data Wi-Fi Professionals (wifi-professionals.com) collects, why, and the choices you have. The site is run by Zeeshan Haider in the United Kingdom.</p>
<h2>What we collect and why</h2>
<ul>
<li><strong>Analytics.</strong> With your consent we use Google Analytics (through Google Site Kit) to see how many people visit, which pages they read and roughly where they come from. This uses cookies and is provided by Google.</li>
<li><strong>Advertising.</strong> With your consent, Google AdSense shows ads and may use cookies to personalise them. Without consent, ads that are not personalised may still be shown.</li>
<li><strong>Comments.</strong> If you leave a comment we store your name, email address, website (if given), the comment and your IP address. Your email address is never shown publicly. Comments are checked for spam by Akismet, which receives this information for that purpose.</li>
<li><strong>Comment reply emails.</strong> If you tick the box to be told about replies, we use your email address only to send those notifications.</li>
<li><strong>Page view counts.</strong> A counter on the site records how many times a page is viewed. It sets a small first-party cookie (pvc_visits) to avoid counting the same visit twice. It does not identify you.</li>
<li><strong>Embedded videos.</strong> YouTube videos may set cookies when you play them.</li>
</ul>
<h2>Your choices</h2>
<ul>
<li>You can accept or refuse non-essential cookies in the banner shown on your first visit, and change your mind at any time through the privacy settings link or your browser settings.</li>
<li>You can see how Google uses data and opt out of personalised ads at <a href="https://adssettings.google.com/">adssettings.google.com</a>.</li>
<li>You can ask to see, correct or delete the personal data we hold about you, for example a comment, by using the comment form on the <a href="/about/">About page</a>.</li>
</ul>
<h2>Your rights</h2>
<p>Under UK data protection law you have the right to access, correct and erase your data, to object to its use and to complain to the Information Commissioner&rsquo;s Office at <a href="https://ico.org.uk/">ico.org.uk</a>.</p>
<h2>Third parties</h2>
<p>Data is processed by Google (analytics, advertising, YouTube) and Automattic (Akismet spam checking), and the site is hosted by Hostinger. Their own privacy policies apply to their handling of data.</p>
<!-- /wp:html -->'''
env = dict(l.rstrip("\n").split("=", 1) for l in open(os.path.expanduser("~/.config/wifi-pro-lab/wp.env")) if "=" in l)
pw = env["WP_APP_PASSWORD"].strip().replace(" ", "")
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0", "Authorization": "Basic " + base64.b64encode(f"{env['WP_USER']}:{pw}".encode()).decode()}
B = "https://www.wifi-professionals.com/wp-json/wp/v2/pages"
ex = json.load(urllib.request.urlopen(urllib.request.Request(B + "?slug=privacy-and-cookies&status=any", headers=H), timeout=60))
body = json.dumps({"title": "Privacy and cookies", "slug": "privacy-and-cookies", "content": HTML, "status": "publish"}).encode()
url = B + (f"/{ex[0]['id']}" if ex else "")
r = json.load(urllib.request.urlopen(urllib.request.Request(url, data=body, method="POST", headers=H), timeout=60))
print(r["id"], r["status"], r["link"])
