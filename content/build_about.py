#!/usr/bin/env python3
"""Rebuild the About page (id 996) as a wide, designed layout. The words are the author's own, kept as written;
only the layout is new. Run: python3 -I content/build_about.py   (credentials come from ~/.config/wifi-pro-lab/wp.env)"""
import json, os, base64, urllib.request

HTML = '''<!-- wp:html -->
<div class="about">
  <section class="about-hero">
    <div class="about-hero__text">
      <p class="about-eyebrow">About</p>
      <h1 class="about-title">Zeeshan Haider</h1>
      <p class="about-role">WiFi professional &middot; Muaythai fighter</p>
      <p class="about-lead">Greetings and welcome to WiFi-Professionals.com, a unique blog dedicated to empowering WiFi enthusiasts, whether professionals or simply enthusiasts eager to delve into the world of WiFi.</p>
      <p>I am Zeeshan Haider, a dedicated WiFi Professional and a passionate Muaythai fighter training at the renowned <a href="https://www.kocombatacademy.com/">KO Gym</a>.</p>
      <div class="about-actions"><a class="about-btn about-btn--solid" href="/lab/">Explore the Wi-Fi Pro Lab</a><a class="about-btn" href="/library/">Read the Library</a></div>
    </div>
    <figure class="about-hero__photo">
      <img src="https://www.wifi-professionals.com/wp-content/uploads/2019/08/ZEE.jpg" alt="A painted portrait of Zeeshan Haider in a Muaythai stance" width="392" height="539" />
      <figcaption>#REFUSE TO LOSE</figcaption>
    </figure>
  </section>

  <ul class="about-facts" aria-label="At a glance">
    <li><b>2015</b><span>First job as a junior WiFi engineer outside London</span></li>
    <li><b>MS Networking</b><span>Alongside a BS in Computing and an MBA in Information Management</span></li>
    <li><b>2018</b><span>Committed to the CWNE journey</span></li>
    <li><b>14 years</b><span>Of Muaythai, the art of 8 limbs</span></li>
  </ul>

  <section class="about-split">
    <div class="about-split__head">
      <p class="about-eyebrow">The story</p>
      <h2>From Hobby to Profession</h2>
    </div>
    <div class="about-split__body">
      <p>In 2015, fresh out of university with a degree in MS Networking, I found myself embarking on the job hunt journey. A job offer as a junior WiFi engineer outside London unexpectedly opened the doors to a world I hadn&rsquo;t initially planned for. As I started working with WiFi devices and troubleshooting issues, what began as a job soon transformed into a captivating hobby.</p>
      <p>After a year, I made the conscious decision to turn WiFi into my profession. The pivotal question arose: What does it take to become a proficient WiFi professional? The answer was clear:</p>
      <ol class="about-steps">
        <li><b>1</b><span>Accumulate extensive experience with relevant technology in real-world scenarios.</span></li>
        <li><b>2</b><span>Develop a strong theoretical foundation in the 802.11 standard.</span></li>
      </ol>
      <p>With this insight, my quest for knowledge in the realm of WiFi began. The internet became my treasure trove, offering a wealth of information waiting to be explored. Recognizing that various vendors provide certification paths, including the likes of Cisco and Microsoft, I contemplated whether, after completing my education (BS Computing/MBA Information Management and MS Networking), I needed to venture down the certification route to achieve my goal of becoming a WiFi professional.</p>
    </div>
  </section>

  <section class="about-band">
    <div class="about-band__year">2018</div>
    <div>
      <h2>CWNE journey: A defining moment in my career</h2>
      <p>Acknowledging a knowledge gap, I embarked on extensive research and sought guidance from my friend, Joe Statter. In 2018, I committed to the CWNE (Certified Wireless Network Expert) Journey. This journey marked a turning point as I immersed myself in the wealth of knowledge shared by CWNEs. Following like-minded individuals, engaging in conversations, asking questions, and staying motivated became integral to my continued growth.</p>
      <p><a href="/2018/04/cwne-journey/">Read the CWNE journey &rarr;</a></p>
    </div>
  </section>

  <section class="about-muay">
    <figure class="about-muay__photo"><img src="https://www.wifi-professionals.com/wp-content/uploads/2019/08/KNEE-MuayThai.jpg" alt="A Muaythai knee strike" width="837" height="558" /></figure>
    <div>
      <p class="about-eyebrow">Outside WiFi</p>
      <h2>MuayThai Boxing</h2>
      <p>Muaythai, the art of 8 limbs, holds a special place in my life. If I were to paint a picture of myself, Muaythai would undoubtedly be a prominent brushstroke. 14 years ago, I bid farewell to cricket and embraced the world of Muaythai. More than just a combat sport, Muaythai has been a source of courage, enabling me to step into the ring in front of hundreds. It has not only shaped my personal journey but has also proven instrumental in achieving milestones in both my personal and professional life.</p>
    </div>
  </section>

  <section class="about-cta">
    <h2>#REFUSE TO LOSE</h2>
    <p>At WiFi-Professionals.com, we embody the spirit of refusing to lose, both in the dynamic realm of WiFi and the challenging arena of Muaythai. Join us on this exciting journey of knowledge, growth, and resilience!</p>
    <div class="about-actions"><a class="about-btn about-btn--light" href="/lab/">Start in the Lab</a><a class="about-btn about-btn--ghost" href="/library/">Browse the Library</a><a class="about-btn about-btn--ghost" href="#respond">Get in touch</a></div>
  </section>
</div>
<!-- /wp:html -->
'''

if __name__ == "__main__":
    env = dict(l.rstrip("\n").split("=", 1) for l in open(os.path.expanduser("~/.config/wifi-pro-lab/wp.env")) if "=" in l)
    pw = env["WP_APP_PASSWORD"].strip().strip('"').strip("'").replace(" ", "")
    H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0", "Authorization": "Basic " + base64.b64encode(f"{env['WP_USER']}:{pw}".encode()).decode()}
    body = json.dumps({"content": HTML, "title": "About"}).encode()
    r = json.load(urllib.request.urlopen(urllib.request.Request("https://www.wifi-professionals.com/wp-json/wp/v2/pages/996", data=body, method="POST", headers=H), timeout=60))
    print("updated", r["id"], r["link"])
