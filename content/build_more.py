#!/usr/bin/env python3
"""Generate the rest of the Wi-Fi Pro Lab book: propagation, QAM, OFDMA, MIMO, MAC, generations,
association, coexistence, measurement and engineering.  Run:  python3 -I content/build_more.py
It imports the existing pages from build_lab.py, appends the new ones, and writes content/lab-pages.json.
Facts that come from IEEE Std 802.11-2020 were checked against the standard (see the notes in each lesson).
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_lab as B
from build_lab import p, h2, h3, ul, callout, model, facts, esc, refs, validate_block, IEEE_STD, IEEE_TL, IEEE_WG, OFCOM_IR2030, ETSI_328, ETSI_893, ETSI_687, FCC_2051, ECFR15, ECFR407, OFCOM_6, WFA_6E_NAME, WFA_7, WFA_HIST, BIPM_SI, NIST_C

ITU_P525 = ("ITU-R P.525: Calculation of free-space attenuation", "https://www.itu.int/rec/R-REC-P.525/en")
ITU_P1238 = ("ITU-R P.1238: Propagation data and prediction methods for indoor radiocommunication systems", "https://www.itu.int/rec/R-REC-P.1238/en")
ITU_G114 = ("ITU-T G.114: One-way transmission time", "https://www.itu.int/rec/T-REC-G.114/en")
BBF_TR398 = ("Broadband Forum: TR-398 Wi-Fi In-Premises Performance Testing", "https://www.broadband-forum.org/download/TR-398.pdf")
WFA_SEC = ("Wi-Fi Alliance: Wi-Fi security", "https://www.wi-fi.org/discover-wi-fi/security")
WFA_SPECS = ("Wi-Fi Alliance: specifications", "https://www.wi-fi.org/discover-wi-fi/specifications")
WFA_WIFI7 = ("Wi-Fi Alliance: Wi-Fi CERTIFIED 7", "https://www.wi-fi.org/discover-wi-fi/wi-fi-certified-7")
RFC3748 = ("IETF RFC 3748: Extensible Authentication Protocol (EAP)", "https://datatracker.ietf.org/doc/html/rfc3748")
WS_WLAN = ("Wireshark display filter reference: IEEE 802.11 (wlan)", "https://www.wireshark.org/docs/dfref/w/wlan.html")
WS_RADIOTAP = ("Wireshark display filter reference: radiotap", "https://www.wireshark.org/docs/dfref/r/radiotap.html")
IPERF = ("iPerf3 documentation", "https://iperf.fr/iperf-doc.php")
ICNIRP = ("ICNIRP: Guidelines for limiting exposure to electromagnetic fields (100 kHz to 300 GHz), 2020", "https://www.icnirp.org/en/publications/article/rf-guidelines-2020.html")
BT_SPEC = ("Bluetooth Core Specification (Bluetooth SIG)", "https://www.bluetooth.com/specifications/specs/")
RFC8325 = ("IETF RFC 8325: Mapping Diffserv to IEEE 802.11", "https://datatracker.ietf.org/doc/html/rfc8325")
IEEE_154 = ("IEEE 802.15 Working Group (802.15.4, used by ZigBee)", "https://www.ieee802.org/15/")


def table(head, rows):
    t = '<!-- wp:html --><div class="lab-tablewrap"><table class="lab-table"><thead><tr>%s</tr></thead><tbody>' % "".join('<th scope="col">%s</th>' % h for h in head)
    for r in rows:
        t += '<tr><th scope="row">%s</th>%s</tr>' % (r[0], "".join('<td>%s</td>' % c for c in r[1:]))
    return t + '</tbody></table></div><!-- /wp:html -->\n'


def fspl1(f):
    return 20 * math.log10(f) - 27.55


# ======================================================================
# Foundations: RF propagation and antennas
# ======================================================================
def lesson_propagation():
    c = ""
    c += p("How far a signal reaches is a sum: power in, minus the loss on the way, plus what the antennas add. This topic turns that sentence into numbers, and shows what antennas actually do.", "lab-lead")
    c += facts([("6 dB", "more loss each time distance doubles (free space)"), ("%.1f dB" % fspl1(2437), "free-space loss at 1 m, 2437 MHz"), ("%.1f dB" % fspl1(5500), "free-space loss at 1 m, 5500 MHz"), ("2.15 dBi", "gain of a half-wave dipole")])

    c += h2("1. Definition", "How a signal travels, and what an antenna does")
    c += ul([
        "<strong>Free-space loss.</strong> A signal spreads out as it travels, so the power through a given area falls with distance, even in empty space and with nothing absorbing it.",
        "<strong>Reflection.</strong> A wave bounces off large smooth surfaces such as walls, floors, metal and glass. This creates the echoes (multipath) from the Foundations topic on waves.",
        "<strong>Absorption.</strong> Materials turn some of the energy into heat. Water, concrete and people absorb more than plasterboard and air.",
        "<strong>Diffraction and scattering.</strong> Waves bend around edges and scatter off small objects, which is how a signal reaches places with no straight line to the antenna.",
        "<strong>An antenna</strong> converts between the electrical signal in a cable and a radio wave in space. It does not make power; it chooses where the power goes. Its <strong>gain</strong> (in dBi) says how much stronger it is in its best direction than an ideal all-direction antenna.",
        "<strong>A link budget</strong> adds up every gain and subtracts every loss between the transmitter and the receiver.",
    ])

    c += h2("2. Purpose", "Why engineers calculate it")
    c += ul([
        "<strong>Planning.</strong> Before any equipment is bought, a link budget tells you roughly how far a signal will reach and what it takes to cover a space.",
        "<strong>Troubleshooting.</strong> A weak signal is either too much loss, too little power or a poor antenna arrangement. The budget shows which.",
        "<strong>Compliance.</strong> Regulators limit radiated power (EIRP), so you must know what the antenna adds.",
    ])

    c += h2("3. Mechanism", "Build a link budget")
    c += p("The model uses the free-space loss at 1 m plus a path-loss exponent n for the building and a loss for each wall. Drag the transmit power, the walls and the level the receiver needs, and compare how the three bands reach with the same settings.")
    c += model("linkbudget", None, "Link budget: range for 2.4, 5 and 6 GHz")
    c += callout("Try this.", "(1) Choose free space (n = 2) and note the range, then choose cluttered (n = 4). (2) Add two walls. (3) Switch from 2.4 to 6 GHz with everything else equal. The higher band loses range because free-space loss rises with frequency, and each extra wall costs the same number of decibels whatever the distance.")

    c += h2("4. Visual", "Antenna patterns and the Fresnel zone")
    c += p("An antenna's pattern shows where its power goes. A dipole radiates in a doughnut shape; a directional antenna squeezes the same power into a narrow beam, so it is stronger on boresight and weaker elsewhere.")
    c += model("antenna", None, "Antenna patterns: dipole and directional")
    c += p("A line-of-sight link also needs room around the line. The first Fresnel zone is the ellipsoid in which reflected waves arrive less than half a wavelength late; anything that cuts into it costs signal even when the straight line is clear.")
    c += model("fresnel", None, "First Fresnel zone")

    c += h2("5. Mathematics", "The formulas, with numbers")
    c += p("<strong>Free-space path loss</strong> is FSPL = 20 log<sub>10</sub>(d) + 20 log<sub>10</sub>(f) - 27.55 dB, with d in metres and f in MHz (ITU-R P.525). Every doubling of distance adds 20 log<sub>10</sub>(2) = 6 dB. Every doubling of frequency adds the same 6 dB.")
    rows = [[n, "%.1f dB" % fspl1(f), "%.1f dB" % (fspl1(f) + 20), "%.1f dB" % (fspl1(f) + 40)] for n, f in (("2.4 GHz (2437 MHz)", 2437), ("5 GHz (5500 MHz)", 5500), ("6 GHz (6135 MHz)", 6135))]
    c += table(["Free-space loss at", "1 m", "10 m", "100 m"], rows)
    c += p("<strong>Indoors</strong> the loss grows faster than free space. A common model is PL(d) = PL(1 m) + 10 n log<sub>10</sub>(d) + wall losses, where n is about 2 in free space and larger in cluttered buildings (ITU-R P.1238 gives measured values for offices and homes). Treat n and wall losses as numbers to measure, not constants.")
    d = 10 ** ((20 + 67 - 5 - fspl1(5500)) / 30)
    c += p("<strong>Link budget.</strong> Received power = EIRP - path loss + receive antenna gain. <strong>Worked example:</strong> 20 dBm EIRP in 5 GHz, a client that needs -67 dBm, n = 3 and one 5 dB wall. The most path loss you can afford is 20 - (-67) = 87 dB. Take off 47.3 dB (free space at 1 m) and 5 dB (wall): 34.7 dB is left for 30 log<sub>10</sub>(d), so d = 10<sup>34.7 / 30</sup> = <strong>%.1f m</strong>." % d)
    c += p("<strong>First Fresnel zone radius</strong> at the middle of a link of length d is 0.5 &times; sqrt(&lambda; d). For d = 100 m, that is %.2f m at 2437 MHz and %.2f m at 5500 MHz, so the zone is narrower at higher frequencies. Keeping about 60%% of that radius clear is a common rule of thumb." % (0.5 * math.sqrt(299792458 / 2437e6 * 100), 0.5 * math.sqrt(299792458 / 5500e6 * 100)))
    c += p("<strong>Antenna gain and beamwidth.</strong> Gain is not free: a gain of G dBi means the power is concentrated into roughly a solid angle of 4&pi; / 10<sup>G/10</sup> steradians. A half-wave dipole has 2.15 dBi, so dBd = dBi - 2.15.")

    c += h2("6. Real-world behaviour", "What the textbook leaves out")
    c += ul([
        "<strong>Materials differ widely.</strong> Plasterboard, brick, concrete, glass with metal coating, lifts and water tanks each cost a different amount, and the cost depends on the angle and the frequency. That is why an on-site survey beats a rule of thumb.",
        "<strong>Antenna orientation matters.</strong> A vertical dipole radiates little along its length, and a client whose antenna is tilted may see a weaker signal than one that is upright. Polarisation mismatch costs signal too.",
        "<strong>The link is two-way.</strong> A loud access point and a quiet phone give a link that is good in one direction and poor in the other; the client's power and antennas set the return path.",
        "<strong>Gain moves coverage, it does not add it.</strong> A high-gain antenna stretches the beam in one direction at the expense of others, and regulators limit the EIRP it produces.",
    ])
    c += validate_block([
        "Stand next to an access point and record the signal strength at 1, 2, 4 and 8 m along a clear line. Each doubling of distance should cost roughly 6 dB in free space and more in a cluttered room. The slope gives you the exponent: n = (signal at 1 m - signal at d) / (10 log<sub>10</sub> d).",
        "Rotate a phone or laptop by 90 degrees at the same spot and see how much the signal changes.",
        "Question to answer: with the same transmit power, how much shorter is the range at 6 GHz than at 2.4 GHz in free space? (Answer: free-space loss is 20 log<sub>10</sub>(6135 / 2437) = 8.0 dB higher, so the range is 10<sup>8.0/20</sup> = 2.5 times shorter.)",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "fprop", "Propagation quiz")
    c += refs([ITU_P525, ITU_P1238, OFCOM_IR2030], "Free-space loss is defined by ITU-R P.525 and indoor models by ITU-R P.1238. Antenna patterns in the models are idealised teaching shapes, and the exponent and wall losses are inputs to explore, not measured values. The EIRP limits are from Ofcom IR 2030 for the UK; other regions set their own.")
    return c


# ======================================================================
# Modulation: QAM, OFDMA, MIMO
# ======================================================================
def lesson_qam():
    c = ""
    c += p("Once the waveform is chosen, the modulation decides how many bits ride on each symbol. QAM stacks more and more points on the same plane, trading robustness for speed.", "lab-lead")
    c += facts([("log2(M)", "bits in every symbol of M-point QAM"), ("6 to 12", "bits per symbol from 64-QAM to 4096-QAM"), ("-82 to -57 dBm", "minimum sensitivity, BPSK 1/2 to 256-QAM 5/6, 20 MHz"), ("-5 to -32 dB", "allowed transmit error, BPSK 1/2 to 256-QAM 5/6")])

    c += callout("In plain words.", 'A treasure map with a grid of spots, each secretly labelled with a few bits. To send bits you point to one spot, using the loudness and timing of a wave. A bigger map has more spots, so each message carries more bits, but the spots are closer together, so in a noisy place it is easier to point at the wrong one.')
    c += model('journeyqam', 'qam', 'Watch it happen: QAM')
    c += h2("1. Definition", "What is QAM?")
    c += p("A carrier wave has an amplitude and a phase. <strong>Quadrature amplitude modulation</strong> varies both, by adding two carriers that are 90 degrees apart. They are called I (in-phase) and Q (quadrature). Every choice of I and Q is one point on a plane, a <strong>constellation</strong>, and one point is one <strong>symbol</strong> that carries a fixed number of bits.")
    c += ul([
        "<strong>BPSK</strong> has two points (1 bit per symbol), <strong>QPSK</strong> four (2 bits; it is the same as 4-QAM), <strong>16-QAM</strong> sixteen (4 bits), and so on.",
        "A square constellation with M points carries log<sub>2</sub>(M) bits per symbol: 64-QAM carries 6, 256-QAM 8, 1024-QAM 10 and 4096-QAM 12.",
        "A <strong>Gray-coded</strong> constellation labels neighbouring points so that they differ in only one bit.",
    ])
    c += callout("Not the same as OFDM.", "OFDM is the waveform that carries many subcarriers at once (see the OFDM topic). Each subcarrier then uses a modulation such as BPSK or QAM. The two choices are independent.")

    c += h2("2. Purpose", "More bits without more bandwidth")
    c += p("A channel's bandwidth limits how many symbols per second it can carry. To go faster you can widen the channel, use more antennas, or put more bits in each symbol. QAM is the third option, and it is why each Wi-Fi generation raised the top constellation: 64-QAM (802.11a/g/n), 256-QAM (802.11ac), 1024-QAM (802.11ax) and 4096-QAM (802.11be).")

    c += h2("3. Mechanism", "Points, noise and decisions")
    c += p("Choose a modulation and a signal-to-noise ratio. The small blue dots are the symbols a receiver sees; the receiver decides by picking the nearest point. When noise pushes a dot across the boundary between two points the symbol is wrong. Watch BPSK survive almost any noise while 4096-QAM falls apart.")
    c += model("qam", None, "QAM constellation explorer")
    c += callout("Try this.", "(1) Set 64-QAM at 25 dB and then lower the SNR until the errors appear. (2) Switch to 256-QAM at the same SNR. (3) Find about how many dB it takes to hold 4096-QAM clean. (4) Use 16-QAM and read the Gray-coded bit pairs on neighbouring points.")

    c += h2("4. Visual", "The ladder of modulations in 802.11")
    c += p("802.11 pairs each modulation with a coding rate (the share of bits that are data rather than error protection). The standard sets two numbers for each pair: how accurate the transmitter must be (relative constellation error, EVM, in dB) and how weak a signal the receiver must still decode. Both get stricter as the constellation gets denser.")
    rows = [("BPSK 1/2", "-5", "-82"), ("QPSK 1/2", "-10", "-79"), ("QPSK 3/4", "-13", "-77"), ("16-QAM 1/2", "-16", "-74"), ("16-QAM 3/4", "-19", "-70"), ("64-QAM 2/3", "-22", "-66"), ("64-QAM 3/4", "-25", "-65"), ("64-QAM 5/6", "-27", "-64"), ("256-QAM 3/4", "-30", "-59"), ("256-QAM 5/6", "-32", "-57")]
    c += table(["Modulation and coding rate", "Allowed transmit error (EVM), dB", "Minimum receiver sensitivity, 20 MHz, dBm"], [list(r) for r in rows])
    c += p("From IEEE Std 802.11-2020, clause 21 (VHT), Tables 21-24 and 21-25. The sensitivity figures assume a receiver noise figure of 10 dB and a 5 dB implementation margin. 1024-QAM (802.11ax) and 4096-QAM (802.11be) are defined in the later amendments, which are not in the 2020 edition; they demand tighter accuracy again.", "lab-refs")

    c += h2("5. Mathematics", "Spacing, bits and rate")
    c += ul([
        "<strong>Points and levels.</strong> A square M-QAM constellation has sqrt(M) levels on each axis, at -(sqrt(M) - 1), ... -1, +1, ... +(sqrt(M) - 1) before scaling. Scaling to unit average power divides by sqrt(2(M - 1) / 3).",
        "<strong>Spacing.</strong> The gap between neighbours is then 2 / sqrt(2(M - 1) / 3). For 64-QAM that is 0.309; for 256-QAM 0.153. Halving the gap costs 6 dB of noise margin.",
        "<strong>Symbol errors.</strong> For square QAM and Gaussian noise, the symbol error rate is about 4(1 - 1/sqrt(M)) &times; Q(sqrt(3 &times; SNR / (M - 1))). The model above prints this value next to the simulated result.",
        "<strong>Rate gain.</strong> At the same coding rate, 256-QAM carries 8 / 6 = 1.33 times the bits of 64-QAM, 1024-QAM 10 / 8 = 1.25 times more than 256-QAM, and 4096-QAM 12 / 10 = 1.2 times more than 1024-QAM. The gains shrink while the SNR needed keeps rising.",
        "<strong>Example.</strong> 802.11ac on 80 MHz has 234 data subcarriers. With 256-QAM (8 bits), coding rate 5/6 and a 3.6 &micro;s symbol (short guard interval), one stream carries 234 &times; 8 &times; 5/6 / 3.6 &micro;s = 433.3 Mbit/s.",
    ])

    c += h2("6. Real-world behaviour", "Why high QAM is only for short range")
    c += ul([
        "<strong>The top rates need a very clean signal.</strong> The standard's 20 MHz sensitivity for 256-QAM 5/6 is -57 dBm against -82 dBm for BPSK 1/2: a 25 dB difference. In practice that means high modulations only near the access point and with little interference.",
        "<strong>Transmitter quality sets a ceiling.</strong> Even with a perfect channel, a radio whose own error (EVM) is too large cannot use a dense constellation. That is why 1024-QAM and 4096-QAM demand better radios.",
        "<strong>Rate adaptation.</strong> The sender keeps testing and chooses the densest constellation that still works. A client reporting a low rate is usually seeing a low SNR rather than a broken radio.",
        "<strong>Wider channels need more signal.</strong> Doubling the channel width doubles the noise power, so every rate needs about 3 dB more signal (the standard's table drops by 3 dB at each doubling).",
    ])
    c += validate_block([
        "In a capture, filter on data frames from one client and watch the data rate the radio information reports (the Wireshark field <code>wlan_radio.data_rate</code>) while you walk away from the access point. It steps down through the ladder as the SNR falls.",
        "Check the modulation and coding scheme (MCS) index reported in the radio information against the table in this topic.",
        "Question to answer: how much faster is a 1024-QAM link than a 256-QAM link at the same coding rate and width, and what must be true of the signal to get it?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "qam", "QAM quiz")
    c += refs([IEEE_STD, IEEE_TL, WFA_SPECS], "Constellation, EVM and sensitivity figures were checked against IEEE Std 802.11-2020 (clause 17 for BPSK to 64-QAM and clause 21 for 256-QAM). The symbol error approximation is standard communications theory. IEEE 802.11ax and 802.11be (1024-QAM and 4096-QAM) are later amendments.")
    return c


def lesson_ofdma():
    c = ""
    c += p("OFDM gives the whole channel to one device at a time. OFDMA, new in Wi-Fi 6, splits the channel into slices so that several devices can use it in the same moment.", "lab-lead")
    c += facts([("26 to 996", "tones in a resource unit (RU)"), ("9", "26-tone RUs in a 20 MHz channel"), ("78.125 kHz", "subcarrier spacing in 802.11ax"), ("12.8 + 0.8 µs", "symbol plus shortest guard interval")])

    c += callout("In plain words.", 'A school bus with nine seats. Before, one child rode the whole bus alone, then the next child had a turn. Now the driver seats several children at once, each in their own seats, and drives away just once.')
    c += model('journeyofdma', 'ofdma', 'Watch it happen: OFDMA')
    c += h2("1. Definition", "What is OFDMA?")
    c += p("<strong>Orthogonal frequency-division multiple access</strong> assigns groups of OFDM subcarriers to different users. A group is a <strong>resource unit (RU)</strong>. 802.11ax defines RUs of 26, 52, 106, 242, 484 and 996 tones (with a 2 &times; 996 for 160 MHz and 4 &times; 996 for 320 MHz in 802.11be). Each RU carries data and pilot subcarriers: a 26-tone RU has 24 data subcarriers and 2 pilots; 52-tone, 48 and 4; 106-tone, 102 and 4; 242-tone, 234 and 8; 484-tone, 468 and 16.")
    c += ul([
        "<strong>Resource unit:</strong> a block of subcarriers assigned to one client.",
        "<strong>Trigger frame:</strong> in uplink OFDMA, the access point sends a trigger frame that tells each client which RU to use and when, so all uplink frames start together.",
        "<strong>Scheduled access:</strong> the access point decides who gets which RU, instead of every device contending separately.",
    ])

    c += h2("2. Purpose", "Why share a channel?")
    c += p("A modern network has many devices each sending small packets: chat, sensors, acknowledgements. In OFDM each one pays the full cost of getting the channel (waiting, backoff, preamble, acknowledgement) to send a few hundred bytes. OFDMA lets the access point serve several of them in one transmission and spreads that fixed cost between them, which cuts delay and wasted airtime in crowded places. It helps least when one client is sending a large file.")

    c += h2("3. Mechanism", "Slice the channel")
    c += p("Choose a channel width and how to divide it. The chart shows the resource units across the channel. The bar chart compares the time needed to send the same small amount of data to every client one at a time (OFDM) with sending to all of them together in resource units (OFDMA). The fixed cost per transmission is yours to change.")
    c += model("ofdma", None, "OFDMA resource units")
    c += callout("Try this.", "(1) Choose 9 x 26 and a small payload of about 100 to 200 bytes: OFDMA wins by a large margin. (2) Raise the payload towards 1500 bytes: the gap narrows, because each client now needs the data time of a narrow slice. (3) Choose 1 x 242: with one client there is nothing to share.")

    c += h2("4. Visual", "Where each client sits")
    c += p("A 20 MHz channel has 256 subcarrier positions at 78.125 kHz spacing (the 802.11ax OFDM uses 4 times as many subcarriers as 802.11a/g, each 4 times narrower). A 242-tone RU covers the whole usable channel; two 106-tone RUs and a 26-tone RU, four 52-tone RUs and a 26-tone RU, or nine 26-tone RUs cover it in smaller pieces. A 40 MHz channel holds 18 of the 26-tone RUs. Compare the layouts in the model above.")

    c += h2("5. Mathematics", "The rate of a resource unit")
    c += ul([
        "<strong>Rate of an RU</strong> = data subcarriers &times; bits per subcarrier &times; coding rate &times; spatial streams / symbol time.",
        "<strong>Symbol time</strong> in 802.11ax is 12.8 &micro;s plus a guard interval of 0.8, 1.6 or 3.2 &micro;s. With 0.8 &micro;s that is 13.6 &micro;s.",
        "<strong>Example:</strong> a 26-tone RU at MCS 7 (64-QAM, 5/6), one stream: 24 &times; 6 &times; 5/6 / 13.6 &micro;s = <strong>8.8 Mbit/s</strong>. The whole 20 MHz channel (242-tone RU) at MCS 11 (1024-QAM, 5/6): 234 &times; 10 &times; 5/6 / 13.6 &micro;s = <strong>143.4 Mbit/s</strong>.",
        "<strong>Sharing:</strong> nine users on 26-tone RUs at MCS 7 get 8.8 Mbit/s each, 79.4 Mbit/s in total, which is a little lower than the 86.0 Mbit/s of one user on the whole channel at the same MCS (234 &times; 6 &times; 5/6 / 13.6 &micro;s), because each resource unit carries its own pilots: sharing gives up a little peak speed in exchange for waiting less and for the saved overheads.",
    ])

    c += h2("6. Real-world behaviour", "What to expect")
    c += ul([
        "<strong>Both sides must support it.</strong> OFDMA needs an 802.11ax or 802.11be access point and clients. Older clients still use ordinary OFDM and are served separately.",
        "<strong>The benefit is for many small flows.</strong> Offices, classrooms, stadiums and homes full of small devices see it most; a single speed test does not.",
        "<strong>Uplink is scheduled.</strong> Because clients wait for a trigger frame, uplink OFDMA can reduce collisions; but triggers also have their own overheads.",
        "<strong>Wi-Fi 7 refines it</strong> with multi-RU allocation, where one client can be given several RUs, and with puncturing around interference.",
    ])
    c += validate_block([
        "In a capture of an 802.11ax network, look for trigger frames sent by the access point. They are control frames; the Wireshark display filter reference lists the HE fields.",
        "Compare airtime used by many small flows on an 802.11n versus an 802.11ax access point.",
        "Question to answer: why does OFDMA not make a single large download faster?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "ofdma", "OFDMA quiz")
    c += refs([IEEE_WG, IEEE_TL, WFA_SPECS, WS_WLAN], "802.11ax numerology (resource units, 78.125 kHz spacing, 12.8 &micro;s symbols) is arithmetically derived from the 256-point FFT and is defined in IEEE 802.11ax; it is not in the 2020 edition of the base standard. The time comparison in the model uses a fixed cost per transmission that you can change; it illustrates the effect and is not a measured result.")
    return c


def lesson_mimo():
    c = ""
    c += p("Several antennas can do three different jobs: carry several streams at once, steer a beam, or serve several clients together. They all rely on the way waves add up.", "lab-lead")
    c += facts([("4, 8, 8, 16", "most spatial streams in 802.11n, ac, ax and be"), ("+6 dB", "beam gain of 4 antennas at the same total power"), ("half a wavelength", "usual antenna spacing: 6.2 cm at 2.4 GHz"), ("min(AP, client)", "streams are limited by the smaller antenna count")])

    c += callout("In plain words.", 'Two people talk at the same time to a listener with two ears. Because the ears are in different places, the listener’s brain can pull the two voices apart. MIMO does that with antennas and maths.')
    c += model('journeymimo', 'mimo', 'Watch it happen: MIMO')
    c += h2("1. Definition", "What is MIMO?")
    c += ul([
        "<strong>MIMO</strong> (multiple input, multiple output) uses several antennas at both ends of a link.",
        "<strong>Spatial multiplexing</strong> sends several independent streams on the same frequencies at the same time. Indoors, the echoes make each pair of antennas see a different mix, and the receiver can separate them.",
        "<strong>Beamforming</strong> adjusts the phase (and amplitude) at each antenna so the waves add up in a chosen direction.",
        "<strong>Diversity</strong> combines several copies of the same signal to protect against a fade.",
        "<strong>Multi-user MIMO (MU-MIMO)</strong> serves several clients at once, each with its own stream.",
    ])

    c += h2("2. Purpose", "Three ways to use more antennas")
    c += p("More antennas can raise speed (more streams), raise range or reliability (beamforming and diversity) or raise capacity in a crowd (MU-MIMO). They are not free: more antennas mean more radios, more power and more processing, and a phone has room for only two.")

    c += h2("3. Mechanism", "Steer a beam, count the streams")
    c += p("Panel A shows an array of antennas half a wavelength apart, each sending the same signal with a different delay. Change the number of antennas and steer the beam. Panel B shows how the number of antennas at each end and the generation limit the number of spatial streams.")
    c += model("mimo", None, "MIMO: beamforming and spatial streams")
    c += callout("Try this.", "(1) Use 1 antenna, then 2, 4 and 8: the beam narrows and the peak gain rises by 3 dB each time the count doubles. (2) Steer to 40 degrees and watch the beam broaden. (3) In panel B give the access point 8 antennas and the client 2: only two streams result.")

    c += h2("4. Visual", "How a beam forms")
    c += p("This is the superposition idea from Foundations, used deliberately. Each antenna's wave arrives in step in the steered direction and out of step elsewhere, so the energy adds up on one side and cancels on the others. The array factor of N antennas spaced half a wavelength apart is |sin(N&psi;/2) / (N sin(&psi;/2))|, where &psi; = &pi; (sin &phi; - sin &phi;<sub>0</sub>) and &phi;<sub>0</sub> is the steering angle.")

    c += h2("5. Mathematics", "Gain, width and rates")
    c += ul([
        "<strong>Array gain.</strong> With the same total power split over N antennas, the peak of a beam is 10 log<sub>10</sub>(N) dB stronger than one antenna: 3 dB for 2, 6 dB for 4, 9 dB for 8.",
        "<strong>Beamwidth.</strong> The half-power width of a broadside beam from N half-wavelength-spaced antennas is about 102 / N degrees, and it widens as the beam is steered to the side.",
        "<strong>Antenna spacing.</strong> Half a wavelength is 6.2 cm at 2437 MHz and 2.7 cm at 5500 MHz.",
        "<strong>Streams.</strong> N<sub>SS</sub> = min(AP antennas, client antennas, the generation's limit). The data rate scales directly with the number of streams.",
        "<strong>Reference rates.</strong> One 802.11n 20 MHz stream at MCS 7 is 52 &times; 6 &times; 5/6 / 4 &micro;s = 65 Mbit/s. One 802.11ac 80 MHz stream at MCS 9 is 234 &times; 8 &times; 5/6 / 4 &micro;s = 390 Mbit/s. Four streams of the latter make 1.56 Gbit/s.",
    ])

    c += h2("6. Real-world behaviour", "What limits it")
    c += ul([
        "<strong>A phone usually has two antennas,</strong> so it gets two streams at most, however many antennas the access point has. The extra access point antennas serve other clients or improve the signal.",
        "<strong>Spatial streams need a rich environment.</strong> In a clear line-of-sight link the streams look alike and cannot be separated. Reflections, which are a nuisance for a single stream, are what make MIMO work.",
        "<strong>Beamforming needs to know the channel.</strong> In 802.11ac and later the access point sends a sounding frame, and the client reports back how it received it. When the client moves, the information goes stale.",
        "<strong>MU-MIMO needs several clients with traffic at once,</strong> and works best when they are in different directions. Downlink MU-MIMO came with 802.11ac; 802.11ax added uplink MU-MIMO.",
    ])
    c += validate_block([
        "In a beacon from an access point, find the HT, VHT and HE capabilities elements and read how many spatial streams it advertises.",
        "Look at the capabilities in a client's association request and compare: the lower of the two sets the streams.",
        "Question to answer: a 4x4 access point serves a 2x2 phone and a 2x2 laptop. Which feature could let them both be served at the same instant at full rate?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "mimo", "MIMO quiz")
    c += refs([IEEE_STD, IEEE_TL, WFA_SPECS], "Stream limits and reference rates come from the HT (clause 19) and VHT (clause 21) PHYs of IEEE Std 802.11-2020 and from the 802.11ax and 802.11be amendments. Array gain and beamwidth are standard antenna theory for uniform linear arrays; the pattern in the model is ideal and ignores element patterns and coupling.")
    return c


# ======================================================================
# Part 4: How Wi-Fi shares the air
# ======================================================================
def protocol_hub():
    c = ""
    c += p("Many devices share one channel and none of them can listen while it is sending. This part is about the rules that let them take turns, and about how the generations of Wi-Fi changed what a turn is worth.", "lab-lead")
    c += h2("Topics", "Start with the rules, then the frames, then the generations")
    c += ('<!-- wp:html --><div class="lab-cards">'
          '<a class="lab-card" href="/lab/protocol/mac/"><em>Access to the channel</em><b>MAC</b><span>CSMA/CA, backoff, collisions, hidden nodes and what 54 Mbit/s really delivers.</span></a>'
          '<a class="lab-card" href="/lab/protocol/qos/"><em>Who goes first</em><b>QoS and WMM</b><span>Four waiting lines, priority labels 0 to 7, and where to see them in a capture.</span></a>'
          '<a class="lab-card" href="/lab/protocol/frames/"><em>Inside every frame</em><b>Frames</b><span>The MAC header of each protocol, field by field: what was added, how many bytes, and why.</span></a>'
          '<a class="lab-card" href="/lab/protocol/generations/"><em>Wi-Fi 1 to 7</em><b>Generations</b><span>What each amendment added, and the highest speed it allows.</span></a>'
          '</div><!-- /wp:html -->\n')
    c += callout("Where this fits.", "The band topics say where Wi-Fi sits in the spectrum and the modulation topics say how a signal is built. This part says who may send and when.")
    return c


def lesson_mac():
    c = ""
    c += p("A Wi-Fi radio cannot listen while it transmits, so it cannot detect collisions the way old wired Ethernet did. It tries to avoid them, and a large share of the time on every channel goes on that avoidance.", "lab-lead")
    c += facts([("16 / 9 µs", "SIFS and slot time, OFDM at 20 MHz"), ("10 / 20 µs", "SIFS and slot time, DSSS / CCK"), ("15 to 1023", "contention window range (OFDM)"), ("about 30 Mbit/s", "real throughput of a 54 Mbit/s link")])

    c += h2("1. Definition", "What does the MAC do?")
    c += p("The <strong>medium access control (MAC)</strong> layer decides who may transmit, builds the frames and checks that they arrive. The basic rule of 802.11 is <strong>CSMA/CA</strong> (carrier sense multiple access with collision avoidance), implemented as the <strong>distributed coordination function (DCF)</strong>.")
    c += ul([
        "<strong>Carrier sense.</strong> Listen before sending. The channel is busy if the radio hears a valid Wi-Fi signal or enough energy. A <strong>NAV</strong> (network allocation vector) timer also marks the channel busy for the duration written in a frame header.",
        "<strong>Interframe spaces.</strong> A station waits a short time before it acts. SIFS (the shortest) is used before an acknowledgement; <strong>DIFS = SIFS + 2 slots</strong> is used before a new transmission.",
        "<strong>Backoff.</strong> After DIFS the station waits a random number of idle slots, counting down while the channel is idle, then sends.",
        "<strong>Acknowledgement.</strong> The receiver answers every unicast frame with an ACK after a SIFS. No ACK means the sender doubles its contention window and tries again.",
        "<strong>Frame types.</strong> Management frames (beacons, authentication), control frames (RTS, CTS, ACK) and data frames.",
    ])

    c += h2("2. Purpose", "Why waiting is necessary")
    c += p("Wi-Fi is half duplex and the radio medium is shared by everyone within range. Two stations that talk at the same moment spoil both frames. Random backoff spreads the stations out in time so that, most of the time, only one of them sends in each slot.")

    c += h2("3. Mechanism", "Contention and collisions")
    c += p("The simulation keeps every station saturated: each always has a frame to send. Add stations and watch what happens to the share of transmissions that collide and the time lost to them.")
    c += model("csma", None, "DCF contention and collisions")
    c += callout("Try this.", "(1) With 2 stations, note the collision rate. Raise it to 10 and then 30. (2) Change aCWmin from 15 to 31 and see how a larger window trades fewer collisions for more idle time. (3) Use longer frames and notice that each collision then costs more.")

    c += h2("4. Visual", "Where the airtime goes")
    c += p("Even a station that has the channel to itself spends most of every frame on overheads. The bar shows one complete frame exchange: DIFS, average backoff, preamble, data, SIFS and acknowledgement. Only the green part is your data.")
    c += model("airtime", None, "Airtime of one frame exchange")
    c += table(["PHY (20 MHz)", "SIFS", "Slot", "DIFS = SIFS + 2 x slot", "aCWmin"], [["DSSS / HR-DSSS (802.11b)", "10 &micro;s", "20 &micro;s", "50 &micro;s", "31"], ["ERP (802.11g), long slot", "10 &micro;s", "20 &micro;s", "50 &micro;s", "31 for DSSS / CCK, 15 for OFDM"], ["ERP (802.11g), short slot", "10 &micro;s", "9 &micro;s", "28 &micro;s", "15 for OFDM"], ["OFDM (802.11a, 5 GHz)", "16 &micro;s", "9 &micro;s", "34 &micro;s", "15"]])
    c += p("From IEEE Std 802.11-2020, Tables 16-4, 17-21 and 18-5 (characteristics of the HR/DSSS, OFDM and ERP PHYs). aCWmax is 1023 for all of them.", "lab-refs")

    c += h2("5. Mathematics", "The overhead, with numbers")
    c += ul([
        "<strong>Contention window.</strong> The backoff is a random whole number of slots from 0 to CW, so on average CW / 2 slots. CW starts at aCWmin, becomes 2 &times; CW + 1 after each failure (15, 31, 63, 127 ... 1023) and returns to aCWmin after a success.",
        "<strong>One frame exchange, OFDM 54 Mbit/s, 1500 bytes:</strong> DIFS 34 &micro;s + average backoff 67.5 &micro;s + preamble and signal field 20 &micro;s + data 228 &micro;s + SIFS 16 &micro;s + ACK at 24 Mbit/s 28 &micro;s = <strong>393.5 &micro;s</strong>, which delivers 12 000 bits, or <strong>30.5 Mbit/s</strong>: 56% of the headline rate.",
        "<strong>The same at 6 Mbit/s:</strong> 2225.5 &micro;s for the frame exchange: 5.4 Mbit/s, which is 90% of the rate, because the data part is now long compared with the fixed overheads. Slow stations take a lot of airtime.",
        "<strong>802.11b, 11 Mbit/s, 1500 bytes:</strong> 1922 &micro;s, 6.2 Mbit/s: 57% of the rate; at 1 Mbit/s it is 0.92 Mbit/s and takes 13 ms of airtime for one frame.",
        "<strong>Small packets are worst:</strong> a 100-byte payload at 54 Mbit/s delivers just 4.3 Mbit/s, since the fixed overhead of about 185 &micro;s dwarfs the data.",
    ])
    c += h3("Quality of service: EDCA")
    c += p("802.11e added four access categories with different waiting rules. A higher-priority category waits less (a smaller AIFSN) and draws from a smaller contention window, so it wins more often:")
    c += table(["Access category", "AIFSN", "CWmin", "CWmax"], [["Background (AC_BK)", "7", "15", "1023"], ["Best effort (AC_BE)", "3", "15", "1023"], ["Video (AC_VI)", "2", "7", "15"], ["Voice (AC_VO)", "2", "3", "7"]])
    c += p("Default values for OFDM PHYs (aCWmin 15, aCWmax 1023) from Table 9-155 of IEEE Std 802.11-2020. The access point can announce different values to its clients.", "lab-refs")
    c += p('See the next topic, <a href="/lab/protocol/qos/">QoS and WMM: who goes first</a>, for a step-by-step story, the priority labels and how to find them in a capture.')

    c += h2("6. Real-world behaviour", "Hidden nodes, slow clients and aggregation")
    c += p("Two clients on opposite sides of an access point may not hear each other, so carrier sensing cannot work between them. Their frames collide at the access point. Switching on RTS/CTS lets the access point's CTS reserve the channel for both.")
    c += model("hidden", None, "The hidden node problem")
    c += ul([
        "<strong>Slow clients cost everyone.</strong> A frame sent at 6 Mbit/s occupies the channel nine times as long as one at 54 Mbit/s, so a single poor client reduces the throughput of all the others. Disabling the lowest data rates on an access point keeps such clients from connecting at rates that waste airtime.",
        "<strong>Aggregation.</strong> 802.11n introduced A-MPDU: many frames are sent behind one preamble and acknowledged together with a Block Ack, which recovers much of the overhead shown above.",
        "<strong>Retries show waste.</strong> A frame that is sent again uses airtime twice. A retry rate above about 10 to 15% is a common warning level in practice, though no standard sets it.",
        "<strong>Protection.</strong> In a 2.4 GHz network with 802.11b devices, newer devices send protection frames at slow rates first, costing yet more airtime.",
    ])
    c += validate_block([
        "Filter on retried frames with <code>wlan.fc.retry == 1</code> and compare their count with all data frames.",
        "Find RTS, CTS and ACK frames: <code>wlan.fc.type_subtype == 0x001b</code> (RTS), <code>0x001c</code> (CTS), <code>0x001d</code> (ACK), <code>0x0019</code> (Block Ack). Check the duration field (<code>wlan.duration</code>) that sets the NAV.",
        "Question to answer: a station sends at 6 Mbit/s and another at 54 Mbit/s, each the same frame size. How much more airtime does the slow one take per frame, ignoring overhead?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "mac", "MAC quiz")
    c += refs([IEEE_STD, IEEE_TL, WS_WLAN], "Slot, SIFS and contention window values and the EDCA defaults were checked against IEEE Std 802.11-2020 (Tables 9-155, 16-4, 17-21 and 18-5). The simulations are simplified teaching models: they ignore the interframe spaces between events, capture effect, rate adaptation and aggregation.")
    return c


def lesson_generations():
    c = ""
    c += p("Wi-Fi has changed shape many times since 1997. Each generation kept what worked and added one or two ideas. This topic maps those ideas and the headline speeds they allow.", "lab-lead")
    c += facts([("11 Mbit/s", "802.11b, 1999"), ("54 Mbit/s", "802.11a and g"), ("6.9 Gbit/s", "802.11ac, theoretical"), ("46 Gbit/s", "802.11be, theoretical")])

    c += h2("1. Definition", "Standards, amendments and names")
    c += ul([
        "<strong>IEEE 802.11</strong> is the family of standards. Each new feature is an <em>amendment</em> (802.11b, g, n, ac, ax, be) which is later merged into a new revision of the base standard.",
        "<strong>Wi-Fi Alliance names:</strong> Wi-Fi 4 (802.11n), Wi-Fi 5 (802.11ac), Wi-Fi 6 (802.11ax), Wi-Fi 6E (Wi-Fi 6 in 6 GHz) and Wi-Fi 7 (802.11be). Older generations never had an official brand.",
        "<strong>Certification</strong> by the Wi-Fi Alliance tests that devices interoperate. A standard being approved and a product being certified are separate events with different dates.",
    ])

    c += h2("2. Purpose", "Why there is a new generation")
    c += p("Every generation answers a limit of the one before: 802.11b needed more speed, 802.11g brought OFDM to 2.4 GHz, 802.11n added antennas, 802.11ac widened channels, 802.11ax fixed crowded networks, and 802.11be adds multi-link operation and very wide channels. A newer access point improves the experience of older clients less than people expect, because each client uses the best generation it supports.")

    c += h2("3. Mechanism", "Explore the generations")
    c += p("Click a generation to see its properties and how its top speed is built. Use the feature buttons to dim the generations that lack a feature.")
    c += model("generations", None, "Wi-Fi generations")

    c += h2("4. Visual", "What each generation added")
    c += table(["Generation", "Approved", "New in this generation"], [
        ["802.11b", "1999", "CCK, 5.5 and 11 Mbit/s in 2.4 GHz"],
        ["802.11a", "1999", "OFDM in 5 GHz, 54 Mbit/s"],
        ["802.11g", "2003", "OFDM in 2.4 GHz, compatible with 802.11b"],
        ["802.11n (Wi-Fi 4)", "2009", "MIMO (4 streams), 40 MHz channels, frame aggregation"],
        ["802.11ac (Wi-Fi 5)", "2013", "80 and 160 MHz channels, 256-QAM, downlink MU-MIMO, 5 GHz only"],
        ["802.11ax (Wi-Fi 6, 6E)", "2021", "OFDMA, 1024-QAM, uplink MU-MIMO, BSS colouring, target wake time, 6 GHz"],
        ["802.11be (Wi-Fi 7)", "2024", "320 MHz channels, 4096-QAM, multi-link operation, multi-RU and puncturing, 16 streams"],
    ])
    c += p("Approval dates are from the IEEE 802.11 Working Group timelines; 802.11ac was approved in December 2013. 802.11bn (the working name for a following amendment, aimed at reliability) is in development.", "lab-refs")

    c += h2("5. Mathematics", "How a headline speed is built")
    c += p("Highest rate = data subcarriers &times; bits per subcarrier &times; coding rate &times; spatial streams / symbol time, with the widest channel, the highest modulation and the most streams. For example:")
    c += ul([
        "<strong>802.11a/g:</strong> 48 &times; 6 &times; 3/4 / 4 &micro;s = 54 Mbit/s.",
        "<strong>802.11n:</strong> 108 &times; 6 &times; 5/6 &times; 4 / 3.6 &micro;s = 600 Mbit/s (40 MHz, 4 streams, short guard interval).",
        "<strong>802.11ac:</strong> 468 &times; 8 &times; 5/6 &times; 8 / 3.6 &micro;s = 6933 Mbit/s (160 MHz, 8 streams).",
        "<strong>802.11ax:</strong> 1960 &times; 10 &times; 5/6 &times; 8 / 13.6 &micro;s = 9608 Mbit/s (160 MHz, 8 streams).",
        "<strong>802.11be:</strong> 3920 &times; 12 &times; 5/6 &times; 16 / 13.6 &micro;s = 46 118 Mbit/s (320 MHz, 16 streams).",
    ])
    c += callout("Read the number with care.", "These are theoretical physical-layer rates. A real phone with two antennas on an 80 MHz channel reaches a small fraction, and the airtime model in the MAC topic shows that about half of any link rate goes on overhead.")

    c += h2("6. Real-world behaviour", "What users actually see")
    c += ul([
        "<strong>The client limits the link.</strong> Most phones have two antennas and a modest channel width, so the generation of the access point matters less than the client's.",
        "<strong>Backward compatibility has a cost.</strong> Legacy rates and protection mechanisms use airtime. Turning off old rates in a network with only modern clients helps everyone.",
        "<strong>Bands matter as much as generations.</strong> 6 GHz is only for 802.11ax and newer, which is why Wi-Fi 6E networks have no legacy clients.",
        "<strong>Features need both ends.</strong> OFDMA, MU-MIMO, MLO and 4096-QAM only work when the client supports them too.",
    ])
    c += validate_block([
        "In a beacon or an association request, find the HT Capabilities, VHT Capabilities and HE Capabilities elements to see which generations a device supports.",
        "Compare the rates a 2x2 phone reaches on the same access point in 20, 40 and 80 MHz channels.",
        "Question to answer: why is the highest 802.11ac rate in this topic not reachable on 2.4 GHz?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "gens", "Generations quiz")
    c += refs([IEEE_WG, IEEE_TL, WFA_6E_NAME, WFA_7, WFA_WIFI7, WFA_SPECS], "Approval dates follow the IEEE 802.11 Working Group timelines (802.11ac: December 2013). The highest rates are computed from the numerology of each PHY (clauses 17, 19 and 21 of IEEE Std 802.11-2020 for a/g/n/ac; the 802.11ax and 802.11be figures follow from the same relationships and amendments).")
    return c


def lives(rows):
    """The 'Where it lives' box that every protocol feature page carries: which standard, which layer, which frame."""
    return h2("Where it lives", "Which protocol, which layer, which frame") + table(["Question", "Answer"], rows)


def lesson_qos():
    c = ""
    c += p("Your Wi-Fi carries calls, films, web pages and backups at the same time. Quality of service is how the network decides who goes first when they all want the air at once.", "lab-lead")
    c += facts([("4", "waiting lines: voice, video, normal, background"), ("0 to 7", "the priority label on every packet"), ("47.5 to 146.5 &micro;s", "average wait, voice to background"), ("802.11e", "the amendment that added it")])
    c += callout("In plain words.", "Think of four queues at a theme park. The fast-track queue waits a little less than the others, so VIPs usually get on the ride first, but only when the park is busy. Each packet wears a number that says which queue it joins.")
    c += model('journeyqos', 'qos', 'Watch it happen: QoS and WMM')

    c += lives([
        ["Which standard added it?", "<strong>IEEE 802.11e</strong> (2005), now part of the base standard, IEEE Std 802.11-2020, where it is called EDCA (enhanced distributed channel access). The Wi-Fi Alliance certification name is <strong>WMM</strong> (Wi-Fi Multimedia)."],
        ["Which layer?", "The <strong>MAC</strong> layer (channel access). The priority label starts higher up, in the IP header (DSCP) or a VLAN tag, and is copied into the MAC header by the sender."],
        ["Which frame carries it?", "<strong>Every QoS Data frame</strong>: a 2-byte QoS Control field in the MAC header holds the label. The access point&rsquo;s waiting rules are announced in the <strong>Beacon</strong>, Probe Response and Association Response, in the EDCA Parameter Set element (element ID 12)."],
        ["Which Wi-Fi generations?", "Wi-Fi 4 (802.11n) and later devices are QoS devices by definition, so Wi-Fi 4, 5, 6, 6E and 7. Older 802.11a/b/g devices only have it if they were WMM certified."],
        ["Anything new in Wi-Fi 6?", "<strong>MU EDCA</strong> (802.11ax): the access point can make a station wait longer after it has been served in a multi-user transmission, so one device cannot hog the air."],
    ])

    c += h2("1. Definition", "What is QoS in Wi-Fi?")
    c += p("<strong>EDCA</strong> keeps the normal Wi-Fi rule (listen first, wait, then send, as in the MAC topic) but runs it <strong>four times in parallel</strong>, once per <strong>access category</strong>. Each category has its own waiting rules, so voice usually beats video, video beats normal traffic and normal traffic beats background.")
    c += h2("2. Purpose", "Why not treat everything the same?")
    c += p("Wi-Fi is shared, so every device waits for its turn. A call that waits too long breaks up, while a backup that waits a second is unnoticed. EDCA gives delay-sensitive traffic a head start without any central control.")

    c += h2("3. Mechanism", "The label, the four lines and the waiting rules")
    c += p("The sender puts a <strong>user priority</strong> (0 to 7) on each packet. It decides the access category:")
    c += table(["User priority", "Name used by Wireshark", "Access category", "Typical traffic"], [
        ["1, 2", "Background, Spare", "Background (AC_BK)", "backups, bulk transfers"],
        ["0, 3", "Best Effort, Excellent Effort", "Best effort (AC_BE)", "web, email, anything unlabelled"],
        ["4, 5", "Controlled Load, Video", "Video (AC_VI)", "streaming and conferencing video"],
        ["6, 7", "Voice, Network Control", "Voice (AC_VO)", "voice calls"],
    ])
    c += p("Each category waits <strong>AIFS = SIFS + AIFSN &times; slot</strong>, then counts down a random backoff from 0 to CWmin. These are the defaults for OFDM PHYs; the access point can announce others.")
    c += table(["Access category", "AIFSN", "CWmin", "CWmax", "Average wait"], [
        ["Voice", "2", "3", "7", "47.5 &micro;s"], ["Video", "2", "7", "15", "65.5 &micro;s"], ["Best effort", "3", "15", "1023", "110.5 &micro;s"], ["Background", "7", "15", "1023", "146.5 &micro;s"]])
    c += p("From IEEE Std 802.11-2020, Table 9-155, with SIFS 16 &micro;s and slot 9 &micro;s (OFDM, 20 MHz). Average wait = SIFS + AIFSN &times; slot + (CWmin / 2) &times; slot. The standard also gives each category a TXOP limit, the longest time it may keep the channel; it is not shown here.", "lab-refs")
    c += callout("Try this.", "In the player, change what you are doing, then press &ldquo;Run another race&rdquo; several times. The call line wins most races, but not every one: the priority is statistical, not a guarantee.")

    c += h2("4. Mathematics", "Working out the wait")
    c += ul([
        "<strong>Voice:</strong> 16 + 2 &times; 9 = 34 &micro;s fixed, plus on average 3 / 2 = 1.5 slots = 13.5 &micro;s, so <strong>47.5 &micro;s</strong>.",
        "<strong>Background:</strong> 16 + 7 &times; 9 = 79 &micro;s fixed, plus 15 / 2 = 7.5 slots = 67.5 &micro;s, so <strong>146.5 &micro;s</strong>.",
        "<strong>The difference</strong> is about 99 &micro;s per turn. That is tiny, but when ten devices compete for hundreds of turns a second, the lines with the smaller waits win far more of them.",
    ])
    c += h2("5. Real-world behaviour", "Why a label does not always help")
    c += ul([
        "<strong>Nothing happens on a quiet network.</strong> With no competition everyone sends at once.",
        "<strong>Many apps never set a label.</strong> Everything then lands in best effort and the voice and video lines stay empty.",
        "<strong>Routers can rewrite the label.</strong> The common shortcut of using the top three bits of the DSCP value as the Wi-Fi priority sends EF (DSCP 46, the usual voice marking) to priority 5, video. RFC 8325 recommends a mapping that sends it to 6.",
        "<strong>It only applies on the Wi-Fi hop.</strong> The label does nothing for congestion elsewhere on the path, such as your internet connection.",
        "<strong>Turn WMM on.</strong> On most access points it is on by default; turning it off can also limit the link speed of newer devices.",
    ])

    c += h2("In your capture", "Where to find it and how to filter it")
    c += p("These filters were tested with TShark 4.6 on a hand-built capture file with the same frame layout. Check them on your own capture and version, and remember that a monitor-mode capture only shows what your adapter heard.")
    c += table(["What you want to see", "Which frame and element", "Display filter"], [
        ["Packets that use QoS at all", "QoS Data frames (type/subtype 0x28). Plain Data frames are 0x20.", "<code>wlan.fc.type_subtype == 0x0028</code>"],
        ["The priority of each packet", "QoS Data frame &rarr; QoS Control &rarr; Priority and TID. Right-click Priority and choose Apply as Column.", "<code>wlan.qos.priority == 6</code><br><code>wlan.qos.priority &gt;= 4</code>"],
        ["How the packet is acknowledged", "QoS Control &rarr; Ack Policy (0 normal, 1 none, 3 Block Ack).", "<code>wlan.qos.ack == 3</code>"],
        ["The access point&rsquo;s waiting rules", "Beacon or Association Response &rarr; EDCA Parameter Set &rarr; one Ac Parameters entry per category: AIFSN, ECWmin/ECWmax, TXOP limit.", "<code>wlan.fc.type_subtype == 0x0008 &amp;&amp; wlan.tag.number == 12</code>"],
        ["The same rules as WMM", "The vendor-specific WMM/WME Parameter Element (Wi-Fi Alliance) in the same frames.", "<code>wlan.wfa.ie.wme.subtype</code>"],
        ["The MU EDCA rules (Wi-Fi 6)", "Beacon &rarr; MU EDCA Parameter Set extension element.", "<code>wlan.ext_tag.mu_edca_parameter_set.mu_edca_timer</code>"],
        ["The IP-level label", "The IP header, only visible on a wired capture or after decryption. Over the air, WPA2 and WPA3 hide it.", "<code>ip.dsfield.dscp == 46</code>"],
    ])
    c += ul([
        "<strong>Healthy:</strong> voice and video apps show priority 5 or 6, ordinary browsing shows 0, and the beacon lists four categories with voice and video using the smaller values.",
        "<strong>Problem:</strong> everything shows priority 0 (the label is missing or was rewritten), or the beacon has no EDCA element (the network is not using WMM).",
        "<strong>Reading the beacon:</strong> Wireshark shows the contention window as an exponent (ECW). CWmin = 2<sup>ECWmin</sup> &minus; 1, so ECWmin 4 means 15. The TXOP limit is in units of 32 &micro;s, and 0 means one frame.",
        "<strong>Question:</strong> a call app is marked DSCP 46 on the laptop, but the Wi-Fi capture shows priority 5. Where did the label change?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "qos", "QoS and WMM quiz")
    c += refs([IEEE_STD, WFA_SPECS, RFC8325, WS_WLAN], "The access categories, mapping and default values were checked against IEEE Std 802.11-2020 (Table 9-155 and the user priority mapping) and against the labels Wireshark itself uses. The WMM certification details are the Wi-Fi Alliance&rsquo;s; see its specifications page. The simulation is a teaching model.")
    return c


def lesson_bsscolor():
    c = ""
    c += p("In a block of flats, dozens of Wi-Fi networks share the same few channels, and the old rule says to wait whenever you hear any of them. Wi-Fi 6 lets a router tell a neighbour from its own network, and sometimes talk at the same time.", "lab-lead")
    c += facts([("1 to 63", "BSS colours (a 6-bit number)"), ("&minus;82 dBm", "default level below which a neighbour is ignored"), ("up to &minus;62 dBm", "highest level a device may raise it to"), ("802.11ax", "Wi-Fi 6, still used in Wi-Fi 7")])
    c += callout("In plain words.", "Imagine two classes sharing a hall, each wearing a different coloured bib. The old rule was: if anyone is talking, everyone stays silent. The new rule is: if the talker is wearing the other class&rsquo;s colour and is far away, you may talk too, just a little more quietly.")
    c += model('journeybss', 'bss', 'Watch it happen: BSS colouring')

    c += lives([
        ["Which standard added it?", "<strong>IEEE 802.11ax</strong> (Wi-Fi 6), published as IEEE Std 802.11ax-2021. It is an amendment, so it is not in the 2020 base edition of the standard. Wi-Fi 7 (802.11be) keeps it."],
        ["Which layer?", "It starts in the <strong>PHY</strong> (the colour is in the HE-SIG-A field of the PHY header, read in the first moments of a packet) and it changes a <strong>MAC</strong> decision: whether to treat the channel as busy."],
        ["Which frame carries it?", "<strong>Every HE packet</strong> carries the colour in its PHY header, so it is not in the MAC header. The access point&rsquo;s own colour is announced in the <strong>Beacon</strong>, Probe Response and Association Response, in the HE Operation element (BSS Color Information field)."],
        ["Which Wi-Fi generations?", "Wi-Fi 6, 6E and 7 only. Older devices cannot read the colour and keep following the old rule."],
        ["Which bands?", "All bands that Wi-Fi 6 runs on: 2.4 GHz, 5 GHz, and 6 GHz (Wi-Fi 6E)."],
    ])

    c += h2("1. Definition", "What are BSS colouring and spatial reuse?")
    c += p("A <strong>BSS</strong> (basic service set) is one access point and its clients. <strong>BSS colouring</strong> gives each BSS a number from 1 to 63 that every packet carries. <strong>Spatial reuse</strong> is what a device can do with it: it can ignore a packet from another BSS (an <strong>OBSS</strong>, an overlapping BSS) when that packet is weak enough, and transmit at the same time.")
    c += h2("2. Purpose", "Why waiting for the neighbour is a waste")
    c += p("Before Wi-Fi 6, every Wi-Fi signal above about &minus;82 dBm made the channel look busy, whichever network sent it. In dense buildings that means routers wait for each other when their clients are far apart and would not disturb each other at all.")

    c += h2("3. Mechanism", "Read the colour, then decide")
    c += table(["The packet heard is&hellip;", "Its level at my device", "What a Wi-Fi 6 device does"], [
        ["Same colour (my own network)", "any", "Treat it as mine: wait my turn as usual."],
        ["Different colour", "below &minus;82 dBm", "Ignore it, as the old rule already did."],
        ["Different colour", "between &minus;82 dBm and my threshold", "May treat the channel as idle and transmit, with <strong>lower transmit power</strong>."],
        ["Different colour", "above my threshold", "Wait: it is too loud to talk over."],
        ["Not Wi-Fi 6 (no colour)", "above &minus;82 dBm", "Wait, as before."],
    ])
    c += p("A device may raise its threshold from &minus;82 dBm up to &minus;62 dBm. The rule that keeps this fair: it must lower its transmit power by the <strong>same number of dB</strong> that it raised the threshold. The access point can also announce spatial reuse settings for its network in the Spatial Reuse Parameter Set element, including a group of friendly networks (an SRG) that may be more aggressive with each other.", "lab-refs")
    c += callout("Try this.", "In the player, scene 4: set the neighbour&rsquo;s colour to different, then drag the loudness from faint to loud and watch the decision change. Then set the colour to the same as yours.")

    c += h2("4. Mathematics", "The power trade-off, with numbers")
    c += ul([
        "<strong>Raise the threshold from &minus;82 to &minus;72 dBm:</strong> that is 10 dB, so the device must lower its transmit power by 10 dB. A router sending at 20 dBm (100 mW) then sends at 10 dBm (10 mW).",
        "<strong>Why it is fair:</strong> a transmitter that is 10 dB quieter disturbs the neighbour 10 times less, which is what you gave up by not waiting.",
        "<strong>The cost:</strong> at 10 dB less power the client sees a weaker signal, so it may need a slower data rate. Spatial reuse pays off when the client is close to its own router and far from the neighbour.",
    ])
    c += h2("5. Real-world behaviour", "What to expect")
    c += ul([
        "<strong>Gains depend on the building.</strong> Several networks, close together, with clients near their own routers, benefit most. A lone router benefits not at all.",
        "<strong>Old devices drag it down.</strong> A neighbour&rsquo;s Wi-Fi 5 device sends no colour, so Wi-Fi 6 devices still wait for it.",
        "<strong>Colour collisions happen.</strong> Two neighbouring routers can choose the same colour. They then treat each other as one network. An access point can send a BSS Color Change Announcement and move to another colour.",
        "<strong>Routers choose the colour themselves.</strong> Most home routers give you no setting for it.",
    ])

    c += h2("In your capture", "Where to find it and how to filter it")
    c += p("These filters were tested with TShark 4.6 on hand-built captures with the same element layout. Check them on your own capture and version. A colour per packet needs an adapter that records it, and many do not.")
    c += table(["What you want to see", "Which frame and element", "Display filter"], [
        ["The colour an access point uses", "Beacon or Association Response &rarr; HE Operation element &rarr; BSS Color Information &rarr; BSS Color.", "<code>wlan.ext_tag.bss_color_information.bss_color == 12</code>"],
        ["Colour switched off", "The same field group: BSS Color Disabled bit set while the colour is changing.", "<code>wlan.ext_tag.bss_color_information.bss_color_disabled == 1</code>"],
        ["A colour change being announced", "Beacon &rarr; BSS Color Change Announcement element: the new colour and a countdown of beacons.", "<code>wlan.ext_tag.bss_color_change.new_bss_color</code><br><code>wlan.ext_tag.bss_color_change.color_switch_countdown</code>"],
        ["The network&rsquo;s spatial reuse settings", "Beacon &rarr; Spatial Reuse Parameter Set element (SR Control, OBSS PD offsets, SRG colour bitmap).", "<code>wlan.ext_tag.spatial_reuse.sr_control</code>"],
        ["The colour of each packet", "Not in the MAC header. It is in the HE-SIG-A of the PHY header and appears in the radiotap HE field, only if the capture adapter reports it.", "<code>radiotap.he.data_3.bss_color == 7</code><br><code>radiotap.he.data_1.bss_color_known == 1</code>"],
    ])
    c += ul([
        "<strong>Healthy:</strong> your access point uses one colour that differs from the neighbours&rsquo;, and it does not keep changing.",
        "<strong>Problem:</strong> two access points on the same channel announce the same colour (a collision), or the colour keeps changing between beacons.",
        "<strong>Question:</strong> your capture shows no colour per packet at all. Is the network not using Wi-Fi 6, or is the capture adapter not recording it? Which frames help you decide?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "bss", "BSS colouring quiz")
    c += refs([IEEE_STD, WFA_SPECS, WS_WLAN, WS_RADIOTAP], "The colour range, the &minus;82 to &minus;62 dBm range and the power rule come from IEEE 802.11ax as described in IEEE Std 802.11ax-2021, which was not available to check line by line here, so treat the figures as the published summary and check them against the standard before you rely on them. The threshold used in the simulation (&minus;72 dBm) is an illustration. Filter names were tested on hand-built captures.")
    return c


def lesson_frames():
    c = ""
    c += p("Every Wi-Fi generation changed what a frame looks like. This topic lets you build the MAC header of each protocol, field by field, and see what was added, how many bytes it costs and why.", "lab-lead")
    c += facts([("24 bytes", "MAC header of a plain data frame"), ("+2 / +4 bytes", "QoS Control (802.11e) and HT Control (802.11n)"), ("14 bytes", "the shortest frames: ACK and CTS"), ("4 bytes", "FCS at the end of every frame")])

    c += h2("1. Definition", "Frames, MSDUs and PPDUs")
    c += ul([
        "<strong>MSDU</strong> (MAC service data unit): the payload handed down from the layer above, for example an IP packet with its 8-byte LLC/SNAP header. Up to 2304 bytes.",
        "<strong>MPDU</strong> (MAC protocol data unit): the real MAC frame: MAC header, frame body and FCS. This is what Wireshark calls an 802.11 frame.",
        "<strong>A-MSDU / A-MPDU:</strong> several MSDUs inside one frame, or several MPDUs sent back to back (aggregation, from 802.11n).",
        "<strong>PSDU</strong> (PHY service data unit): what the PHY carries, which is one MPDU or an A-MPDU.",
        "<strong>PPDU</strong> (PHY protocol data unit): the PSDU with the PHY preamble in front of it. This is what actually goes on the air.",
        "<strong>FCS</strong> (frame check sequence): a 32-bit CRC at the end of the MPDU.",
    ])
    c += h3("The three kinds of frame")
    c += ul([
        "<strong>Management</strong> frames set up and manage the network: beacons, probes, authentication, association, deauthentication.",
        "<strong>Control</strong> frames help deliver the others: RTS, CTS, ACK, Block Ack, and in 802.11ax the Trigger frame. They are short and have no sequence number.",
        "<strong>Data</strong> frames carry user traffic (and QoS Data frames carry a priority).",
    ])

    c += h2("2. Purpose", "Why the header looks like this")
    c += p("The header answers four questions for the receiver, in as few bytes as possible: <em>who is this for and from</em> (addresses), <em>what kind of frame is it</em> (Frame Control), <em>how long will the channel be busy</em> (Duration), and <em>is this a repeat</em> (Sequence Control). Each new generation added only the fields it needed (priority, then feedback for beamforming), and kept the rest the same so that old and new devices could share a channel.")

    c += h2("3. Mechanism", "Build the header of each protocol")
    c += p("Choose a protocol and a frame type. The boxes are the real fields in transmission order, with their widths in bytes. Orange-edged boxes are fields that this protocol added. Click any box for its meaning and its bits; switch To DS and From DS on a data frame to see the addresses change meaning.")
    c += model("macframe", None, "MAC header builder for each protocol")
    c += callout("Try this.", "(1) Choose QoS Data and move from 802.11e to 802.11n and tick +HTC: the header grows from 26 to 30 bytes. (2) Choose Data and turn both To DS and From DS on: a fourth address appears. (3) Click Beacon and step from 802.11 to 802.11ac: the frame body gains the HT and VHT elements. (4) Choose Trigger in 802.11ax and add clients: each one costs 5 bytes. (5) Click <em>Frame Control</em> and step through the protocols: the last bits and the list of frame subtypes change with each one.")

    c += h2("4. Visual", "What changed from protocol to protocol")
    c += table(["Protocol", "What it added to frames", "Cost"], [
        ["802.11 (1997), b, a, g", "Frame Control, Duration, three addresses, Sequence Control, FCS; an optional fourth address for bridges and mesh; RTS, CTS, ACK", "24-byte header (30 with a fourth address)"],
        ["802.11e (QoS)", "QoS Control field in QoS Data frames: traffic identifier, ack policy, A-MSDU present, queue size; Block Ack. <strong>Frame Control:</strong> subtype bit 7 becomes the QoS flag (new QoS data subtypes); new Block Ack Request and Block Ack subtypes", "+2 bytes"],
        ["802.11n (Wi-Fi 4)", "HT Control field (+HTC); A-MSDU and A-MPDU aggregation; compressed Block Ack; HT elements in management frames. <strong>Frame Control:</strong> the Order bit becomes +HTC; new Control Wrapper and Action No Ack subtypes", "+4 bytes; +28 and +24 bytes of elements in a beacon"],
        ["802.11ac (Wi-Fi 5)", "VHT variant of the HT Control field; larger MPDUs (up to 11 454 bytes) and A-MPDUs (up to 1 048 575 bytes); VHT elements. <strong>Frame Control:</strong> new Beamforming Report Poll and VHT NDP Announcement subtypes", "same 4 bytes; +14 and +7 bytes of elements"],
        ["802.11ax (Wi-Fi 6)", "HE variant of the HT Control field (a list of small control items); Trigger frame; HE elements. <strong>Frame Control:</strong> a new Trigger subtype", "same 4 bytes; Trigger frame 28 + 5 per client"],
        ["802.11be (Wi-Fi 7)", "Extends the same header and control items; EHT elements; larger aggregates", "same 4 bytes"],
    ])
    c += p("The HE and EHT details come from the 802.11ax and 802.11be amendments; the earlier rows are from IEEE Std 802.11-2020.", "lab-refs")
    c += callout("The Frame Control field changes too.", "It is always 16 bits, but each protocol claimed unused subtype values for its new frames, the Order bit became +HTC in 802.11n, and the WEP bit was renamed Protected Frame. Click <em>Frame Control</em> in the builder above and switch protocol to see the bits and the list of subtypes change. The 2020 edition of the standard no longer lists the point-coordination (PCF) data subtypes such as Data + CF-Poll: they were defined in 1997 but are now reserved, so the builder dims them.")
    c += h3("Who is Address 1, 2, 3 and 4?")
    c += p("The same three address fields change meaning with the To DS and From DS bits, depending on whether the frame is going into or out of the access point. This is the table from the standard (Table 9-30):")
    c += table(["To DS", "From DS", "Address 1", "Address 2", "Address 3", "Address 4"], [
        ["0", "0", "Destination (receiver)", "Source (transmitter)", "BSSID", "not present"],
        ["0", "1", "Destination (receiver)", "BSSID (the AP, transmitter)", "Source", "not present"],
        ["1", "0", "BSSID (the AP, receiver)", "Source (transmitter)", "Destination", "not present"],
        ["1", "1", "Receiver", "Transmitter", "Destination", "Source"],
    ])
    c += p("A client sending to the access point uses 1 / 0. The access point forwarding to a client uses 0 / 1. 1 / 1 is used between access points in a bridge or mesh, which is the only reason a fourth address exists.")

    c += h2("5. Mathematics", "Sizes and overhead")
    c += ul([
        "<strong>Header length</strong> = 24 + 6 (if To DS and From DS are both 1) + 2 (if QoS Data) + 4 (if +HTC). Management frames are 24 bytes (+4 with +HTC).",
        "<strong>Control frames:</strong> RTS 20 bytes (Frame Control 2, Duration 2, two addresses 12, FCS 4); CTS and ACK 14 bytes; Block Ack 32 bytes in its compressed form (152 bytes in the original 802.11e form with a 128-byte bitmap); a Trigger frame 28 + 5 &times; (number of clients) bytes.",
        "<strong>Security overhead:</strong> TKIP adds 20 bytes (8-byte IV, 8-byte MIC, 4-byte ICV), CCMP-128 adds 16 (8-byte header and 8-byte MIC), CCMP-256 24, GCMP 24 (8-byte header and a 16-byte MIC), WEP 8.",
        "<strong>Overhead of one frame</strong> = (header + security + FCS) / frame size. For a QoS Data frame with CCMP, the overhead is 26 + 16 + 4 = 46 bytes: 3.0% of a frame carrying 1500 bytes, but 31% of one carrying 100 bytes.",
        "<strong>An A-MSDU subframe</strong> is a 14-byte header (destination 6, source 6, length 2), the MSDU, and padding to a multiple of 4 bytes. <strong>An A-MPDU subframe</strong> is a 4-byte delimiter (1 + 1 + 14 + 8 + 8 bits: end-of-frame flag, reserved, MPDU length, CRC, and the signature 0x4E), the MPDU, and padding to a multiple of 4.",
    ])
    c += table(["Limit", "Size"], [["MSDU and management frame body", "2304 bytes"], ["A-MSDU (802.11n)", "3839 or 7935 bytes"], ["MPDU (802.11ac)", "3895, 7991 or 11 454 bytes"], ["PSDU (802.11n)", "65 535 bytes"], ["PSDU (802.11ac)", "4 692 480 bytes"]])
    c += p("From IEEE Std 802.11-2020, Table 9-25. A larger frame is a bigger gamble: one bit error in it spoils the whole frame, unless the frames are aggregated as separate MPDUs.", "lab-refs")

    c += h2("6. Real-world behaviour", "The preamble and aggregation")
    c += p("The MAC header is only half the story. In front of every frame the PHY adds a preamble. The first part is always the legacy preamble, so that any device can read the length and stay quiet; later generations add their own fields behind it, and the preamble grows with the number of spatial streams.")
    c += model("ppdu", None, "PHY preambles of each protocol")
    c += p("Each frame also pays for waiting for the channel and for its acknowledgement, which is why aggregation was invented. An A-MSDU shares one header across several packets; an A-MPDU keeps a header for each frame but shares the preamble, the wait and the acknowledgement.")
    c += model("aggregation", None, "Aggregation: A-MSDU and A-MPDU")
    c += callout("Worked example.", "Eight packets of 300 bytes at 300 Mbit/s, QoS Data with CCMP. Sent as eight separate frames, they take about 1528 µs and deliver 4% of the data rate. As an A-MSDU they take about 252 µs (25%), and as an A-MPDU about 262 µs (24%): six times faster, from the same radio, just by not repeating the wait, the preamble and the acknowledgement.")
    c += ul([
        "<strong>Retries show up in the header.</strong> The Retry bit and the repeated sequence number tell you which frames were sent again.",
        "<strong>Mixed networks pay too.</strong> To keep old devices quiet, a newer frame starts with the legacy preamble and sometimes a protection exchange.",
        "<strong>Capture tools add their own header.</strong> A monitor-mode capture starts every frame with a radiotap header (signal, rate, channel); that is not part of the 802.11 frame.",
    ])

    c += validate_block([
        "In a capture, filter on each frame type with <code>wlan.fc.type_subtype</code>, for example <code>0x0008</code> for a beacon and <code>0x0028</code> for a QoS Data frame, and compare the header lengths. Open the Frame Control field and find the To DS and From DS bits (<code>wlan.fc.ds</code>).",
        "Find a retry (<code>wlan.fc.retry == 1</code>) and look at its sequence number (<code>wlan.seq</code>): it repeats the number of the original.",
        "Open a beacon and expand the tagged parameters: look for HT Capabilities (tag 45), VHT Capabilities (tag 191) and the HE and EHT capability elements, and add up their sizes.",
        "Question to answer: a client's data frame to the access point has To DS = 1, From DS = 0. What would Address 3 hold if the client is browsing a website?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "frames", "Frames quiz")
    c += refs([IEEE_STD, IEEE_TL, WS_WLAN, WS_RADIOTAP], "Frame formats, field sizes and bit layouts were checked against IEEE Std 802.11-2020: Frame Control (Figures 9-3 and 9-4, subtype values in Table 9-1, +HTC and Protected Frame in 9.2.4.1.9 and 9.2.4.1.10), Sequence Control (9-7), QoS Control (Table 9-10), HT Control (Figures 9-11, 9-12 and 9-16), the address table (Table 9-30), size limits (Table 9-25), the A-MPDU delimiter (Table 9-527), A-MSDU subframes (Figure 9-69), CCMP and GCMP expansion (12.5.3 and 12.5.5) and the HT preamble timings (Table 19-6). HE and EHT items come from the 802.11ax and 802.11be amendments, which are not in the 2020 edition. Check Wireshark field names against your version.")
    return c


# ======================================================================
# Part 5: Connecting and coexisting
# ======================================================================
def connecting_hub():
    c = ""
    c += p("A Wi-Fi device has to find a network, prove it belongs, keep its connection as it moves, and live alongside everything else on the air. This part covers all four.", "lab-lead")
    c += h2("Topics", "Start with the connection, then the neighbours")
    c += ('<!-- wp:html --><div class="lab-cards">'
          '<a class="lab-card" href="/lab/connecting/association/"><em>Joining and moving</em><b>Association</b><span>Discovery, authentication, the four-way handshake, WPA3, roaming and sticky clients.</span></a>'
          '<a class="lab-card" href="/lab/connecting/coexistence/"><em>Sharing spectrum</em><b>Coexistence</b><span>Interference, Bluetooth and ZigBee, clear channel assessment and the rules in the UK, EU and US.</span></a>'
          '</div><!-- /wp:html -->\n')
    return c


def lesson_association():
    c = ""
    c += p("Before a single byte of your data moves, a device and an access point exchange a short, fixed conversation. Knowing its order is the fastest way to find out why a client will not connect.", "lab-lead")
    c += facts([("4", "frame exchanges to join a WPA2 network: discover, authenticate, associate, handshake"), ("102.4 ms", "default beacon interval (100 time units)"), ("15", "reason code for a failed four-way handshake"), ("802.11k, v, r", "the roaming helpers")])

    c += lives([
        ["Which standards?", "<strong>Authentication and association</strong> are in the base IEEE 802.11 standard. <strong>WPA2</strong> is the Wi-Fi Alliance name for the RSN security of IEEE 802.11i (2004). <strong>WPA3</strong> (Wi-Fi Alliance, 2018) uses SAE, the &ldquo;dragonfly&rdquo; handshake, which is also part of the base standard. Roaming helpers <strong>802.11k</strong> (neighbour reports), <strong>802.11v</strong> (BSS transition requests) and <strong>802.11r</strong> (fast transition) started as amendments and are now in the base standard."],
        ["Which layer?", "The <strong>MAC</strong> layer: management frames for joining and roaming. The four-way handshake that creates the encryption keys travels as <strong>EAPOL</strong> messages inside ordinary data frames."],
        ["Which frames carry it?", "Beacons and probe responses advertise the security (RSN element) and roaming support (mobility domain element). Then come <strong>Authentication</strong>, <strong>Association Request and Response</strong>, four <strong>EAPOL-Key</strong> messages, and for roaming <strong>Reassociation</strong> and Action frames."],
        ["Which Wi-Fi generations?", "All of them can join and use WPA2. <strong>WPA3</strong> is required for Wi-Fi 6E and Wi-Fi 7 devices on 6 GHz, and available on newer Wi-Fi 6 devices. 802.11k, v and r are optional on any generation."],
    ])

    c += h2("1. Definition", "The words")
    c += ul([
        "<strong>Discovery:</strong> finding networks, by listening for beacons (passive scanning) or by sending probe requests (active scanning).",
        "<strong>Authentication:</strong> in 802.11 terms a formal first step. Open-system authentication proves nothing; WPA3 uses it to carry the SAE exchange.",
        "<strong>Association:</strong> the client joins the access point, which records its capabilities and gives it an association ID.",
        "<strong>Key management:</strong> turning a password or an enterprise credential into the keys that encrypt the traffic.",
        "<strong>Roaming:</strong> moving from one access point to another without losing the session. <strong>Steering</strong> is the access point or controller persuading a client to move.",
    ])

    c += h2("2. Purpose", "What it protects against")
    c += p("Radio signals reach everyone nearby, so the network has to prove that a device is allowed in and keep what it sends private. Without encryption anyone in range can read the traffic and join the network. The handshake gives each client its own key, so one client cannot read another's traffic.")

    c += h2("3. Mechanism", "Step through the connection")
    c += p("Choose the type of network and click through each step. The diagram shows the frames, the card shows what they do, the Wireshark filter to find them and what failure looks like at that point.")
    c += model("assoc", None, "Connection sequence")
    c += table(["Security", "Introduced", "Protects with", "Notes"], [
        ["WPA", "2003", "TKIP", "A stop-gap for older hardware; no longer acceptable"],
        ["WPA2 (IEEE 802.11i)", "2004", "AES-CCMP; four-way handshake", "Personal (shared password) or Enterprise (802.1X / EAP)"],
        ["WPA3", "2018", "SAE for Personal; stronger keys for Enterprise; protected management frames", "Required for Wi-Fi 6E and 6 GHz operation, together with Enhanced Open (OWE) for open networks"],
    ])

    c += h2("4. Visual", "Roaming and the sticky client")
    c += p("A client walks between two access points. It decides for itself when to roam. Raise the roaming threshold and the client moves earlier; lower it and the client holds on to the first access point long after the second is stronger.")
    c += model("roaming", None, "Roaming between two access points")

    c += h2("5. Mathematics", "Keys and thresholds")
    c += ul([
        "<strong>Pairwise transient key.</strong> Both sides compute PTK = PRF(PMK, ANonce, SNonce, AP address, client address). The master key (PMK) comes from the password (Personal) or from 802.1X (Enterprise). The nonces are random numbers, so each connection gets fresh keys, and the key itself never crosses the air.",
        "<strong>Roaming rule.</strong> A typical client roams when its signal drops below a threshold and a candidate is stronger by a margin: here, with the access points 40 m apart and a threshold of -70 dBm, the client holds on to the first access point for about 7 m beyond the halfway point. The model uses free-space loss at 5 GHz with an exponent of 3.",
        "<strong>Beacon interval.</strong> The default is 100 time units; one time unit is 1024 &micro;s, so 102.4 ms. A client scanning 13 channels spends at least that long on each channel to hear every beacon, which is why active scans and 802.11k neighbour lists matter.",
    ])

    c += h2("6. Real-world behaviour", "Failures and fixes")
    c += table(["Reason code", "Meaning", "Usual cause"], [
        ["1", "Unspecified reason", "Anything; look at what happened just before"],
        ["2", "Previous authentication no longer valid", "Client or AP lost its state, often after a restart or a roam"],
        ["3", "Deauthenticated because the sender is leaving", "A client disconnecting normally"],
        ["4", "Disassociated due to inactivity", "The AP's idle timer expired, often a sleeping device"],
        ["5", "AP unable to handle all current stations", "The AP is full"],
        ["15", "4-way handshake timeout", "Wrong password, or weak signal during the handshake"],
        ["16", "Group key handshake timeout", "Client stopped answering during a key update"],
    ])
    c += p("Reason codes from IEEE Std 802.11-2020, Table 9-49.", "lab-refs")
    c += ul([
        "<strong>Sticky clients.</strong> Raise the minimum rate or signal an access point will accept, enable 802.11k and 802.11v where the clients support them, and avoid power levels so high that a distant access point still looks strong.",
        "<strong>Slow reconnects.</strong> A full re-authentication with 802.1X takes much longer than a handover with 802.11r (fast BSS transition), which carries the keys ahead.",
        "<strong>Protected management frames (802.11w)</strong> stop spoofed deauthentication frames from forcing a client off; WPA3 and the 6 GHz band require them.",
    ])
    c += validate_block([
        "Capture a client joining a network and find each step: <code>wlan.fc.type_subtype == 0x000b</code> (authentication), <code>0x0000</code> and <code>0x0001</code> (association request and response), <code>eapol</code> (the four-way handshake).",
        "Walk between two access points with a laptop capturing and find the reassociation request (<code>wlan.fc.type_subtype == 0x0002</code>). Note the signal of the old access point at that moment.",
        "Look for deauthentication (<code>0x000c</code>) and disassociation (<code>0x000a</code>) frames and read the reason code.",
        "Question to answer: a client repeatedly fails with reason 15 on one SSID only. What is the first thing to check?",
    ])
    c += h2("In your capture", "Where to find each step and how to filter it")
    c += p("These filters were tested with TShark 4.6 on hand-built captures with the same frame layout. Check them on your own capture and version.")
    c += table(["What you want to see", "Which frame and element", "Display filter"], [
        ["The security a network offers", "Beacon or Probe Response &rarr; RSN element &rarr; Auth Key Management (AKM) Suite. Type 2 is WPA2-Personal (PSK), 8 is WPA3-Personal (SAE), 1 is 802.1X, 4 and 9 are fast-transition versions.", "<code>wlan.rsn.akms.type == 8</code>"],
        ["A WPA3 (SAE) handshake starting", "Authentication frame with algorithm 3 (SAE). Sequence 1 is the commit, 2 the confirm.", "<code>wlan.fixed.auth.alg == 3</code>"],
        ["Joining and leaving", "Authentication, Association Request and Response; a refusal shows a status code, a disconnect shows a reason code.", "<code>wlan.fc.type_subtype == 0x000b</code><br><code>wlan.fixed.status_code != 0</code><br><code>wlan.fixed.reason_code</code>"],
        ["The four-way handshake", "Four EAPOL-Key frames inside data frames. Wireshark numbers them 1 to 4.", "<code>eapol</code><br><code>wlan_rsna_eapol.keydes.msgnr == 1</code>"],
        ["Fast roaming (802.11r) offered", "Beacon &rarr; Mobility Domain element. Access points that share a mobility domain ID can do fast transitions.", "<code>wlan.mobility_domain.mdid</code>"],
        ["An access point asking a client to move (802.11v)", "Action frame, category 10 (WNM), action 7: BSS Transition Management Request. Action 8 is the client&rsquo;s answer.", "<code>wlan.fixed.category_code == 10 &amp;&amp; wlan.fixed.action_code == 7</code>"],
        ["A neighbour list (802.11k)", "Action frame, category 5 (Radio Measurement): action 4 asks for the list, action 5 answers.", "<code>wlan.fixed.category_code == 5 &amp;&amp; wlan.fixed.action_code == 5</code>"],
        ["The client actually moving", "Reassociation Request (subtype 2). Compare the time between the last frame to the old access point and this frame.", "<code>wlan.fc.type_subtype == 0x0002</code>"],
    ])
    c += ul([
        "<strong>Healthy:</strong> authentication, association and all four EAPOL messages appear within a fraction of a second, in order.",
        "<strong>Problem:</strong> the handshake repeats (message 1 appears again and again: wrong password or a key mismatch), a status code is not 0, or a reason code appears right after the handshake.",
        "<strong>Question:</strong> a phone sits on a weak access point and never moves. Which frames would show whether the network ever suggested a better one?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "assoc", "Association quiz")
    c += refs([IEEE_STD, WFA_SEC, RFC3748, WS_WLAN], "Frame subtypes, reason codes (Table 9-49) and the beacon interval come from IEEE Std 802.11-2020. WPA, WPA2 and WPA3 dates and requirements are from the Wi-Fi Alliance. The roaming model is a simplified illustration with stated assumptions, not a model of any particular client.")
    return c


def lesson_coexistence():
    c = ""
    c += p("Wi-Fi shares its spectrum with other Wi-Fi networks and with devices that do not speak Wi-Fi at all. How it behaves depends on whether it can understand the signal, and the law decides how loud it may be.", "lab-lead")
    c += facts([("-82 dBm", "level at which Wi-Fi defers to a Wi-Fi signal (20 MHz)"), ("-62 dBm", "level at which it defers to any energy"), ("79", "Bluetooth channels, each 1 MHz wide"), ("2 MHz", "width of a ZigBee channel")])

    c += h2("1. Definition", "Kinds of interference")
    c += ul([
        "<strong>Co-channel interference:</strong> another Wi-Fi network on the same channel. Because Wi-Fi can decode it, the two share the airtime fairly: they take turns.",
        "<strong>Adjacent-channel interference:</strong> a network on a nearby but not identical channel. The radio cannot decode its preamble, so it counts as noise, and the transmissions cannot take turns. This is worse than co-channel.",
        "<strong>Non-Wi-Fi interference:</strong> Bluetooth, ZigBee, cordless phones, microwave ovens, baby monitors and poorly shielded electronics. They never take turns.",
        "<strong>Hidden nodes:</strong> stations that cannot hear each other (see the MAC topic).",
        "<strong>Clear channel assessment (CCA):</strong> the radio's decision that the channel is busy, which is what makes it wait.",
    ])

    c += h2("2. Purpose", "Why sharing rules exist")
    c += p("The licence-free bands only work if devices of many kinds tolerate each other. Wi-Fi's own rule is to listen before talking; the regulator's rules limit power, require radar detection in some 5 GHz channels, and decide who may use what, where.")

    c += h2("3. Mechanism", "What shares 2.4 GHz")
    c += p("The 2.4 GHz band is the most crowded. Choose a ZigBee channel and see where it sits among Wi-Fi channels 1, 6 and 11, then switch Bluetooth and a microwave oven on.")
    c += model("coexist", None, "Who shares the 2.4 GHz band")
    c += p("A Wi-Fi receiver declares the channel busy when it detects the start of a Wi-Fi transmission at -82 dBm or stronger (for a 20 MHz channel). It also treats any signal 20 dB stronger, at -62 dBm, as busy even if it cannot decode it. Between those two levels a non-Wi-Fi signal does not stop Wi-Fi at all: it simply adds noise, so it damages frames instead of making stations wait.")

    c += h2("4. Visual", "How much interference a receiver tolerates")
    c += p("The standard also says how strong an interfering signal on a neighbouring channel a receiver must survive. A faster rate tolerates less:")
    c += table(["Modulation and coding rate", "Adjacent channel rejection", "Alternate adjacent channel rejection"], [["BPSK 1/2", "16 dB", "32 dB"], ["QPSK 1/2", "13 dB", "29 dB"], ["16-QAM 1/2", "8 dB", "24 dB"], ["16-QAM 3/4", "4 dB", "20 dB"], ["64-QAM 2/3", "0 dB", "16 dB"], ["64-QAM 3/4", "-1 dB", "15 dB"]])
    c += p("Receiver performance requirements for 20 MHz OFDM, from IEEE Std 802.11-2020, Table 17-18. At 64-QAM 3/4 the receiver need not tolerate an interferer even as strong as the wanted signal on the next channel; \"alternate adjacent\" means two channels away.", "lab-refs")

    c += h2("5. Mathematics", "Overlap and thresholds")
    c += ul([
        "<strong>Channel spacing.</strong> 2.4 GHz channels are 5 MHz apart and 20 MHz wide, so channels 5 apart do not overlap; that gives 1, 6, 11.",
        "<strong>ZigBee.</strong> Channel k (11 to 26) is centred on 2405 + 5 &times; (k - 11) MHz. Channel 25 is at 2475 MHz, above Wi-Fi channel 11 (2462 MHz, 2452 to 2472 MHz).",
        "<strong>Bluetooth.</strong> A 20 MHz Wi-Fi channel covers about 21 of the 79 channels (27%). Adaptive frequency hopping lets Bluetooth skip them.",
        "<strong>Thresholds.</strong> Preamble detection at -82 dBm; energy detect at -82 + 20 = -62 dBm (20 MHz).",
    ])

    c += h2("6. Real-world behaviour", "Practical rules")
    c += ul([
        "<strong>Use 1, 6 and 11</strong> in 2.4 GHz when you have to share. A deliberately overlapping plan makes everyone's life worse than sharing a channel.",
        "<strong>Move to 5 and 6 GHz</strong> where there is more space, fewer neighbours and no household devices.",
        "<strong>Radar rules (DFS) in 5 GHz:</strong> a radar detected on a channel forces the network to leave it; the radar rules set a 60 second channel availability check before use, a 10 second window to move, and a 30 minute non-occupancy period.",
        "<strong>Wide channels multiply the problem.</strong> A 40 MHz channel in 2.4 GHz overlaps with everything; 160 MHz in 5 GHz leaves little room.",
        "<strong>Check what else is there</strong> with a spectrum analyser before blaming Wi-Fi.",
    ])

    c += h2("7. Rules and regulations", "UK first, then the EU and the US")
    c += p("Each domain starts with who sets the rules and then the limits. The tables open on the UK (Ofcom); switch to the EU (CEPT and ETSI) or the US (FCC). The region you choose is remembered across the lab.")
    c += model("region", label="Regulatory domain switch")
    c += h3("2.4 GHz")
    c += model("regrules", "2.4", "2.4 GHz rules by region")
    c += h3("5 GHz")
    c += model("regrules", "5", "5 GHz rules by region")
    c += h3("6 GHz")
    c += model("regrules", "6", "6 GHz rules by region")

    c += validate_block([
        "Scan for neighbouring networks and note their channels and signal levels. Count how many share your channel and how many sit on overlapping channels.",
        "Read the channel utilisation in the BSS Load element of a beacon (access points that support it announce how busy they are).",
        "Run a spectrum analyser (a Wi-Fi adapter with spectrum capability, or a dedicated tool) and look for energy that does not look like Wi-Fi.",
        "Question to answer: your network is on channel 6 and you see another strong network on channel 4. Would you move to channel 6 co-channel, or leave them overlapping? Why?",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "coex", "Coexistence quiz")
    c += refs([IEEE_STD, OFCOM_IR2030, ETSI_328, ETSI_893, ETSI_687, ECFR15, ECFR407, FCC_2051, BT_SPEC, IEEE_154], "CCA levels (-82 dBm and -62 dBm for 20 MHz) are from clause 17.3.10.6 of IEEE Std 802.11-2020 and the adjacent channel rejection figures from Table 17-18. ZigBee channel numbering follows IEEE 802.15.4. Regulatory limits are shown by region with their sources in the rule tables; regulators change them, so check the current text.")
    return c


# ======================================================================
# Part 6: Measuring and validating
# ======================================================================
def measurement_hub():
    c = ""
    c += p("A network is only as good as the evidence that it works. This part is about gathering that evidence: what to measure, how to read it, and how to prove a design before people depend on it.", "lab-lead")
    c += h2("Topics", "From a symptom to a sign-off")
    c += ('<!-- wp:html --><div class="lab-cards">'
          '<a class="lab-card" href="/lab/measurement/troubleshooting/"><em>Finding the cause</em><b>Troubleshooting</b><span>Signal, noise, SNR, rate and retries, and what users actually feel.</span></a>'
          '<a class="lab-card" href="/lab/measurement/engineering/"><em>Design and proof</em><b>Engineering</b><span>Capacity planning, surveys, standard test plans and a validation checklist.</span></a>'
          '</div><!-- /wp:html -->\n')
    return c


def lesson_troubleshooting():
    c = ""
    c += p("\"The Wi-Fi is slow\" is a symptom, not a diagnosis. This topic gives you the measurements that tell the likely causes apart, and a way to relate them to what the user feels.", "lab-lead")
    c += facts([("-101 dBm", "thermal noise floor in 20 MHz"), ("SNR = S - N", "signal minus noise, in dB"), ("150 ms", "one-way delay ITU-T G.114 regards as acceptable for most calls"), ("retries", "the clearest sign of wasted airtime")])

    c += h2("1. Definition", "What to measure")
    c += ul([
        "<strong>Signal strength</strong> (RSSI or dBm): how strong the wanted signal is at the receiver. Different devices scale it differently.",
        "<strong>Noise floor:</strong> the background level of unwanted energy, including thermal noise and interference.",
        "<strong>Signal-to-noise ratio (SNR):</strong> signal minus noise floor, in dB. It decides which rate a link can hold.",
        "<strong>Data rate and MCS:</strong> the physical rate chosen for each frame.",
        "<strong>Retry rate and loss:</strong> how many frames had to be sent again.",
        "<strong>Channel utilisation:</strong> how much of the time the channel is busy.",
        "<strong>Throughput, latency, jitter, loss:</strong> what the application experiences. Together they make up the <strong>quality of experience (QoE)</strong>.",
    ])

    c += h2("2. Purpose", "Why measure")
    c += p("Wi-Fi problems have many causes that feel the same to a user. A low rate can mean weak signal, high noise, a slow client or a busy channel; each needs a different fix. Measuring turns a guess into a short list.")

    c += h2("3. Mechanism", "From signal to rate")
    c += p("The model shows which rates a client can hold for a given signal and noise floor, using the receiver sensitivities the standard requires. Raise the noise floor and watch the usable rate fall even though the signal is unchanged.")
    c += model("snr", None, "Signal, noise and the rate a client can hold")
    c += callout("Try this.", "(1) Set the signal to -60 dBm and the noise floor to -95 dBm. (2) Raise the noise floor to -80 dBm without touching the signal. (3) Notice the margin on the best rate vanishing: a strong signal on a noisy channel is not a good link.")

    c += h2("4. Visual", "Does the link meet the need?")
    c += p("Users do not feel signal strength; they feel video that stutters or a call that clips. Enter measured throughput, latency, jitter and loss and see which applications are served well.")
    c += model("qoe", None, "Quality of experience")

    c += h2("5. Mathematics", "Noise, SNR and the budget")
    c += ul([
        "<strong>Thermal noise</strong> = -174 dBm/Hz + 10 log<sub>10</sub>(bandwidth in Hz). For 20 MHz that is -174 + 73 = <strong>-101 dBm</strong>; for 40 MHz -98 dBm; for 80 MHz -95 dBm; for 160 MHz -92 dBm. Doubling the width raises the floor by 3 dB.",
        "<strong>The receiver adds its own noise</strong> (its noise figure). The standard's minimum sensitivities assume a 10 dB noise figure and 5 dB implementation margin, which is about -91 dBm in 20 MHz.",
        "<strong>SNR = signal - noise floor.</strong> A signal of -60 dBm on a -95 dBm floor has 35 dB of SNR; the same signal on a -75 dBm floor has only 15 dB.",
        "<strong>Retry rate</strong> = frames with the retry bit set / data frames. The airtime lost is roughly proportional.",
        "<strong>Throughput</strong> can be tested with iperf3: <code>iperf3 -c server -t 30 -P 4</code> for TCP with four parallel streams, <code>-R</code> for the reverse direction and <code>-u -b 20M</code> for a UDP stream at 20 Mbit/s.",
    ])

    c += h2("6. Real-world behaviour", "Symptoms and likely causes")
    c += table(["Symptom", "Likely causes", "Check"], [
        ["Slow everywhere", "Busy channel, interference, wide channels", "Channel utilisation, retry rate, noise floor"],
        ["Slow in one place", "Weak signal or poor SNR, a wall", "Signal and SNR on the spot; walk around"],
        ["Drops when walking", "Sticky client, thin coverage between access points", "Reassociation frames, signal at the moment of roam"],
        ["Fine, then very slow at times", "Neighbour on the same channel, a non-Wi-Fi source, DFS channel change", "Time-based capture, spectrum view, DFS events"],
        ["Good download, bad calls", "Jitter or loss, not throughput", "Ping with a long run, retry rate, QoS settings"],
        ["Fast Wi-Fi, slow internet", "Not Wi-Fi at all", "Test wired to the same router; check DNS and the uplink"],
    ])
    c += ul([
        "<strong>Work from the bottom up.</strong> Check the signal and noise first, then the rates and retries, then the protocol steps, then the application.",
        "<strong>Change one thing at a time</strong> and measure again.",
        "<strong>Measure from the client's side.</strong> The access point's view of the link is not the client's.",
    ])
    c += validate_block([
        "Capture on the channel and filter for retries: <code>wlan.fc.retry == 1</code>. Then look at the signal in <code>radiotap.dbm_antsignal</code> and the data rate in <code>wlan_radio.data_rate</code> for the frames that are failing.",
        "Find TCP problems: <code>tcp.analysis.retransmission</code> and <code>tcp.analysis.lost_segment</code>.",
        "Run <code>ping -c 100 gateway</code> and look at the maximum and the spread of the round-trip times, not only the average.",
        "Question to answer: a user has -55 dBm but only 24 Mbit/s. List three measurements you would take, in order.",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "meas", "Measurement quiz")
    c += refs([IEEE_STD, ITU_G114, IPERF, WS_WLAN, WS_RADIOTAP], "Receiver sensitivities are from IEEE Std 802.11-2020 (Tables 17-18 and 21-25) with the noise figure and margin assumptions stated in 17.3.10.2. The QoE targets are planning rules of thumb, not standards; ITU-T G.114 is the only recommendation cited. Check Wireshark field names against your version, since they are updated over time.")
    return c


def lesson_engineering():
    c = ""
    c += p("Designing a Wi-Fi network means choosing where the access points go and how many, then proving that the result does what it was meant to. This topic gives you a sizing method and a validation routine.", "lab-lead")
    c += facts([("2 limits", "capacity and coverage: you need the larger"), ("about 50%", "of the link rate you can really use"), ("5 phases", "plan, design, install, validate, hand over"), ("TR-398", "Broadband Forum's standard test plan")])

    c += h2("1. Definition", "Design, survey and validate")
    c += ul([
        "<strong>Predictive design:</strong> a software model of the building places access points and predicts coverage. It is only as good as its wall and material settings.",
        "<strong>Site survey:</strong> measurements in the real building. A <em>passive</em> survey listens (signal, noise, channels); an <em>active</em> survey connects and tests throughput and roaming.",
        "<strong>Validation:</strong> proving after installation that the network meets the agreed targets, with the evidence saved.",
        "<strong>Capacity planning:</strong> making sure the access points can carry the traffic, not just reach every corner.",
    ])

    c += h2("2. Purpose", "Why this is a method, not a feeling")
    c += p("A network that has coverage everywhere can still be useless at 9 a.m. when a hundred people join. Capacity and coverage are two different limits, and fixing one does not fix the other. Writing the targets down first, and measuring against them at the end, is what separates engineering from guessing.")

    c += h2("3. Mechanism", "How many access points?")
    c += p("Enter the clients, their demand, the link rate and the floor area. The capacity figure follows from the airtime lesson: only about half of a link rate is usable, and keeping access points well under full load keeps delay low.")
    c += model("capacity", None, "Capacity and coverage planning")
    c += callout("Try this.", "(1) Leave the area alone and raise the number of clients until capacity becomes the limit. (2) Then increase the area and watch coverage take over. (3) Lower the share of the link rate you really get to 40% (a busy, mixed network) and see the effect.")

    c += h2("4. Visual", "The validation routine")
    c += p("A checklist is the simplest tool in the book. Work through the five phases and tick off each step; your progress is saved in this browser only.")
    c += model("checklist", None, "Wi-Fi design and validation checklist")

    c += h2("5. Mathematics", "The sizing rules")
    c += ul([
        "<strong>Capacity:</strong> access points = total demand / (link rate &times; usable share &times; target load). With 120 clients at 6 Mbit/s each (720 Mbit/s), a 600 Mbit/s link, 55% usable and a 50% load target: 720 / (600 &times; 0.55 &times; 0.5) = 4.4, so <strong>5 access points</strong>.",
        "<strong>Coverage:</strong> access points = floor area / the area one access point serves well. For 3000 m<sup>2</sup> and 400 m<sup>2</sup> each that is 7.5, so <strong>8</strong>. You need the larger of the two numbers, here 8.",
        "<strong>Channel reuse:</strong> access points that can hear each other on the same channel share its airtime, so extra access points add capacity only if they use different channels. In 2.4 GHz there are three; 5 and 6 GHz offer many more.",
        "<strong>Link balance:</strong> the client's transmit power is lower than the access point's. If an access point is much louder than clients, the downlink looks fine while the uplink is poor, so match the design to the weaker side.",
        "<strong>Per-client rate</strong> is roughly the usable throughput of the access point divided by the number of active clients.",
    ])

    c += h2("6. Real-world behaviour", "Standard tests and RF exposure")
    c += p("TR-398 from the Broadband Forum defines repeatable tests of Wi-Fi equipment in a lab, so that results can be compared between products and over time. Its test cases include:")
    c += table(["Group", "Test cases"], [["Radio performance", "Receiver sensitivity"], ["Baseline performance", "Maximum connection; maximum throughput; airtime fairness"], ["Coverage", "Range versus rate; spatial consistency"], ["Multiple stations", "Multiple stations performance; association and disassociation stability; downlink MU-MIMO"], ["Stability and robustness", "Long-term stability; coexistence with other access points"]])
    c += p("From TR-398 Issue 1 Corrigendum 1 (October 2019); later issues add more.", "lab-refs")
    c += ul([
        "<strong>Acceptance criteria belong in the contract.</strong> Agree the minimum signal, SNR, throughput, roaming time and packet loss and where they apply (for example, at the edge of every working area), and test against them.",
        "<strong>Test when busy.</strong> A survey at 7 a.m. in an empty building says little about a full one.",
        "<strong>Document everything:</strong> final positions, channels, power levels, firmware and the survey data, so that the next person can reproduce the network.",
        "<strong>RF exposure.</strong> Wi-Fi power is low, and installations must comply with the exposure guidelines the regulator applies (ICNIRP guidelines are the international reference). Keep the documentation to prove compliance when asked.",
    ])
    c += validate_block([
        "Write down the targets before the survey and mark each as pass or fail afterwards.",
        "Run a passive survey on all bands, an active survey with a real device and a throughput test with <code>iperf3 -c server -t 30 -P 4</code> at the worst point of coverage.",
        "Test roaming along every walking route with a client that is capturing, and record the reassociation time.",
        "Repeat the throughput test at the busiest time of the week and compare.",
    ])
    c += h2("Check your understanding", "Quick quiz")
    c += model("quiz", "eng", "Engineering quiz")
    c += refs([BBF_TR398, ICNIRP, IEEE_STD, IPERF], "The sizing method is an engineering approximation, not a standard: the usable share of the link rate and the target load are inputs you should choose from your own measurements. The TR-398 test case list was checked against the Issue 1 Corrigendum 1 document; later issues differ. RF exposure limits are set by national regulators; the ICNIRP guidelines are the international reference they commonly use.")
    return c


# ======================================================================
# Assemble
# ======================================================================
NEW = [
    {"slug": "propagation", "parent": "foundations", "title": "RF propagation and antennas: how far a signal reaches", "template": "lab-lesson", "status": "publish", "order": 3,
     "excerpt": "Path loss, link budgets, antenna gain and patterns, and the Fresnel zone, with models for range and antennas.", "content": lesson_propagation()},
    {"slug": "qam", "parent": "modulation", "title": "QAM: packing more bits into every symbol", "template": "lab-lesson", "status": "publish", "order": 5,
     "excerpt": "How constellations from BPSK to 4096-QAM carry bits, how noise causes errors, and what the standard requires.", "content": lesson_qam()},
    {"slug": "ofdma", "parent": "modulation", "title": "OFDMA: sharing a channel between clients", "template": "lab-lesson", "status": "publish", "order": 6,
     "excerpt": "How resource units split a channel in 802.11ax, with a model that compares OFDM with OFDMA.", "content": lesson_ofdma()},
    {"slug": "mimo", "parent": "modulation", "title": "MIMO and beamforming: using several antennas", "template": "lab-lesson", "status": "publish", "order": 7,
     "excerpt": "Spatial streams, beamforming and multi-user MIMO, with a beam-steering model and the stream limits of each generation.", "content": lesson_mimo()},
    {"slug": "protocol", "parent": "lab", "title": "How Wi-Fi shares the air: the protocol", "template": "lab-hub", "status": "publish", "order": 11,
     "excerpt": "Channel access, contention and the generations of Wi-Fi.", "content": protocol_hub()},
    {"slug": "mac", "parent": "protocol", "title": "802.11 MAC: how stations take turns", "template": "lab-lesson", "status": "publish", "order": 1,
     "excerpt": "CSMA/CA, backoff, collisions, hidden nodes and where the airtime of a frame really goes.", "content": lesson_mac()},
    {"slug": "qos", "parent": "protocol", "title": "QoS and WMM: who goes first", "template": "lab-lesson", "status": "publish", "order": 2,
     "excerpt": "How four access categories give calls and video a head start over downloads, and where to see it in a capture.", "content": lesson_qos()},
    {"slug": "frames", "parent": "protocol", "title": "Frames and the MAC header: what each protocol adds", "template": "lab-lesson", "status": "publish", "order": 3,
     "excerpt": "The MAC header of every 802.11 protocol, field by field, with sizes, bits, PHY preambles and aggregation.", "content": lesson_frames()},
    {"slug": "generations", "parent": "protocol", "title": "Wi-Fi generations: from 802.11b to Wi-Fi 7", "template": "lab-lesson", "status": "publish", "order": 4,
     "excerpt": "What each generation added and how its headline speed is built, with an interactive explorer.", "content": lesson_generations()},
    {"slug": "bsscolor", "parent": "protocol", "title": "Spatial reuse and BSS colouring: sharing with your neighbours", "template": "lab-lesson", "status": "draft", "order": 5,
     "excerpt": "How Wi-Fi 6 tells a neighbour from your own network and lets routers talk at the same time, and where to see it in a capture.", "content": lesson_bsscolor()},
    {"slug": "connecting", "parent": "lab", "title": "Connecting and coexisting", "template": "lab-hub", "status": "publish", "order": 12,
     "excerpt": "Joining a network, roaming, security and sharing spectrum.", "content": connecting_hub()},
    {"slug": "association", "parent": "connecting", "title": "Association, security and roaming", "template": "lab-lesson", "status": "publish", "order": 1,
     "excerpt": "The connection sequence from beacon to encrypted data, WPA2 and WPA3, and why clients stick to distant access points.", "content": lesson_association()},
    {"slug": "coexistence", "parent": "connecting", "title": "Coexistence and regulations", "template": "lab-lesson", "status": "publish", "order": 2,
     "excerpt": "Interference, clear channel assessment, Bluetooth and ZigBee, and the UK, EU and US rules for each band.", "content": lesson_coexistence()},
    {"slug": "measurement", "parent": "lab", "title": "Measuring and validating", "template": "lab-hub", "status": "publish", "order": 13,
     "excerpt": "Measurement, troubleshooting and proving a design.", "content": measurement_hub()},
    {"slug": "troubleshooting", "parent": "measurement", "title": "Measurement, troubleshooting and quality of experience", "template": "lab-lesson", "status": "publish", "order": 1,
     "excerpt": "Signal, noise, SNR, retries and rates, and how they relate to what users feel.", "content": lesson_troubleshooting()},
    {"slug": "engineering", "parent": "measurement", "title": "Validation and practical engineering", "template": "lab-lesson", "status": "publish", "order": 2,
     "excerpt": "Capacity and coverage planning, surveys, standard test plans and a validation checklist.", "content": lesson_engineering()},
]

if __name__ == "__main__":
    pages = B.PAGES + NEW
    json.dump(pages, open(B.OUT, "w"), indent=1)
    for pg in pages:
        print("%-14s %-9s %6d chars  %s" % (pg["slug"], pg["status"], len(pg["content"]), pg["title"]))
