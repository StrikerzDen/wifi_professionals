# Wi-Fi Professionals: handoff for the next session

Last updated: 2026-10-25. Read this first, then `~/.claude/projects/-home-zarian-Documents-Wi-Fi-Pro-Lab/memory/` (MEMORY.md indexes it; `wifi-professionals-site-setup.md` has the access and deploy steps, `lab-modulation-track.md` the book structure, `voice-recording-plan.md` the voice idea). No passwords or tokens are stored in any of these files.

## The project in one paragraph
wifi-professionals.com is a WordPress site on Hostinger with a custom block theme `wifi-pro` and an interactive, referenced book, "Wi-Fi Pro Lab" (under /lab/). The audience is ordinary people as well as engineers: every concept must be explained the way you would to a non-Wi-Fi person or a young child, but **never write "8-year-old" or any age on the site**. Engineering detail goes in a small "Technical note". Improve "slowly slowly". Keep AdSense, ads.txt and view counts intact.

## Standing rules
- Each band lesson shows only its own band. Regulation defaults to UK (Ofcom); EU and US are selectable and kept strictly separate.
- Modulation is its own track. The 2.4 GHz channel chart is one row along the frequency axis.
- Only valid protocols per band. Use real IEEE / Ofcom / ETSI / FCC / Wi-Fi Alliance references and say honestly what was not verified.
- Every protocol feature page must say **which standard/amendment added it, which layer, which frame, which Wi-Fi generations** ("Where it lives" table) and **where it shows in a capture with the display filter** ("In your capture" table). Test filters with `tshark` (4.6.4 is installed) on a hand-built pcap and say so on the page. Helper: `lives()` in `content/build_more.py`.
- Create new content as drafts; the user reviews, then says "publish". Ask before editing other published material or switching the live theme.
- No synthetic voice (the user disliked it; `USE_BROWSER_VOICE = false`).

## Current live state
- Theme version **0.8.5**. Site Kit + GA4 (tag GT-M6QBBMK5), AdSense `ca-pub-6443811753546351`, consent banner (AdSense GDPR message + Consent Mode) and the privacy page `/privacy-and-cookies/` are all live.
- Book: 26 pages. Parts: Foundations, 2.4/5/6 GHz bands, Modulation (DSSS, FHSS, CCK, OFDM, QAM, OFDMA, MIMO, each with a step-by-step "Watch it happen" story player), Protocol (MAC, **QoS and WMM (published)**, Frames, Generations), Connecting (Association, Coexistence), Measuring (Troubleshooting, Engineering).
- **Draft awaiting the user's review: "Spatial reuse and BSS colouring: sharing with your neighbours", page id 1078, slug `bsscolor`, parent protocol, order 5.** Its figures (colours 1 to 63, OBSS PD -82 to -62 dBm, "lower power by the same dB") are from memory of 802.11ax and were NOT checked in the standard; the page says so. To publish when the user approves: in `content/build_more.py` change its `"status"` to `"publish"`; add a card in `protocol_hub()`; add a `topic("Spatial reuse and BSS colouring", "/lab/protocol/bsscolor/", ...)` line in `content/build_lab.py` (Protocol group); add a link from the Generations page; then build and publish (commands below).
- Retrofit done so far: QoS (new), BSS colouring (new, draft), Association (Where it lives + In your capture added). MIMO story captions rewritten in plainer words; the other six players were reviewed and are already plain.

## To do next (in this order unless the user says otherwise)
1. Ask the user for a verdict on the BSS colouring draft; publish it per the steps above.
2. Retrofit "Where it lives" + "In your capture" onto: MAC, Frames, Generations, Coexistence, Troubleshooting, Engineering (and, if sensible, the band pages and modulation pages, with fields like the HT/VHT/HE capabilities elements). Verify each filter with a hand-made pcap first (see how in the notes below).
3. Build the topics still missing from the original `lab.html` (14 modules there; 9 covered, QoS and BSS colouring now done): **Antennas, patterns and VSWR**; **RF front-end, TSSI and calibration**; **Driver, firmware and where the logs come from** (the whole "embedded systems" area). Same format: story player, plain captions, Where it lives, In your capture, quiz, references. Draft first.
4. Voice: when the user says "ok I can record", follow `voice-recording-plan.md` (write the DSSS script first; they record on a phone; add a Listen button that plays one clip per scene).
5. Other ideas, only if asked: 5/6 GHz channel pickers, deeper content per topic, affiliate links plus disclosure page, US-state privacy message, clean-up of leftover themes/plugins.

## Things the user still has to do
Delete the deactivated `wp-file-manager` plugin in wp-admin; look at Site Kit -> Dashboard for the first visitor numbers; optionally fix the banner site name "WI-Fi-Professionals" in AdSense -> Sites; decide whether the About button should use info@wifi-professionals.com.

## How to work (commands, from `/home/zarian/Documents/Wi-Fi-Pro-Lab`)
- **Edit content:** `content/build_lab.py` (band + first modulation pages, hub) and `content/build_more.py` (everything else, the page list `NEW`, helpers `lives()`, `table()`). Quizzes live in `theme/wifi-pro/assets/lab/lab.js` (`QUIZ.<key>`). Story players: `assets/lab/journey.js` (helpers, player, DSSS/FHSS/CCK/OFDM) and `journey2.js` (QAM, OFDMA, MIMO, QoS, BSS). Player recipe: `J.player({title, bits|null, sliders, segs, reseed, reseedLabel, compute(ctx), scenes:[{title, say, pro, draw(svg,d,t,ctx)}]})`, register as `window.WifiLabModels.journeyX`, add `'journeyX'` to the allowlist in `theme/wifi-pro/functions.php`, and add `model('journeyX','x','label')` to the page. SVG viewBox is 1000x380.
- **Build + publish pages:** `python3 -I content/build_more.py` then `python3 -I content/publish_lab.py` (idempotent; credentials in `~/.config/wifi-pro-lab/wp.env`).
- **After any theme change:** bump `WIFI_PRO_VERSION` in `functions.php` (assets are cached 7 days), then upload by TUS: ask the Hostinger MCP (`hosting_files_generate-upload-url`, username u100311995, domain wifi-professionals.com), export TUS_URL / TUS_AUTH / TUS_REST, and from `theme/wifi-pro` run `../../tools/tus-upload.sh wp-content/themes/wifi-pro <files>`. 201/204 = success; 401 = token copied wrongly; 403 = rejected (get a fresh token). Verify with `curl -sL` on the live file and with a browser check using `waitUntil:'load'`.
- **Local preview:** from `sandbox/` run `npx @wp-playground/cli@3.1.58 server --blueprint=blueprint.json --mount-before-install=<abs path>/theme/wifi-pro:/wordpress/wp-content/themes/wifi-pro --mount-before-install=<abs path>/content:/wordpress/lab-content --port=9400`. It seeds every page as published. Fetch with a cookie jar (`curl -sL -c cj -b cj`), the first load redirects. Kill by pid from `ss -ltnp`, never `pkill -f wp-playground`.
- **Test capture filters:** build a tiny pcap with Python `struct` (link type 105 for raw 802.11, 127 for radiotap), then `tshark -r x.pcap -Y '<filter>'`. Field names: `tshark -G fields`; value labels: `tshark -G values`. Already verified: `wlan.qos.priority`, `wlan.qos.ack`, `wlan.tag.number == 12`, `wlan.wfa.ie.wme.subtype`, `wlan.ext_tag.bss_color_information.bss_color`, `wlan.ext_tag.bss_color_change.*`, `wlan.ext_tag.spatial_reuse.*`, `radiotap.he.data_3.bss_color`, `wlan.rsn.akms.type`, `wlan.fixed.auth.alg == 3`, `eapol` + `wlan_rsna_eapol.keydes.msgnr`, `wlan.mobility_domain.mdid`, `wlan.fixed.category_code`/`action_code`.
- The plugin install route through REST is blocked by the permission classifier: the user installs/deletes plugins in wp-admin.

## Known gaps and honesty notes
- Not verified in the standard text: the BSS colouring numbers (above); Wireshark behaviour on a real live capture (only hand-made pcaps); QoE targets and sizing percentages (labelled rules of thumb); TXOP limit defaults (deliberately left out).
- Analytics numbers only appear 24 to 48 hours after set-up.
