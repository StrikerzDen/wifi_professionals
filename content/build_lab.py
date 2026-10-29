#!/usr/bin/env python3
"""Generate the Wi-Fi Pro Lab pages (hub + 2.4/5/6 GHz lessons) as WordPress block markup.

Output: content/lab-pages.json  (list of {slug, parent, title, template, status, excerpt, content}).
Run:    python3 -I content/build_lab.py
Style rules: British English; regulation is UK (Ofcom) first with US (FCC) one click away (handled by the
[wifi_lab] models, not by text in the page); only state figures that were checked against a source.
"""
import json, os, html

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lab-pages.json")


def esc(t):
    return html.escape(t, quote=False)


def p(t, cls=None):
    c = ' class="%s"' % cls if cls else ""
    a = ' {"className":"%s"}' % cls if cls else ""
    return "<!-- wp:paragraph%s --><p%s>%s</p><!-- /wp:paragraph -->\n" % (a, c, t)


def h2(step, title):
    return ('<!-- wp:heading --><h2 class="wp-block-heading"><span class="lab-step">%s</span>%s</h2><!-- /wp:heading -->\n' % (esc(step), esc(title)))


def h3(t):
    return '<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">%s</h3><!-- /wp:heading -->\n' % esc(t)


def ul(items, ordered=False):
    tag = "ol" if ordered else "ul"
    a = ' {"ordered":true}' if ordered else ""
    lis = "".join("<!-- wp:list-item --><li>%s</li><!-- /wp:list-item -->" % i for i in items)
    return '<!-- wp:list%s --><%s class="wp-block-list">%s</%s><!-- /wp:list -->\n' % (a, tag, lis, tag)


def callout(title, body):
    return ('<!-- wp:group {"className":"lab-callout"} --><div class="wp-block-group lab-callout">'
            '<!-- wp:paragraph --><p><strong>%s</strong> %s</p><!-- /wp:paragraph --></div><!-- /wp:group -->\n' % (esc(title), body))


def model(name, band=None, label=None):
    a = 'model="%s"' % name
    if band:
        a += ' band="%s"' % band
    if label:
        a += ' label="%s"' % label
    return '<!-- wp:shortcode -->[wifi_lab %s]<!-- /wp:shortcode -->\n' % a


def facts(items):
    cells = "".join('<div class="lab-fact"><b>%s</b><span>%s</span></div>' % (esc(a), esc(b)) for a, b in items)
    return '<!-- wp:html --><div class="lab-facts">%s</div><!-- /wp:html -->\n' % cells


def link(text, url):
    return '<a href="%s" rel="noopener">%s</a>' % (url, esc(text))


# ---------- shared references ----------
IEEE_TL = ("IEEE 802.11 Working Group: standards timelines (approval and publication dates)", "https://www.ieee802.org/11/Reports/802.11_Timelines.htm")
IEEE_WG = ("IEEE 802.11 Working Group", "https://www.ieee802.org/11/")
WFA_6E_NAME = ("Wi-Fi Alliance: \"Wi-Fi 6E\" name introduced (3 January 2020)", "https://www.wi-fi.org/news-events/newsroom/wi-fi-alliance-brings-wi-fi-6-into-6-ghz")
WFA_6E_CERT = ("Wi-Fi Alliance: Wi-Fi 6E certification programme (7 January 2021)", "https://www.wi-fi.org/news-events/newsroom/wi-fi-alliance-delivers-wi-fi-6e-certification-program")
WFA_7 = ("Wi-Fi Alliance: Wi-Fi CERTIFIED 7 (8 January 2024)", "https://www.wi-fi.org/news-events/newsroom/wi-fi-alliance-introduces-wi-fi-certified-7")
WFA_HIST = ("Wi-Fi Alliance: history", "https://www.wi-fi.org/history")
IEEE_STD = ("IEEE Std 802.11-2020 (IEEE Xplore)", "https://ieeexplore.ieee.org/document/9363693")
OFCOM_IR2030 = ("Ofcom: UK Interface Requirement 2030 (IR 2030), current edition", "https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/interface-requirements/ir-2030.pdf")
ETSI_328 = ("ETSI EN 300 328 (2.4 GHz harmonised standard)", "https://www.etsi.org/deliver/etsi_en/300300_300399/300328/02.02.02_60/en_300328v020202p.pdf")
ETSI_893 = ("ETSI EN 301 893 (5 GHz RLAN harmonised standard)", "https://www.etsi.org/deliver/etsi_en/301800_301899/301893/02.01.01_60/en_301893v020101p.pdf")
ETSI_687 = ("ETSI EN 303 687 (6 GHz WAS/RLAN harmonised standard)", "https://www.etsi.org/deliver/etsi_en/303600_303699/303687/01.01.01_60/en_303687v010101p.pdf")
OFCOM_IR2005 = ("Ofcom: UK Interface Requirement 2005 (2.4 GHz wideband systems)", "https://www.ofcom.org.uk/__data/assets/pdf_file/0026/84626/IR_2005.pdf")
OFCOM_5 = ("Ofcom: information sheet on 5 GHz RLANs (IR 2030)", "https://www.ofcom.org.uk/__data/assets/pdf_file/0019/136009/Ofcom-Information-Sheet-5-GHz-RLANs.pdf")
OFCOM_RLAN_6 = ("Ofcom: RLAN information sheet (IR 2030), lower 6 GHz section", "https://www.ofcom.org.uk/__data/assets/pdf_file/0019/136009/Ofcom-Information-Sheet-5-GHz-RLANs.pdf")
OFCOM_6 = ("Ofcom: expanding access to the 6 GHz band for mobile and Wi-Fi services", "https://www.ofcom.org.uk/spectrum/innovative-use-of-spectrum/consultation-expanding-access-to-the-6-ghz-band-for-commercial-mobile-and-wi-fi-services/")
FCC_2051 = ("FCC 20-51: unlicensed use of the 6 GHz band (23 April 2020)", "https://docs.fcc.gov/public/attachments/FCC-20-51A1.pdf")
ECFR15 = ("eCFR: 47 CFR 15.247 (US 2.4 GHz rules)", "https://www.ecfr.gov/current/title-47/section-15.247")
ECFR407 = ("eCFR: 47 CFR 15.407 (US 5 GHz U-NII rules)", "https://www.ecfr.gov/current/title-47/section-15.407")


def refs(items, note=None):
    out = h2("References", "Sources and further reading")
    out += ul(['%s' % link(t, u) for t, u in items])
    out += p(note or "IEEE standards are paid documents, so the link above goes to the publisher. Where a topic names a clause or table of IEEE Std 802.11-2020, its facts were checked against that clause; amendment dates come from the IEEE 802.11 Working Group's public timelines. Regulations change, so check the regulator for the current text.", "lab-refs")
    return out


def validate_block(extra_items):
    out = h2("Practical validation", "Prove it in a capture and on a spectrum analyser")
    out += p("Reading about a band is one thing; seeing it in your own evidence is the skill. These checks work with any monitor-mode capture:")
    out += ul(extra_items)
    return out


# ======================================================================
# 2.4 GHz
# ======================================================================
def page_24():
    c = ""
    c += model("region", label="Regulatory domain switch")
    c += p("The original Wi-Fi band: long reach, good penetration through walls, only three clean channels, and a lot of company. Understanding it properly is the key to troubleshooting almost every home network.", "lab-lead")
    c += facts([("83.5 MHz", "of spectrum (2400 to 2483.5 MHz)"), ("3", "non-overlapping 20 MHz channels"), ("about 12 cm", "wavelength"), ("1997", "first 802.11 standard")])

    c += h2("1. Definition", "What is the 2.4 GHz band?")
    c += p("2.4 GHz is a slice of radio spectrum from 2400 to 2483.5 MHz. It belongs to the <strong>ISM</strong> (industrial, scientific and medical) bands, which regulators leave open to licence-exempt use as long as devices stay within power and other limits. Wi-Fi shares it with Bluetooth, Zigbee and Thread, cordless phones, baby monitors and microwave ovens.")
    c += callout("Band, waveform, modulation, standard.", "Four different things get mixed up here. <em>2.4 GHz</em> is where the signal sits (a frequency band). <em>DSSS</em> and <em>OFDM</em> are waveforms (how the signal is built). <em>QPSK</em> and <em>64-QAM</em> are modulations (how bits map onto the signal). <em>802.11b, g, n, ax, be</em> are standards that define all of the above. One band can host many technologies, and one technology can work in several bands.")

    c += h2("2. Purpose", "Why Wi-Fi started here")
    c += ul([
        "<strong>Licence-free.</strong> Anyone can build and use a compliant radio without applying for spectrum, which is what let Wi-Fi become a consumer product.",
        "<strong>Good reach for the power.</strong> A wavelength of about 12 cm diffracts around obstacles and passes through walls well, so one access point covers a lot of floor area.",
        "<strong>Cheap radios.</strong> Silicon for this band was cheap and mature early on.",
        "<strong>The cost:</strong> very little spectrum. 83.5 MHz only fits a few wide channels, and everything else in the neighbourhood is using it too.",
    ])

    c += h2("3. Mechanism", "How the channels work")
    c += p("A Wi-Fi channel number is shorthand for a centre frequency: <strong>centre = 2407 + 5 x channel</strong> MHz. Channel 1 is 2412 MHz and channel 6 is 2437 MHz. Channels are spaced only 5 MHz apart, but a standard OFDM channel is about 20 MHz wide, so neighbouring channel numbers overlap heavily.")
    c += p("That overlap is why the sensible plan is channels <strong>1, 6 and 11</strong>. Two networks on the same channel can at least take turns, because each hears the other and waits (CSMA/CA). Two networks on partly overlapping channels cannot decode each other, so they simply add noise to one another and both slow down.")
    c += model("channels", "2.4", "2.4 GHz channel map")
    c += callout("Try this.", "(1) Switch between UK and US: the UK allows channels 1 to 13, the US only 1 to 11. (2) Look at the lower peaks: a network on channel 3 sits between 1 and 6 and wrecks both. (3) Notice why three is the practical maximum for 20 MHz channels, and why 40 MHz channels almost never make sense here.")

    c += h2("4. Visual", "Why wavelength matters")
    c += p("Radio waves travel at the speed of light, so wavelength = speed of light / frequency. At 2.4 GHz that is about 12 cm, a little longer than your hand. A wave this size bends around furniture and door frames, which is part of why 2.4 GHz coverage reaches into so many rooms.")
    c += model("waves", "2.4", "2.4 GHz wavelength")

    c += h2("5. Mathematics", "Path loss and the PHY rate")
    c += p("Even in empty space a signal weakens with distance. Free-space path loss (FSPL) is <strong>20 log10(d) + 20 log10(f) - 27.55</strong> dB, with d in metres and f in MHz. At 10 m in 2.4 GHz (channel 6, 2437 MHz) that is 20 + 67.7 - 27.55 = <strong>60.2 dB</strong>. Every doubling of distance adds 20 log10(2) = 6 dB, which means a quarter of the power: at 20 m the loss is 66.2 dB. Walls and furniture then come on top.")
    c += model("pathloss", "2.4", "2.4 GHz estimated signal against distance")
    c += p("The second formula turns a modulation choice into a speed. The PHY data rate of one link is <strong>(data subcarriers x bits per subcarrier x coding rate x streams) / symbol time</strong>. Try different generations below: you will see that 802.11g tops out at 54 Mbps because it has only 48 data subcarriers and 64-QAM, and why a 20 MHz 802.11ax stream reaches 143.4 Mbps.")
    c += model("phyrate", "2.4", "PHY rate calculator for 2.4 GHz generations")

    c += h2("6. Generations over time", "Which Wi-Fi standards work in 2.4 GHz")
    c += p("Only the standards that define 2.4 GHz operation are shown: the original 802.11 (1997), 802.11b, 802.11g, 802.11n, 802.11ax and 802.11be. Click through to see the waveform, modulation, width and headline speed of each, with the date the standard was approved.")
    c += model("timeline", "2.4", "2.4 GHz generations timeline")
    c += callout("Go deeper.", "The timeline names the waveform each generation used: DSSS, CCK and OFDM. How those are built has its own track: <a href=\"/lab/modulation/\">Modulation and waveforms</a>. A 2.4 GHz network that still allows the old 1, 2, 5.5 and 11 Mbit/s rates is forced to run the slow DSSS/CCK waveforms for its management traffic and to protect them from newer devices, which is very costly in airtime.")

    c += h2("7. Rules and regulations", "What the law allows in this band")
    c += p("Radio rules decide which channels you can use and how much power you may radiate, so they are part of the engineering. Each domain below starts with who sets the rules, then the limits. It opens on the UK (Ofcom); switch to the EU (CEPT and ETSI) or the US (FCC).")
    c += model("regrules", "2.4", "2.4 GHz rules: UK Ofcom and US FCC")

    c += h2("8. Real-world behaviour", "What goes wrong in 2.4 GHz")
    c += ul([
        "<strong>Neighbours.</strong> In flats and terraces, you may hear a dozen networks on three channels. Airtime, not signal strength, becomes the bottleneck.",
        "<strong>Non-Wi-Fi interference.</strong> Bluetooth hops across 79 channels of 1 MHz; Zigbee and Thread use narrow 802.15.4 channels; microwave ovens leak noise around 2.45 GHz; cordless phones and video senders can occupy a lot of the band. A Wi-Fi radio cannot always tell these apart from bad luck.",
        "<strong>Legacy overhead.</strong> Old 802.11b data rates (1, 2, 5.5 and 11 Mbps) are very slow. A beacon of about 300 bytes sent at 1 Mbps takes roughly 2.6 ms of airtime; at 6 Mbps about 0.4 ms. Beacons go out every 102.4 ms for each SSID, so 10 SSIDs at 1 Mbps can burn about a quarter of the channel before any user traffic. Disabling the lowest rates is one of the cheapest fixes there is.",
        "<strong>Mixed mode.</strong> If an 802.11b client is present, newer devices use protection mechanisms (such as CTS-to-self) so the old device can hear them, which costs throughput for everyone.",
        "<strong>IoT devices.</strong> Many smart-home devices support 2.4 GHz only, so the band cannot simply be switched off.",
    ])

    c += validate_block([
        "Beacons only: <code>wlan.fc.type_subtype == 0x0008</code>",
        "Everything on one channel: <code>wlan_radio.channel == 6</code> (or by frequency: <code>wlan_radio.frequency == 2437</code>)",
        "Retries, a sign of a congested or interfered channel: <code>wlan.fc.retry == 1</code>",
        "Channel announced in the beacon (DS Parameter Set): <code>wlan.ds.current_channel</code>",
        "Which waveform was used? Look at the PHY type and data rate in the radio information: <code>wlan_radio.phy</code> and <code>wlan_radio.data_rate</code>. Frames at 1, 2, 5.5 or 11 Mbit/s are DSSS or CCK; 6 to 54 Mbit/s frames are OFDM.",
        "On a spectrum analyser, compare <em>duty cycle</em> with <em>noise floor</em>. High duty cycle at a steady level means busy Wi-Fi; a raised floor or a pulsing shape points to a non-Wi-Fi interferer.",
        "Question to answer: with the same client and AP, how do retry rate and throughput change between channel 1, a clean channel, and channel 3, between two neighbours?",
    ])

    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "2.4", "2.4 GHz quiz")
    c += refs([IEEE_STD, IEEE_TL, IEEE_WG, OFCOM_IR2030, ETSI_328, ECFR15, WFA_HIST])
    return c


# ======================================================================
# 5 GHz
# ======================================================================
def page_5():
    c = ""
    c += model("region", label="Regulatory domain switch")
    c += p("Many channels, wide channels, and a set of rules (DFS) that sets it apart. This is the band where most modern Wi-Fi performance is won or lost.", "lab-lead")
    c += facts([("25", "20 MHz channels (36 to 165)"), ("160 MHz", "widest channel, only two fit"), ("about 5.5 cm", "wavelength"), ("1999", "802.11a, the first 5 GHz Wi-Fi")])

    c += h2("1. Definition", "What is the 5 GHz band?")
    c += p("5 GHz Wi-Fi uses several separate blocks of spectrum between roughly 5150 and 5850 MHz. It is not one tidy band: each block has its own rules. The UK calls them Bands A, B and C; the US calls them U-NII-1, 2A, 2C and 3. Both end up with the same channel numbers, but the rules around those channels differ.")
    c += callout("Not a standard.", "\"5 GHz\" is not a Wi-Fi generation. 802.11a, n, ac, ax and be can all run here (and 802.11ac runs <em>only</em> here). What changed between them is the waveform, the modulation and the allowed channel widths, not the band.")

    c += h2("2. Purpose", "Why move to 5 GHz?")
    c += ul([
        "<strong>Room.</strong> Hundreds of MHz of spectrum, so many non-overlapping channels and room for 40, 80 and 160 MHz widths.",
        "<strong>Less crowding.</strong> Few non-Wi-Fi devices use it, so interference is mostly from other Wi-Fi.",
        "<strong>Smaller cells.</strong> At about 5.5 cm the waves are absorbed and blocked by walls, which limits how far a signal travels. That limits range, but it also limits how far your neighbours' signals reach you, and small cells are a feature in dense deployments.",
    ])

    c += h2("2b. Rules first", "Why 5 GHz has radar rules")
    c += p("The 5 GHz blocks are shared with other services, including weather and military radar and some satellite links. To protect them, regulators require <strong>Dynamic Frequency Selection (DFS)</strong>: the access point must listen before using a channel, and leave if it detects radar. <strong>Transmit Power Control (TPC)</strong> keeps power no higher than needed. The standards support came from IEEE 802.11h (approved in 2003). In the UK, DFS applies in 5250 to 5350 MHz and 5470 to 5730 MHz, and channels 52 to 64 (5250 to 5350 MHz) are <strong>indoor-only</strong>. Channels 36 to 48 (5150 to 5250 MHz) were liberalised in 2023: they may be used outdoors, but not as part of a fixed outdoor installation.")

    c += h2("3. Mechanism", "How the channels work")
    c += p("Channel number to frequency is <strong>centre = 5000 + 5 x channel</strong> MHz. The 20 MHz channels are four numbers apart (36, 40, 44, 48) so they do not overlap. Wider channels bond adjacent 20 MHz channels: 40 MHz takes two, 80 MHz takes four and 160 MHz takes eight. The primary 20 MHz channel is where beacons live and where devices contend for the medium.")
    c += model("channels", "5", "5 GHz channel map")
    c += callout("Try this.", "(1) Raise the width from 20 to 160 MHz and watch the channel count fall from 25 to 2, so width is traded for room. (2) Check how many of those wide channels need DFS. (3) With the UK selected, see which channels have a dashed outline: those are indoor-only. (4) Switch to US and compare.")

    c += h2("4. Visual", "Wavelength and reach")
    c += model("waves", "5", "5 GHz wavelength")

    c += h2("5. Mathematics", "Path loss and PHY rate")
    c += p("At 10 m the free-space loss at 5.5 GHz (channel 100) is 20 + 74.8 - 27.55 = <strong>67.3 dB</strong>, and every doubling of distance adds another 6 dB. In practice walls add loss on top, so coverage per access point is limited. What 5 GHz pays back is rate: wider channels have more data subcarriers, so rate scales roughly with width.")
    c += model("pathloss", "5", "5 GHz estimated signal against distance")
    c += p("Try 802.11ac at 80 MHz, MCS 9, one stream, short guard interval: 234 x 8 x 5/6 / 3.6 = <strong>433.3 Mbps</strong>. Now take it to 160 MHz and four streams.")
    c += model("phyrate", "5", "PHY rate calculator for 5 GHz generations")

    c += h2("6. Techniques over time", "From 802.11a to Wi-Fi 7")
    c += model("timeline", "5", "5 GHz generations timeline")
    c += callout("Go deeper.", "Every generation in this band builds its signal with OFDM (and, from Wi-Fi 6, OFDMA). The <a href=\"/lab/modulation/ofdm/\">OFDM topic</a> shows step by step how bits become subcarriers.")
    c += ul([
        "<strong>OFDM (1999).</strong> The first Wi-Fi OFDM: 48 data subcarriers, 64-QAM, 54 Mbps in 20 MHz.",
        "<strong>DFS and TPC (2003).</strong> Regulatory plumbing added by 802.11h.",
        "<strong>MIMO and bonding (2009).</strong> 40 MHz channels and up to four streams.",
        "<strong>VHT (2013).</strong> 80 and 160 MHz channels, 256-QAM, downlink multi-user MIMO.",
        "<strong>HE and EHT (2021, 2024).</strong> OFDMA, 1024-QAM then 4096-QAM, and multi-link operation across bands.",
    ])

    c += h2("7. Rules and regulations", "UK Ofcom first, then the EU and the US")
    c += p("This is where 5 GHz is most confusing, because the UK and the US use the same channel numbers with different rules. Start with the UK, then switch to the EU and the US.")
    c += model("regrules", "5", "5 GHz rules: UK Ofcom and US FCC")

    c += h2("8. Real-world behaviour", "What goes wrong in 5 GHz")
    c += ul([
        "<strong>DFS events.</strong> When radar is detected, the AP must leave the channel and stay off it for a period (at least 30 minutes under the FCC rule). Clients see a sudden disconnect, which can look like a random fault. Before using a DFS channel the AP must also listen first (the channel availability check; the FCC rule is 60 seconds). That is why an AP can take a minute or more to start up on some channels. The FCC rule also gives an AP 10 seconds to stop transmitting after radar is detected.",
        "<strong>Client support.</strong> Some older or low-cost client radios do not support DFS channels, so a network on channel 100 can look invisible to them.",
        "<strong>Wide-channel fragility.</strong> A 160 MHz channel uses up the whole main plan and needs DFS channels, so it fails (or falls back to 80 MHz) whenever radar is seen or neighbours overlap.",
        "<strong>Range.</strong> Walls absorb 5 GHz signals strongly, so coverage per access point is limited, and a client far from its AP drops to a low MCS quickly.",
    ])
    c += validate_block([
        "Which channel and width is the AP really using? Look at the beacon's HT/VHT/HE Operation elements, not just the settings page.",
        "Channel by frequency: <code>wlan_radio.frequency == 5500</code> or by number: <code>wlan_radio.channel == 100</code>",
        "Retries: <code>wlan.fc.retry == 1</code>, compared at 20, 40 and 80 MHz on the same link.",
        "Reduced Neighbor Report elements, with which an AP advertises its other bands: <code>wlan.tag.number == 201</code>",
        "DFS evidence: look for a channel switch announcement (<code>wlan.tag.number == 37</code>) in beacons after a radar event.",
        "Question to answer: at what distance and through how many walls does a 5 GHz client drop from its top MCS to its lowest usable one?",
    ])

    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "5", "5 GHz quiz")
    c += refs([IEEE_STD, IEEE_TL, IEEE_WG, OFCOM_IR2030, ETSI_893, ECFR407, WFA_HIST])
    return c


# ======================================================================
# 6 GHz
# ======================================================================
def page_6():
    c = ""
    c += model("region", label="Regulatory domain switch")
    c += p("New spectrum with no legacy devices in it. How much of it you get depends heavily on where you are, which makes 6 GHz the clearest example of why regulation is part of Wi-Fi engineering.", "lab-lead")
    c += facts([("500 MHz", "UK lower 6 GHz: 5925 to 6425 MHz"), ("1,200 MHz", "US: 5925 to 7125 MHz"), ("320 MHz", "widest channel (Wi-Fi 7)"), ("about 4.8 cm", "wavelength")])

    c += h2("1. Definition", "What is the 6 GHz band?")
    c += p("6 GHz Wi-Fi is the use of the 5925 to 7125 MHz range, which regulators have opened in pieces. The UK made 5925 to 6425 MHz (the lower 6 GHz band) available for licence-exempt Wi-Fi. The US made the whole 1,200 MHz available. Wi-Fi in 6 GHz is called Wi-Fi 6E when it is 802.11ax, and 802.11be (Wi-Fi 7) also uses it.")
    c += callout("6E is not a new standard.", "The Wi-Fi Alliance introduced the name \"Wi-Fi 6E\" on 3 January 2020 for 802.11ax devices that also operate in 6 GHz, and started 6E certification on 7 January 2021. The \"E\" stands for extended, not for a new PHY.")

    c += h2("2. Purpose", "What problem does 6 GHz solve?")
    c += ul([
        "<strong>Spectrum.</strong> A large block of new spectrum with room for many channels, including very wide ones.",
        "<strong>A clean start.</strong> Only 802.11ax and later (HE and EHT) devices may operate in 6 GHz, so no legacy 802.11a/b/g/n/ac devices, no slow beacons and no protection overhead.",
        "<strong>Mandatory modern security.</strong> Wi-Fi Alliance certification requires WPA3 in 6 GHz, with protected management frames.",
        "<strong>The cost:</strong> short waves, so limited reach through buildings, and fewer compatible client devices.",
    ])

    c += h2("3. Mechanism", "Channels, discovery and power classes")
    c += p("Channel numbers run <strong>centre = 5950 + 5 x channel</strong> MHz, with 20 MHz channels every fourth number (1, 5, 9 ... 233 in the US). Widths go up to 320 MHz. Because there are so many channels, clients cannot afford to scan them all. Three discovery tools fix that:")
    c += ul([
        "<strong>Preferred scanning channels (PSC).</strong> Every 16th channel (5, 21, 37 ... 229) is a PSC, and clients scan those first.",
        "<strong>Out-of-band discovery.</strong> An access point's radios in other bands announce its 6 GHz radio in the Reduced Neighbor Report element.",
        "<strong>In-band discovery.</strong> Where a 6 GHz AP does not use a PSC, it can send FILS discovery frames or unsolicited probe responses so clients find it faster than waiting for a beacon.",
    ])
    c += model("channels", "6", "6 GHz channel map")
    c += callout("Try this.", "(1) UK first: only 24 channels fit in 5945 to 6425 MHz at 20 MHz, and just one 320 MHz channel fits. (2) Now US: 59 channels and three 320 MHz channels. (3) At 20 MHz, spot the PSC channels. (4) Notice how few wide channels the UK band holds: this is why regulation matters for design.")

    c += h2("4. Visual", "How short a 6 GHz wave is")
    c += model("waves", "6", "6 GHz wavelength")

    c += h2("5. Mathematics", "Path loss, width and rate")
    c += p("At 10 m the free-space loss at 6.2 GHz (channel 49) is 20 + 75.8 - 27.55 = <strong>68.3 dB</strong>, and every doubling of distance adds another 6 dB. Walls and floors add loss on top, which is why real-world reach is the main limit. What 6 GHz pays back is width: a 320 MHz EHT channel has 3,920 data subcarriers. One stream of 4096-QAM 5/6 with a 0.8 microsecond guard interval is 3920 x 12 x 5/6 / 13.6 = <strong>2,882.4 Mbps</strong>.")
    c += model("pathloss", "6", "6 GHz estimated signal against distance")
    c += model("phyrate", "6", "PHY rate calculator for 6 GHz generations")

    c += h2("6. Techniques over time", "From rules to Wi-Fi 7")
    c += p("6 GHz has a short history, and most of it is regulatory. The timeline below changes with your regulatory domain: UK steps first, with the US available on click.")
    c += model("timeline", "6", "6 GHz timeline")
    c += callout("Go deeper.", "The waveform here is OFDM with OFDMA. The <a href=\"/lab/modulation/ofdm/\">OFDM topic</a> shows step by step how bits become subcarriers.")
    c += ul([
        "<strong>HE (Wi-Fi 6E).</strong> OFDMA, 1024-QAM, and up to 160 MHz.",
        "<strong>EHT (Wi-Fi 7).</strong> 4096-QAM, 320 MHz channels and multi-link operation. Wi-Fi CERTIFIED 7 was announced on 8 January 2024.",
        "<strong>UHR (Wi-Fi 8, in progress).</strong> The 802.11bn project is focused on reliability and coordination. It is not final, so treat what you read about it as provisional.",
    ])

    c += h2("7. Rules and regulations", "UK Ofcom first, then the EU and the US")
    c += p("The rules for 6 GHz differ most between the UK and the US. The UK and the EU have low-power indoor (LPI) and very low power (VLP) classes in the lower band. The US has indoor low-power, and standard-power operation under AFC. Switch between the three domains to compare.")
    c += model("regrules", "6", "6 GHz rules: UK Ofcom and US FCC")

    c += h2("8. Real-world behaviour", "What goes wrong in 6 GHz")
    c += ul([
        "<strong>Client coverage.</strong> A phone that supports 6 GHz may still not support 320 MHz, and a client that reaches 6 GHz in one country may have it disabled in another because of the regulatory domain it was built for.",
        "<strong>Range.</strong> A 6 GHz signal that has crossed two walls is often weak enough that a client falls back to another band. Test with a real handset, not an access point's spec sheet.",
        "<strong>Discovery.</strong> A 6 GHz radio on a non-PSC channel may be slow to appear, because clients scan PSCs first.",
        "<strong>Power class.</strong> A low-power indoor AP is not allowed outside, and a very-low-power device has a power budget a tenth of a low-power indoor access point's.",
        "<strong>Marketing versus reality.</strong> \"Wi-Fi 6E\" or \"Wi-Fi 7\" on a box says what the radio can do, not what the regulator in your country permits.",
    ])
    c += validate_block([
        "Which band is a client on? <code>wlan_radio.frequency &gt; 5900</code>",
        "Out-of-band discovery, in a beacon from the AP's other radios: <code>wlan.tag.number == 201</code> (Reduced Neighbor Report).",
        "Security: 6 GHz networks should show WPA3-SAE or OWE and protected management frames in the beacon's RSN element.",
        "Check which standard the client negotiated: look for HE or EHT capabilities in the association request.",
        "Question to answer: with one AP, at what distance and through how many walls does a phone leave 6 GHz?",
    ])

    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "6", "6 GHz quiz")
    c += refs([IEEE_TL, IEEE_WG, WFA_6E_NAME, WFA_6E_CERT, WFA_7, OFCOM_IR2030, OFCOM_6, ETSI_687, FCC_2051])
    return c


# ======================================================================
# Hub
# ======================================================================
def hub():
    c = ""
    c += p("Interactive models that show how Wi-Fi really works. Move the sliders, watch the physics change, then see what it means on real equipment. Everything on regulation starts with the UK (Ofcom) and switches to the EU or the US with one click.", "lab-lead")
    c += callout("New to radio?", "Start with <a href=\"/lab/foundations/\">Foundations</a>: waves, interference and decibels, in two short topics.")
    c += h2("Start here", "The three Wi-Fi bands")
    c += ('<!-- wp:html --><div class="lab-cards">'
          '<a class="lab-card" href="/lab/2-4-ghz/"><em>The original band</em><b>2.4 GHz</b><span>Channels, overlap, and why it is so crowded.</span></a>'
          '<a class="lab-card" href="/lab/5-ghz/"><em>The wide band</em><b>5 GHz</b><span>Wide channels, DFS and radar, and the rules that differ by country.</span></a>'
          '<a class="lab-card" href="/lab/6-ghz/"><em>The new band</em><b>6 GHz</b><span>Wi-Fi 6E and 7: new spectrum, discovery, and how much depends on where you are.</span></a>'
          '</div><!-- /wp:html -->\n')
    c += h2("How every topic works", "The same seven parts, every time")
    c += p("Each topic in the lab is written the same way, so you always know where to look. Read straight through, or jump to the part you need.")
    c += ul([
        "<strong>Definition:</strong> what it is, with the terms and the common mix-ups.",
        "<strong>Purpose:</strong> why it exists and what problem it solves.",
        "<strong>Mechanism:</strong> how it works, with a model you can play with.",
        "<strong>Visual explanation:</strong> waveforms, channel maps, timelines.",
        "<strong>Mathematics:</strong> the equations, with worked examples and calculators.",
        "<strong>Real-world behaviour:</strong> what it looks like on actual equipment and how it fails.",
        "<strong>Practical validation:</strong> Wireshark filters, spectrum views and questions to answer yourself.",
    ], ordered=True)
    c += callout("Sources.", "Every topic ends with its references: IEEE 802.11, the Wi-Fi Alliance, and the regulators (Ofcom, ETSI and the FCC). Regulation always opens on the UK and switches to the EU or the US.")

    c += h2("The book", "Where the lab is going")
    c += p("The lab is being built as one book, from the physics of radio waves up to measurement and validation. Open a part to see its topics. Live topics are links; the others are planned and will appear in this order.")

    def topic(title, href=None, blurb="", era=""):
        if href:
            return '<li class="is-live"><a href="%s"><b>%s</b><span>%s</span></a><i class="lab-live">Live</i></li>' % (href, esc(title), esc(blurb))
        return '<li class="is-soon"><div><b>%s</b><span>%s</span></div><i class="lab-soon">Planned</i></li>' % (esc(title), esc(blurb))

    parts = [
        ("Foundations", "Waves, decibels and how a signal travels.", "/lab/foundations/", False, [
            topic("Waves and frequency", "/lab/foundations/waves/", "Frequency, wavelength, phase and interference."),
            topic("Decibels and power", "/lab/foundations/decibels/", "dB, dBm and dBi, and adding gains and losses."),
            topic("RF propagation and antennas", "/lab/foundations/propagation/", "Path loss, link budgets, antenna patterns and the Fresnel zone."),
        ]),
        ("Frequency bands", "Where Wi-Fi lives, and what each band allows.", None, False, [
            topic("2.4 GHz", "/lab/2-4-ghz/", "Channels and overlap, generations, rules."),
            topic("5 GHz", "/lab/5-ghz/", "Wide channels, DFS and radar, rules."),
            topic("6 GHz", "/lab/6-ghz/", "New spectrum, discovery, power classes, rules."),
        ]),
        ("Modulation and waveforms", "How bits become a radio wave.", "/lab/modulation/", False, [
            topic("DSSS", "/lab/modulation/dsss/", "Spreading each bit over a code."),
            topic("FHSS", "/lab/modulation/fhss/", "Hopping across 79 channels."),
            topic("CCK", "/lab/modulation/cck/", "Letting the data choose an 8-chip code word."),
            topic("OFDM", "/lab/modulation/ofdm/", "Subcarriers, the IFFT and the guard interval."),
            topic("QAM constellations", "/lab/modulation/qam/", "From BPSK to 4096-QAM, noise and errors."),
            topic("OFDMA and resource units", "/lab/modulation/ofdma/", "Sharing one channel between several clients."),
            topic("MIMO and beamforming", "/lab/modulation/mimo/", "Spatial streams and steering a beam."),
        ]),
        ("How Wi-Fi shares the air", "The protocol that decides who talks when.", "/lab/protocol/", False, [
            topic("802.11 MAC and channel access", "/lab/protocol/mac/", "CSMA/CA, backoff, hidden nodes and airtime."),
            topic("QoS and WMM", "/lab/protocol/qos/", "Four waiting lines and the priority label on every packet."),
            topic("Frames and the MAC header", "/lab/protocol/frames/", "Every field of the header of each protocol, with sizes and bits."),
            topic("Wi-Fi generations", "/lab/protocol/generations/", "What changed from 802.11b to Wi-Fi 7."),
        ]),
        ("Connecting and coexisting", "Joining, moving between access points, and sharing spectrum.", "/lab/connecting/", False, [
            topic("Association, security and roaming", "/lab/connecting/association/", "From probe to handshake to handover."),
            topic("Coexistence and regulations", "/lab/connecting/coexistence/", "Interference, CCA and the UK, EU and US rules."),
        ]),
        ("Measuring and validating", "Proving what the network really does.", "/lab/measurement/", False, [
            topic("Measurement, troubleshooting and QoE", "/lab/measurement/troubleshooting/", "Signal, noise, SNR, retries and user experience."),
            topic("Validation and practical engineering", "/lab/measurement/engineering/", "Capacity planning, surveys and test plans."),
        ]),
    ]
    html = '<div class="lab-book">'
    for name, blurb, href, collapsed, items in parts:
        live = sum(1 for i in items if 'is-live' in i)
        head = '<span class="lab-part__n"></span><span class="lab-part__name">%s</span><span class="lab-part__blurb">%s</span><span class="lab-part__count">%s</span>' % (
            esc(name), esc(blurb), ('%d live' % live) if live else 'planned')
        more = '<p class="lab-part__more"><a href="%s">Open the %s overview &rarr;</a></p>' % (href, esc(name)) if href else ''
        html += '<details class="lab-part"%s><summary>%s</summary><ol class="lab-topics">%s</ol>%s</details>' % (' open' if live else '', head, "".join(items), more)
    html += '</div>'
    c += '<!-- wp:html -->%s<!-- /wp:html -->\n' % html
    c += callout("About accuracy.", "Dates come from the IEEE 802.11 Working Group's public timelines and the Wi-Fi Alliance; regulatory limits come from Ofcom and the FCC. Every topic lists its sources at the bottom. If you spot a mistake, please tell me and I will fix it.")
    return c



# ======================================================================
# Modulation and waveforms track
# ======================================================================
def mod_hub():
    c = ""
    c += p("Bands tell you where a signal sits. This track is about what the signal <em>is</em>: how bits become a radio wave, why each technique was invented, and what it looks like when it goes wrong. Each topic is about one technique only, so you can go as deep as you like without losing the thread.", "lab-lead")
    c += h2("The vocabulary", "Five words people mix up")
    c += ('<!-- wp:html --><div class="lab-tablewrap"><table class="lab-table"><thead><tr><th scope="col">Term</th><th scope="col">What it is</th><th scope="col">Examples</th></tr></thead><tbody>'
          '<tr><th scope="row">Frequency band</th><td>Where the signal sits in the spectrum</td><td>2.4, 5 and 6 GHz</td></tr>'
          '<tr><th scope="row">Waveform (PHY technique)</th><td>How the signal is built in time and frequency</td><td>DSSS, FHSS, CCK, OFDM</td></tr>'
          '<tr><th scope="row">Modulation</th><td>How bits are mapped onto phase and amplitude</td><td>DBPSK, DQPSK, BPSK, QPSK, QAM</td></tr>'
          '<tr><th scope="row">Coding</th><td>Extra bits added so errors can be corrected</td><td>Convolutional coding, LDPC</td></tr>'
          '<tr><th scope="row">Standard (amendment)</th><td>The document that defines all of the above for one generation</td><td>802.11b, g, n, ac, ax, be</td></tr>'
          '</tbody></table></div><!-- /wp:html -->\n')
    c += callout("The common mistake.", "\"2.4 GHz\" is a band, not a modulation. \"OFDM\" is a waveform, not a standard. \"802.11ax\" is a standard, not a band. When a question mixes these up, it usually cannot be answered until they are pulled apart.")
    c += h2("The path", "From bits to radio")
    c += ul(["<strong>Bits</strong> from the MAC layer.", "<strong>Coding</strong> adds protection (not all waveforms use it).", "<strong>Modulation</strong> turns bits into phase and amplitude values.", "<strong>The waveform</strong> arranges those values in time and frequency: spread over chips, hopped across channels, or spread over subcarriers.", "<strong>The radio</strong> sends the result on the band and channel the regulator allows."], ordered=True)
    c += h2("Topics", "Start with any of these")
    c += ('<!-- wp:html --><div class="lab-cards">'
          '<a class="lab-card" href="/lab/modulation/dsss/"><em>802.11 and 802.11b</em><b>DSSS</b><span>Spreading with a code, processing gain and why 1 and 2 Mbit/s are so robust.</span></a>'
          '<a class="lab-card" href="/lab/modulation/fhss/"><em>802.11-1997 only</em><b>FHSS</b><span>Hopping across channels, and where the idea lives on today.</span></a>'
          '<a class="lab-card" href="/lab/modulation/cck/"><em>802.11b</em><b>CCK</b><span>How 8 bits choose one of 256 code words: 11 Mbit/s without a wider channel.</span></a>'
          '<a class="lab-card" href="/lab/modulation/ofdm/"><em>802.11a, g and later</em><b>OFDM</b><span>Subcarriers, orthogonality, the IFFT and the guard interval, step by step.</span></a>'
          '<a class="lab-card" href="/lab/modulation/qam/"><em>802.11a to 802.11be</em><b>QAM</b><span>Constellations from BPSK to 4096-QAM, and what noise does to them.</span></a>'
          '<a class="lab-card" href="/lab/modulation/ofdma/"><em>802.11ax and 802.11be</em><b>OFDMA</b><span>Resource units: sharing one channel between several clients.</span></a>'
          '<a class="lab-card" href="/lab/modulation/mimo/"><em>802.11n and later</em><b>MIMO</b><span>Spatial streams, beamforming and multi-user MIMO.</span></a>'
          '</div><!-- /wp:html -->\n')
    return c


def lesson_dsss():
    c = ""
    c += p("How a signal can be made deliberately wider so that noise and interference barely notice it. This is the radio of the original 802.11 standard and of 802.11b.", "lab-lead")
    c += facts([("11 chips", "per symbol (Barker code)"), ("11 Mchip/s", "chip rate"), ("10.4 dB", "processing gain"), ("1 and 2 Mbit/s", "the Barker-coded rates")])
    c += callout("In plain words.", 'Imagine you and a friend share a secret knocking rhythm. In a noisy playground you ignore everything else and listen only for your rhythm. DSSS does the same with radio: every bit is sent as a long secret pattern, and the receiver listens only for that pattern, so other noise fades away.')
    c += model('journeydsss', 'dsss', 'Watch it happen: DSSS')
    c += h2("1. Definition", "What is direct-sequence spread spectrum?")
    c += p("DSSS multiplies every data symbol by a fast, fixed pattern of +1 and -1 values called a <strong>spreading code</strong>. Each value in the code is a <strong>chip</strong>, and the rate at which chips are sent is the <strong>chip rate</strong>. Because several chips are sent for every symbol, the signal needs far more bandwidth than the data alone would: that is the <em>spreading</em>. The number of chips per symbol is the spreading factor, and the benefit it brings is the <strong>processing gain</strong>.")
    c += callout("Spreading is not modulation.", "Modulation (here DBPSK or DQPSK) decides how bits become phase. Spreading is applied afterwards, to the modulated symbols. They are separate steps, which is why a receiver has to undo both.")
    c += h2("2. Purpose", "Why 802.11 started here")
    c += ul(["<strong>Interference tolerance.</strong> The band is licence-exempt, so unknown interferers are certain. A narrowband interferer is spread out by the receiver's despreading and mostly vanishes.",
             "<strong>Low power density.</strong> The energy is spread over about 22 MHz, so at any single frequency the signal is weak, which suits rules written for spread-spectrum devices.",
             "<strong>Robustness at low speed.</strong> 1 and 2 Mbit/s are slow but reach far, so they became the basic rates that every device could always fall back to."])
    c += h2("3. Mechanism", "Step by step")
    c += ul(["<strong>Encode:</strong> at 1 Mbit/s each bit is encoded differentially (DBPSK): a 1 flips the phase of the next symbol, a 0 leaves it unchanged. At 2 Mbit/s two bits choose one of four phase changes (DQPSK).",
             "<strong>Spread:</strong> every symbol is multiplied by the 11-chip Barker code, +1 -1 +1 +1 -1 +1 +1 +1 -1 -1 -1, sent at 11 million chips a second. One 1-microsecond symbol becomes 11 chips of about 91 nanoseconds.",
             "<strong>Receive:</strong> multiply what arrives by the same code and add up the 11 chips. The wanted signal adds in step to +11 or -11; noise and interference do not."], ordered=True)
    c += model("dsss", "dsss", "DSSS: spreading and despreading")
    c += h2("4. Visual", "Why the Barker code")
    c += p("A spreading code is only useful if it matches itself perfectly and nothing else. The 11-chip Barker code was chosen because of how it correlates with shifted copies of itself: one tall peak, and only tiny values everywhere else.")
    c += model("barker", "dsss", "Barker-11 correlation")
    c += h2("5. Mathematics", "Processing gain and bandwidth")
    c += ul(["Processing gain = 10 log10(chips per symbol) = 10 log10(11) = <strong>10.4 dB</strong>.",
             "Chip rate = symbol rate x chips per symbol = 1 Msym/s x 11 = 11 Mchip/s.",
             "Main-lobe bandwidth of the spread signal is about twice the chip rate, <strong>22 MHz</strong>, against about 2 MHz for the same data unspread.",
             "Data rate = symbol rate x bits per symbol: 1 x 1 = 1 Mbit/s (DBPSK) and 1 x 2 = 2 Mbit/s (DQPSK).",
             "Why 10.4 dB: when the 11 chips are added in step the signal voltage grows 11 times, but noise, which adds randomly, grows only about 3.3 times (the square root of 11). The signal-to-noise power ratio improves by 11 times."])
    c += h2("6. Real-world behaviour", "What DSSS looks like on a network")
    c += ul(["<strong>Slow rates, big airtime cost.</strong> A beacon of about 300 bytes at 1 Mbit/s takes roughly 2.6 ms; at 6 Mbit/s about 0.4 ms. With beacons every 102.4 ms per SSID, ten SSIDs at 1 Mbit/s can use about a quarter of the channel before any user traffic.",
             "<strong>Compatibility overhead.</strong> When an 802.11b device is present, newer devices use protection mechanisms and long preambles so it can hear them. The ERP element in beacons has a Barker_Preamble_Mode bit for this.",
             "<strong>Robust, but limited in speed.</strong> With the Barker code the rate stops at 2 Mbit/s, because each symbol carries at most 2 bits and symbols cannot be sent faster than a million a second."])
    c += h2("Practical validation", "Prove it in a capture")
    c += ul(["Add the data rate and PHY type of each frame as columns (<code>wlan_radio.data_rate</code> and <code>wlan_radio.phy</code>) and filter beacons with <code>wlan.fc.type_subtype == 0x0008</code>. Beacons at 1 Mbit/s are DSSS.",
             "Count how many frames in a busy minute use the DSSS rates. Each one holds the channel far longer than an OFDM frame of the same size.",
             "Question to answer: what happens to a network's airtime if you disable the 1, 2, 5.5 and 11 Mbit/s rates, and which old devices would stop working?"])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "dsss", "DSSS quiz")
    c += refs([IEEE_STD, IEEE_TL, IEEE_WG], "Facts checked against IEEE Std 802.11-2020: clause 16, 16.3.6.5 (the Barker sequence) and Tables 16-7 and 16-8 (DBPSK and DQPSK phase changes). The airtime example is a calculation from the stated frame size and rate.")
    return c


def lesson_fhss():
    c = ""
    c += p("A narrow signal that never stays still. FHSS was one of the two radios in the original 802.11 standard, and the idea is still very much alive next to Wi-Fi in the same band.", "lab-lead")
    c += facts([("79", "hop channels of 1 MHz"), ("1 and 2 Mbit/s", "the original FHSS rates"), ("about 28%", "of hops hit by a 22 MHz network"), ("1997", "802.11 original standard")])
    c += callout("In plain words.", 'Hopscotch with a secret path. You say a few words on one square, then jump to another square and say a few more. Your friend knows the path and jumps to the same squares. If a noisy child shouts on one square, only the words said there are lost, and you simply say them again on the next square.')
    c += model('journeyfhss', 'fhss', 'Watch it happen: FHSS')
    c += h2("1. Definition", "What is frequency-hopping spread spectrum?")
    c += p("In FHSS the transmitter sends on one narrow channel for a short <strong>dwell</strong>, then jumps to another, following a pseudo-random <strong>hop pattern</strong> that the receiver also knows. The signal is spread over the whole band across time, not made wider at any one instant.")
    c += callout("Status of FHSS in 802.11.", "FHSS belongs to the 1997 original. It no longer appears at all in the current IEEE Std 802.11-2020, so this is a historic radio. It matters because Bluetooth, which shares 2.4 GHz with Wi-Fi, still hops.")
    c += h2("2. Purpose", "Why hop?")
    c += ul(["<strong>A bad channel hurts only briefly.</strong> If one channel is noisy, only the hops that land on it are affected, and the lost packet is retried on the next hop.",
             "<strong>Low interference to others.</strong> The signal is only on any one channel for a short time.",
             "<strong>Legal in licence-exempt bands.</strong> Spread-spectrum rules allow hopping systems."])
    c += h2("3. Mechanism", "Hopping across 79 channels")
    c += p("The model shows each hop as a dot. A 22 MHz-wide Wi-Fi network sits across the band as the shaded area: every hop that lands inside it is red. Try moving the other network, then turn on adaptive hopping, where the hop pattern skips channels known to be busy.")
    c += model("fhss", "fhss", "FHSS: hopping across 79 channels")
    c += h2("5. Mathematics", "How much is lost?")
    c += ul(["Probability that a hop is hit = busy channels / total channels = 22 / 79 = <strong>27.8%</strong> for a 22 MHz-wide network.",
             "Because the hit hops are retried on the next hop, a lost packet costs one dwell of airtime, not a failed connection.",
             "Adaptive hopping removes the busy channels from the pattern, so the hit probability falls to zero for an interferer that stays still, at the cost of using fewer channels."])
    c += h2("6. Real-world behaviour", "Where hopping shows up today")
    c += ul(["<strong>Bluetooth.</strong> Classic Bluetooth hops across 79 channels of 1 MHz and uses adaptive hopping to avoid channels where Wi-Fi is active.",
             "<strong>Coexistence.</strong> A Wi-Fi network and a Bluetooth device in the same room each see the other as interference, and a strong Wi-Fi network can make some Bluetooth hops unusable.",
             "<strong>Legacy gear.</strong> Very old FHSS Wi-Fi equipment is no longer made, but it explains some old interoperability behaviour."])
    c += h2("Practical validation", "Seeing hopping")
    c += ul(["Hopping is invisible in a Wi-Fi capture. Use a spectrum analyser: its waterfall view shows short bursts that jump across the band instead of one steady block.",
             "Compare it with an ordinary Wi-Fi signal, which sits in one fixed block of the band, to see what hopping looks like.",
             "Question to answer: how would you tell a hopping interferer from a continuous one on a duty-cycle chart?"])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "fhss", "FHSS quiz")
    c += refs([IEEE_STD, IEEE_TL, IEEE_WG], "FHSS was defined in the 1997 original standard; the IEEE Std 802.11-2020 text contains no FHSS clause. The 79 x 1 MHz channel figure and the hit-probability example describe the historic radio and the same structure used by classic Bluetooth.")
    return c


def lesson_cck():
    c = ""
    c += p("How 802.11b went from 2 to 11 Mbit/s without a wider channel or a faster chip rate: by letting the data choose the code.", "lab-lead")
    c += facts([("8 chips", "per symbol"), ("1.375 Msym/s", "symbol rate"), ("256", "code words at 11 Mbit/s"), ("5.5 and 11 Mbit/s", "CCK rates")])
    c += callout("In plain words.", 'A code book with 256 pages, each page showing a different pattern of 8 arrows. Your byte tells the sender which page to show. The receiver compares what it saw with every page in its own code book and picks the closest one.')
    c += model('journeycck', 'cck', 'Watch it happen: CCK')
    c += h2("1. Definition", "What is complementary code keying?")
    c += p("CCK builds an 8-chip <strong>code word</strong> from the data bits using a fixed equation, then sends the chips at the same 11 million chips a second as the Barker-coded rates. Because the code word itself carries information, each symbol can carry 4 bits (5.5 Mbit/s) or 8 bits (11 Mbit/s).")
    c += callout("CCK keeps the channel.", "It is still DSSS: the same 22 MHz channel and the same 11 Mchip/s chip rate. What changes is how many bits ride on each symbol.")
    c += h2("2. Purpose", "Why it was invented")
    c += p("The 1997 standard stopped at 2 Mbit/s. Wi-Fi needed a faster rate that fitted the same channel and the same radios and could coexist with them. CCK did that: 8 chips per symbol instead of 11 gives a faster symbol rate, and the code-word choice carries extra bits.")
    c += h2("3. Mechanism", "Building a code word")
    c += p("Four phase angles, phi 1 to phi 4, are made from the data bits. A fixed equation then combines them into eight chips:")
    c += p("<code>c = { e^j(p1+p2+p3+p4),  e^j(p1+p3+p4),  e^j(p1+p2+p4),  -e^j(p1+p4),  e^j(p1+p2+p3),  e^j(p1+p3),  -e^j(p1+p2),  e^j p1 }</code>")
    c += ul(["<strong>Phase 1</strong> comes from the first two bits using DQPSK: it rotates the whole symbol relative to the previous one.",
             "<strong>Phases 2, 3 and 4</strong> come from the other bits (two bits each at 11 Mbit/s) and shape the code word.",
             "The minus signs on chips 4 and 7 are a fixed cover code that improves the correlation properties.",
             "Every chip ends up as one of four values: 1, j, -1 or -j."])
    c += model("cck", "cck", "CCK: building an 8-chip code word")
    c += h2("5. Mathematics", "Where 11 Mbit/s comes from")
    c += ul(["Chip rate 11 Mchip/s / 8 chips per symbol = <strong>1.375 Msym/s</strong>.",
             "11 Mbit/s: 8 bits per symbol x 1.375 Msym/s = 11 Mbit/s. 5.5 Mbit/s: 4 bits per symbol x 1.375 Msym/s = 5.5 Mbit/s.",
             "Number of code words: 4 phases of phi 1 x 64 combinations of phi 2 to 4 = 256 at 11 Mbit/s.",
             "Receiver: correlate against the 64 possible words (phase 1 is removed by taking the magnitude). The right word scores 8. At 11 Mbit/s the best wrong word still scores up to 5.7 (computed over all 64 words), while at 5.5 Mbit/s the four words are completely distinct (0)."])
    c += h2("6. Real-world behaviour", "What CCK means on a network")
    c += ul(["<strong>Rate fallback.</strong> The 11 Mbit/s words are closer together, so the receiver needs a cleaner signal for them. As the signal weakens a link steps down to 5.5, then 2, then 1 Mbit/s.",
             "<strong>Limited speed.</strong> Even 11 Mbit/s is far below modern Wi-Fi rates, and the chips are short (about 91 nanoseconds), so an echo only a few chips late smears into the next symbol.",
             "<strong>Compatibility.</strong> 802.11g kept DSSS/CCK so that 802.11b devices keep working, which is why old rates still affect modern 2.4 GHz networks."])
    c += h2("Practical validation", "In a capture")
    c += ul(["Look at the data rate of data frames (<code>wlan_radio.data_rate</code>): 5.5 or 11 Mbit/s frames are CCK.",
             "Watch a client walk away from an access point: the data rate steps down through the CCK and DSSS rates if OFDM rates are disabled.",
             "Question to answer: why does disabling the CCK rates help a 2.4 GHz network, and what do you lose?"])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "cck", "CCK quiz")
    c += refs([IEEE_STD, IEEE_TL, IEEE_WG], "Facts checked against IEEE Std 802.11-2020: clause 16.3.6.6 (Equation 16-1, the cover code, and Tables 16-8 to 16-11 for the DQPSK and QPSK phase mappings). The correlation figures are computed from the equation over all code words.")
    return c


def lesson_ofdm():
    c = ""
    c += p("Replace one fast carrier by many slow ones. OFDM is how 802.11g, 802.11n, and every Wi-Fi generation since carry their data, and it is the key to surviving echoes.", "lab-lead")
    c += facts([("52", "subcarriers (48 data + 4 pilots)"), ("312.5 kHz", "subcarrier spacing"), ("3.2 + 0.8 µs", "symbol plus guard interval"), ("54 Mbit/s", "top 802.11g rate")])
    c += callout("In plain words.", 'A choir instead of a soloist. One singer singing very fast gets blurred by the echo in a big hall. A choir where every singer sings slowly, each with a different note, stays clear: every singer carries a little of the message, and echoes cannot blur slow notes.')
    c += model('journeyofdm', 'ofdm', 'Watch it happen: OFDM')
    c += h2("1. Definition", "What is OFDM?")
    c += p("Orthogonal frequency-division multiplexing splits a channel into many narrow <strong>subcarriers</strong>. Each carries a few bits at a low symbol rate. \"Orthogonal\" means the subcarriers are spaced so that, at the centre of each one, every other subcarrier is exactly zero: they can overlap in frequency without interfering. A transmitter creates the whole signal with an <strong>inverse FFT</strong>, and a receiver separates it again with an FFT.")
    c += callout("OFDM is a waveform, not a modulation.", "Each subcarrier still uses a modulation such as BPSK, QPSK or QAM. OFDM is the way the subcarriers are arranged and combined.")
    c += h2("2. Purpose", "The problem it solves")
    c += p("Inside a building a signal arrives by many paths, so echoes arrive a fraction of a microsecond late. On a single fast carrier the echoes smear into the next symbol. OFDM sends symbols that are long (3.2 microseconds) and adds a short copy at the front, the <strong>guard interval</strong>. An echo that arrives within it does no harm.")
    c += h2("3. Mechanism", "The whole chain, with real numbers")
    c += p("Choose a data rate and follow the bits: the pipeline shows how many bits go in and out of every step for that rate, then the subcarriers, the bit-to-point mapping, the time signal and what an echo does.")
    c += model("ofdm", "ofdm", "OFDM: from bits to subcarriers and back")
    c += h2("5. Mathematics", "The numbers behind it")
    c += ul(["Subcarrier spacing = channel width / FFT size = 20 MHz / 64 = <strong>312.5 kHz</strong>.",
             "Useful symbol time = 1 / spacing = <strong>3.2 microseconds</strong>; guard interval 0.8 microseconds (a quarter of it); symbol interval 4 microseconds.",
             "Occupied bandwidth = 52 subcarriers x 312.5 kHz = <strong>16.25 MHz</strong> inside the 20 MHz channel.",
             "Data rate = (data subcarriers x bits per subcarrier x coding rate) / symbol time. At 54 Mbit/s: 48 x 6 x 3/4 / 4 microseconds = <strong>54 Mbit/s</strong>. At 6 Mbit/s: 48 x 1 x 1/2 / 4 microseconds = 6 Mbit/s.",
             "In 802.11n and 802.11ac the data subcarriers grow with channel width: 52 (20 MHz), 108 (40 MHz), 234 (80 MHz) and 468 (160 MHz). In 802.11ax and 802.11be symbols are four times longer (12.8 microseconds, 78.125 kHz spacing, a 256-point FFT in 20 MHz)."])
    c += h2("6. Real-world behaviour", "What OFDM means in practice")
    c += ul(["<strong>Echo tolerance.</strong> A room whose echoes are longer than the guard interval causes inter-symbol interference, which is one reason very large open spaces can behave badly.",
             "<strong>Subcarriers fade separately.</strong> A reflection can cancel one part of the channel while leaving the rest fine, so a link can lose a few subcarriers and still work: this is why coding and interleaving matter.",
             "<strong>Sensitive to frequency errors.</strong> Orthogonality depends on both ends agreeing on frequency very precisely, which is one reason OFDM radios need good oscillators."])
    c += h2("Practical validation", "Prove it")
    c += ul(["A spectrum analyser shows an OFDM 20 MHz signal as a flat-topped block about 16.25 MHz wide with sharp edges.",
             "In a capture, check the PHY type and data rate of frames (<code>wlan_radio.phy</code>, <code>wlan_radio.data_rate</code>): OFDM frames use the 6 to 54 Mbit/s rates.",
             "Question to answer: how would a longer guard interval change the rate, and when would it help?"])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "ofdm", "OFDM quiz")
    c += refs([IEEE_STD, IEEE_TL, IEEE_WG], "Facts checked against IEEE Std 802.11-2020: clause 17 (Tables 17-4 and 17-5 for the data rates and timing, 17.3.5.9 for the pilots, Tables 17-11 to 17-15 for the constellation mappings), clause 18 (ERP-OFDM), and the HT and VHT subcarrier counts in Tables 19-6 and 21-5. The 802.11ax and 802.11be numbers follow from the same relationships (20 MHz / 256 = 78.125 kHz); they are not covered by the 2020 edition.")
    return c

# ======================================================================
# Foundations track
# ======================================================================
NIST_C = ("NIST CODATA: speed of light in vacuum, 299 792 458 m/s (exact)", "https://physics.nist.gov/cgi-bin/cuu/Value?c")
BIPM_SI = ("BIPM: The International System of Units (SI Brochure), including units for logarithmic ratio quantities", "https://www.bipm.org/en/publications/si-brochure")
C_LIGHT = 299792458.0


def lam_cm(f_mhz):
    return C_LIGHT / (f_mhz * 1e6) * 100


def foundations_hub():
    c = ""
    c += p("Before bands, channels and modulation there is the physics underneath them. These topics cover the few ideas that every later topic leans on: what a wave is, how waves add up, and how engineers talk about power. Each one has live models you can move.", "lab-lead")
    c += h2("Topics", "Start with waves")
    c += ('<!-- wp:html --><div class="lab-cards">'
          '<a class="lab-card" href="/lab/foundations/waves/"><em>Frequency and wavelength</em><b>Waves</b><span>Frequency, wavelength, period, amplitude and phase, and what happens when two waves meet.</span></a>'
          '<a class="lab-card" href="/lab/foundations/decibels/"><em>dB, dBm and dBi</em><b>Decibels</b><span>Why Wi-Fi power is written in decibels, and how to add gains and losses along a chain.</span></a>'
          '<a class="lab-card" href="/lab/foundations/propagation/"><em>Path loss and antennas</em><b>Propagation</b><span>How far a signal reaches, what antennas do, and how to build a link budget.</span></a>'
          '</div><!-- /wp:html -->\n')
    c += callout("Why this comes first.", "Almost every Wi-Fi puzzle is one of two things: a wave that arrived weaker than the receiver needs, or waves that arrived at the wrong moment and cancelled. These two topics give you the vocabulary for both.")
    return c


def lesson_waves():
    c = ""
    c += p("A Wi-Fi signal is a wave. Its frequency, wavelength and phase explain why it travels the way it does, why antennas are the size they are, and why moving a laptop a few centimetres can change the signal.", "lab-lead")
    c += facts([("299 792 458 m/s", "speed of light (exact)"), ("%.1f cm" % lam_cm(2437), "wavelength at 2437 MHz"), ("%.1f cm" % lam_cm(5500), "wavelength at 5500 MHz"), ("%.1f cm" % lam_cm(6135), "wavelength at 6135 MHz")])

    c += h2("1. Definition", "What is a radio wave?")
    c += p("A radio wave is a pattern of electric and magnetic fields that moves through space at the speed of light. Radio waves, infrared, visible light and X-rays are all the same kind of thing at different frequencies. A Wi-Fi radio makes a steady wave called the <strong>carrier</strong> and then changes it, a little at a time, to carry data (that is <em>modulation</em>).")
    c += ul([
        "<strong>Frequency (f)</strong> is how many complete cycles happen each second. One cycle per second is one hertz (Hz); Wi-Fi uses millions (MHz) and billions (GHz) of cycles per second.",
        "<strong>Period (T)</strong> is the time one cycle takes: T = 1 / f.",
        "<strong>Wavelength (&lambda;)</strong> is the distance the wave travels during one cycle: &lambda; = c / f, where c is the speed of light.",
        "<strong>Amplitude</strong> is the height of the wave, how strong it is. Power is proportional to amplitude squared.",
        "<strong>Phase</strong> is how far through its cycle the wave is at a given moment or place, in degrees. A full cycle is 360 degrees.",
    ])

    c += h2("2. Purpose", "Why start with waves?")
    c += ul([
        "<strong>Wavelength sets the size of things.</strong> An antenna works best when it is a sensible fraction of a wavelength. At 2.4 GHz that is a few centimetres, which is why a Wi-Fi antenna fits in a phone.",
        "<strong>Wavelength decides how a wave meets obstacles.</strong> Objects much smaller than a wavelength barely disturb it; large flat surfaces such as walls and floors reflect it; edges bend (diffract) it.",
        "<strong>Phase decides what happens when waves meet.</strong> The same two waves can reinforce each other or cancel, depending only on how far each one travelled.",
        "<strong>It is the root of the band topics.</strong> Everything about 2.4, 5 and 6 GHz that depends on frequency starts from the relationship between frequency and wavelength.",
    ])

    c += h2("3. Mechanism", "Frequency, wavelength and period")
    c += p("The wave below is drawn over three wavelengths. Slide the frequency up and the wavelength shrinks; the distance scale underneath is real. Use the buttons to jump to a real frequency. Change the amplitude and phase to see what each does.")
    c += model("wavebasics", None, "Wave explorer: frequency, wavelength, period, amplitude and phase")
    c += callout("Try this.", "(1) Select FM radio, then 2.4 GHz: the wavelength falls from about 3 m to about 12 cm. (2) Double the frequency and watch the wavelength halve. (3) Set the amplitude to 10 and read the power: it is 100 times the power at amplitude 1, because power follows the square.")

    c += h2("4. Visual", "What happens when two waves meet")
    c += p("A receiver does not hear the direct wave and its echoes separately: it senses their <strong>sum</strong>. Add two waves point by point. If they rise and fall together they reinforce each other (constructive). If one rises while the other falls they cancel (destructive). Which one you get depends on the extra distance the echo travelled, measured in wavelengths.")
    c += model("superpos", None, "A direct wave plus an echo: constructive and destructive interference")
    c += callout("Try this.", "Set the echo strength to 100%, then slide the extra distance from 0 to about 6 cm at 2.4 GHz. The sum shrinks to almost nothing at half a wavelength (6.2 cm), then recovers at a full wavelength (12.3 cm). Now switch to 5 GHz: the same movement is a much bigger share of a wavelength, so the swings are faster.")

    c += h2("5. Mathematics", "The formulas, with numbers")
    c += p("<strong>Wavelength.</strong> &lambda; = c / f. For channel 6 in 2.4 GHz, f = 2437 MHz, so &lambda; = 299 792 458 / 2 437 000 000 = <strong>0.1230 m</strong>, or %.1f cm. The period is T = 1 / f = <strong>%.3f ns</strong>." % (lam_cm(2437), 1e9 / 2437e6))
    rows = [("FM radio (about 100 MHz)", 100), ("2.4 GHz, channel 6 (2437 MHz)", 2437), ("5 GHz, channel 100 (5500 MHz)", 5500), ("6 GHz, channel 37 (6135 MHz)", 6135)]
    tbl = '<!-- wp:html --><div class="lab-tablewrap"><table class="lab-table"><thead><tr><th scope="col">Signal</th><th scope="col">Frequency</th><th scope="col">Wavelength</th><th scope="col">Period</th></tr></thead><tbody>'
    for n, f in rows:
        wl = C_LIGHT / (f * 1e6)
        wls = "%.2f m" % wl if wl >= 1 else "%.2f cm" % (wl * 100)
        per = "%.2f ns" % (1e3 / f)
        tbl += '<tr><th scope="row">%s</th><td>%s</td><td>%s</td><td>%s</td></tr>' % (n, ("%d MHz" % f), wls, per)
    tbl += '</tbody></table></div><!-- /wp:html -->\n'
    c += tbl
    c += p("<strong>Phase and distance.</strong> A wave that has travelled an extra distance d is behind by 360 &times; d / &lambda; degrees. At 2437 MHz an extra 6.15 cm is half a wavelength, 180 degrees. <strong>Adding two waves</strong> of amplitudes A<sub>1</sub> and A<sub>2</sub> with phase difference &delta; gives a wave of amplitude sqrt(A<sub>1</sub><sup>2</sup> + A<sub>2</sub><sup>2</sup> + 2A<sub>1</sub>A<sub>2</sub>cos &delta;). With two equal waves that is 2A when &delta; = 0 (four times the power, +6 dB) and 0 when &delta; = 180 degrees.")
    c += p("<strong>Worked example.</strong> A direct wave of amplitude 1 and an echo of amplitude 0.8 arrive 180 degrees apart. The sum is sqrt(1 + 0.64 - 1.6) = sqrt(0.04) = <strong>0.2</strong>: the signal falls to a fifth of its amplitude, which is 20 log10(0.2) = <strong>-14 dB</strong>, from an echo that is itself weaker than the direct wave.")

    c += h2("6. Real-world behaviour", "Multipath, fading and why wavelength matters")
    c += ul([
        "<strong>Multipath fading.</strong> Indoors a signal reaches the receiver by many paths (direct, off walls, floors and furniture). Their sum changes with position on the scale of a wavelength, so signal strength can swing by many dB over a few centimetres. Moving the antenna a little can fix a weak spot.",
        "<strong>Why bands behave differently.</strong> A shorter wavelength means the pattern of fades repeats over a shorter distance, and the wave is more easily blocked by objects that are large compared with it.",
        "<strong>Why it is not just distance.</strong> Two clients at the same distance from an access point can see very different signal strength, because each sits at a different point in the interference pattern.",
    ])

    c += validate_block([
        "Pick a channel from the table above and work out its wavelength yourself with &lambda; = c / f. Check it against the model.",
        "Start a monitor-mode capture and look at the <code>radiotap.dbm_antsignal</code> field of frames from one access point. Move the receiving antenna about half a wavelength (6 cm at 2.4 GHz) and see how much the value changes.",
        "Question to answer: at 5 GHz, how far must an echo travel beyond the direct path to arrive exactly half a cycle behind?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "fwaves", "Waves quiz")
    c += refs([NIST_C, BIPM_SI, IEEE_WG], "The relationships on this page (wavelength, period, phase and the sum of two sine waves) are standard physics rather than amendments of 802.11. The speed of light is exact by the definition of the metre. Channel centre frequencies are defined in IEEE 802.11 and are covered in the band topics.")
    return c


def lesson_decibels():
    c = ""
    c += p("Wi-Fi power levels span eleven orders of magnitude, from 100 mW at the transmitter to a trillionth of a watt at the edge of coverage. Decibels turn that range into small numbers you can add.", "lab-lead")
    c += facts([("10 dB", "= 10 times the power"), ("3 dB", "= about 2 times the power"), ("0 dBm", "= 1 milliwatt"), ("20 dBm", "= 100 milliwatts")])

    c += h2("1. Definition", "What are dB, dBm and dBi?")
    c += ul([
        "<strong>dB (decibel)</strong> compares two powers: dB = 10 log<sub>10</sub>(P<sub>2</sub> / P<sub>1</sub>). It is a ratio, not a unit of power. For amplitude (voltage) the factor is 20 instead of 10, because power goes with amplitude squared.",
        "<strong>dBm</strong> is power measured against one milliwatt: dBm = 10 log<sub>10</sub>(P in mW). So 0 dBm is 1 mW. It is a real power level, written on a log scale.",
        "<strong>dBi</strong> is antenna gain measured against an ideal antenna that radiates equally in every direction (an isotropic radiator). An antenna does not make power; it concentrates it, so gain in one direction means less elsewhere. (A half-wave dipole has about 2.15 dBi of gain, so dBd = dBi - 2.15.)",
        "<strong>EIRP</strong> (equivalent isotropically radiated power) is the power an ideal isotropic antenna would need to radiate to give the same signal in the strongest direction: transmitter power - cable loss + antenna gain. Regulators limit EIRP.",
    ])

    c += h2("2. Purpose", "Why use a log scale?")
    c += ul([
        "<strong>The range is huge.</strong> A transmitter at 20 dBm (100 mW) and a weak received signal at -90 dBm (1 pW) differ by a factor of 10<sup>11</sup>. In dB that is a 110 dB difference, a number you can hold in your head.",
        "<strong>Chains become sums.</strong> Gains and losses multiply as plain ratios. In decibels they simply add and subtract, so a link budget is a column of numbers.",
        "<strong>It matches how losses behave.</strong> Free-space path loss, walls and cables each remove a fixed fraction of the power, which is a fixed number of dB.",
    ])

    c += h2("3. Mechanism", "Three ways to feel a decibel")
    c += p("Panel A converts dBm to power. Panel B turns a gain or loss in dB into a multiplier. Panel C adds up a short transmit chain: transmitter, cable and antenna.")
    c += model("decibels", None, "Decibel explorer: dBm, ratios and a transmit chain")
    c += callout("Try this.", "(1) In panel A, set 20 dBm and then 23 dBm: a 3 dB step doubles the power. (2) In panel B, step from 0 to 10 and then 20 dB: each 10 dB is ten times more. (3) In panel C, raise the antenna gain until the dashed line is passed: with the same transmitter, a better antenna can put you over a limit that is written as EIRP.")

    c += h2("4. Visual", "Power levels you will meet")
    rows = [("+30 dBm", "1 W", "One full watt"), ("+20 dBm", "100 mW", "The 2.4 GHz EIRP limit in the UK and the EU"), ("0 dBm", "1 mW", "The reference level"), ("-30 dBm", "1 &micro;W", "A very strong received signal, close to the access point"), ("-90 dBm", "1 pW", "A very weak received signal")]
    tbl = '<!-- wp:html --><div class="lab-tablewrap"><table class="lab-table"><thead><tr><th scope="col">Level</th><th scope="col">Power</th><th scope="col">Meaning</th></tr></thead><tbody>'
    for a, b, d in rows:
        tbl += '<tr><th scope="row">%s</th><td>%s</td><td>%s</td></tr>' % (a, b, d)
    tbl += '</tbody></table></div><!-- /wp:html -->\n'
    c += tbl
    c += p("The scale is anchored at 0 dBm = 1 mW. Each +10 moves up by a factor of ten, so the whole table is one idea repeated.")

    c += h2("5. Mathematics", "The rules and worked examples")
    rules = [(1, "1.00"), (3, "1.995, about 2"), (6, "3.98, about 4"), (10, "10"), (20, "100"), (30, "1000")]
    tbl = '<!-- wp:html --><div class="lab-tablewrap"><table class="lab-table"><thead><tr><th scope="col">Gain</th><th scope="col">Power multiplied by</th><th scope="col">Loss</th><th scope="col">Power multiplied by</th></tr></thead><tbody>'
    for d, _ in rules:
        tbl += '<tr><th scope="row">+%d dB</th><td>%s</td><th scope="row">-%d dB</th><td>%s</td></tr>' % (d, ("%.3g" % (10 ** (d / 10.0))), d, ("%.3g" % (10 ** (-d / 10.0))))
    tbl += '</tbody></table></div><!-- /wp:html -->\n'
    c += tbl
    c += ul([
        "<strong>From dBm to milliwatts:</strong> P = 10<sup>(dBm / 10)</sup> mW. For 17 dBm that is 10<sup>1.7</sup> = 50.1 mW.",
        "<strong>Transmit chain:</strong> a 15 dBm transmitter, a 2 dB cable and a 5 dBi antenna give 15 - 2 + 5 = <strong>18 dBm EIRP</strong>, which is 63 mW.",
        "<strong>Adding two signals:</strong> you cannot add dBm values. Convert to milliwatts, add, and convert back. Two 20 dBm signals are 100 + 100 = 200 mW = <strong>23 dBm</strong>, not 40 dBm: doubling the power adds 3 dB.",
        "<strong>Received power:</strong> take the transmit EIRP and subtract the path loss. From the 2.4 GHz topic, free-space loss at 10 m is 60.2 dB, so 20 dBm - 60.2 dB = <strong>-40.2 dBm</strong>, about 95 nW. Walls and furniture then subtract more.",
    ])

    c += h2("6. Real-world behaviour", "Where you will see decibels")
    c += ul([
        "<strong>Transmit power settings</strong> on access points are written in dBm. Doubling the power only buys 3 dB, which is rarely worth the interference it causes to neighbours. Often the weak side of the link is the client, which transmits at much lower power than the access point.",
        "<strong>Regulatory limits are written as EIRP</strong>, so a higher-gain antenna means the transmitter must be turned down to stay within the limit.",
        "<strong>Signal strength readings</strong> in client tools and captures are negative dBm numbers. Different vendors scale and calibrate their RSSI differently, so compare readings from the same device, not across devices.",
        "<strong>Cable and connector loss</strong> is real: a few dB lost between a radio and its antenna is a large share of the power.",
    ])

    c += validate_block([
        "Read the transmit power setting of your access point and convert it to milliwatts with 10<sup>(dBm / 10)</sup>.",
        "In a capture, filter on frames from one access point and look at <code>radiotap.dbm_antsignal</code>. Convert two readings to milliwatts and compute their ratio in dB to check you get the same difference.",
        "Question to answer: a client reports -70 dBm from an access point radiating 17 dBm EIRP. What path loss does that imply? (Answer: 17 - (-70) = 87 dB.)",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "fdb", "Decibels quiz")
    c += refs([BIPM_SI, OFCOM_IR2030, ETSI_328], "Decibels are defined by mathematics, not by IEEE. The 20 dBm (100 mW) EIRP figure for 2.4 GHz comes from Ofcom IR 2030 for the UK and from ETSI EN 300 328 for the EU; other regions set different limits, so check the regulator. The 60.2 dB path loss figure is worked in the 2.4 GHz topic.")
    return c


PAGES = [
    {"slug": "lab", "parent": None, "title": "Wi-Fi Pro Lab", "template": "", "status": "publish", "order": 0,
     "excerpt": "Interactive models that show how Wi-Fi really works.", "content": hub()},
    {"slug": "foundations", "parent": "lab", "title": "Foundations: the physics under Wi-Fi", "template": "", "status": "publish", "order": 5,
     "excerpt": "Waves, frequency, wavelength, interference and decibels: the physics every Wi-Fi topic builds on.", "content": foundations_hub()},
    {"slug": "waves", "parent": "foundations", "title": "Waves and frequency: the physics of a radio signal", "template": "lab-lesson", "status": "publish", "order": 1,
     "excerpt": "Frequency, wavelength, period, amplitude and phase, and how a direct wave and its echo add up.", "content": lesson_waves()},
    {"slug": "decibels", "parent": "foundations", "title": "Decibels and power: dB, dBm and dBi", "template": "lab-lesson", "status": "publish", "order": 2,
     "excerpt": "Why Wi-Fi power is written in decibels, how to convert dBm to milliwatts, and how to add gains and losses along a chain.", "content": lesson_decibels()},
    {"slug": "2-4-ghz", "parent": "lab", "title": "2.4 GHz Wi-Fi: the original band", "template": "lab-lesson", "status": "publish", "order": 1,
     "excerpt": "How 2.4 GHz Wi-Fi works: channels and overlap, path loss, UK, EU and US rules, and a map of the standards that use it.", "content": page_24()},
    {"slug": "5-ghz", "parent": "lab", "title": "5 GHz Wi-Fi: wide channels and DFS", "template": "lab-lesson", "status": "publish", "order": 2,
     "excerpt": "How 5 GHz Wi-Fi works: channel bonding, DFS and radar, UK, EU and US rules, 802.11a to Wi-Fi 7.", "content": page_5()},
    {"slug": "6-ghz", "parent": "lab", "title": "6 GHz Wi-Fi: Wi-Fi 6E and Wi-Fi 7", "template": "lab-lesson", "status": "publish", "order": 3,
     "excerpt": "How 6 GHz Wi-Fi works: PSC discovery, LPI and VLP power classes, 320 MHz channels, and UK, EU and US rules.", "content": page_6()},
    {"slug": "modulation", "parent": "lab", "title": "Modulation and waveforms: how the signal is built", "template": "", "status": "publish", "order": 10,
     "excerpt": "How bits become a radio wave: DSSS, FHSS, CCK and OFDM, one deep-dive topic each.", "content": mod_hub()},
    {"slug": "dsss", "parent": "modulation", "title": "DSSS: direct-sequence spread spectrum", "template": "lab-lesson", "status": "publish", "order": 1,
     "excerpt": "How direct-sequence spread spectrum works: Barker spreading, DBPSK, processing gain and why 1 and 2 Mbit/s are robust.", "content": lesson_dsss()},
    {"slug": "fhss", "parent": "modulation", "title": "FHSS: frequency-hopping spread spectrum", "template": "lab-lesson", "status": "publish", "order": 2,
     "excerpt": "How frequency hopping works, why 802.11 dropped it, and where the idea lives on in Bluetooth.", "content": lesson_fhss()},
    {"slug": "cck", "parent": "modulation", "title": "CCK: complementary code keying", "template": "lab-lesson", "status": "publish", "order": 3,
     "excerpt": "How CCK carries 8 bits in an 8-chip code word to reach 11 Mbit/s in 802.11b.", "content": lesson_cck()},
    {"slug": "ofdm", "parent": "modulation", "title": "OFDM: orthogonal frequency-division multiplexing", "template": "lab-lesson", "status": "publish", "order": 4,
     "excerpt": "How OFDM turns bits into subcarriers, an IFFT and a guard interval, with the real numbers for 802.11a/g.", "content": lesson_ofdm()},
]

if __name__ == "__main__":
    json.dump(PAGES, open(OUT, "w"), indent=1)
    for pg in PAGES:
        print("%-10s %-9s %6d chars  %s" % (pg["slug"], pg["status"], len(pg["content"]), pg["title"]))
