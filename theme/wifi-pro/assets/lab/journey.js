/* Wi-Fi Pro Lab: "Watch it happen" story players for the modulation track.
 * One player (scenes, plain-language caption, optional spoken voice, play/back/next) and one story per technique:
 * DSSS, FHSS, CCK and OFDM here; QAM, OFDMA and MIMO in journey2.js.
 * Each story follows one small message through: your bits, encode, send over the air (with noise), receive, decode.
 * The maths in every story is real (Barker correlation, CCK equation 16-1, a 64-point FFT for OFDM) and the
 * reference points are IEEE Std 802.11-2020 clause 16 (HR/DSSS) and clause 17 (OFDM). Teaching simplifications are
 * stated in the "technical note" under each scene. Voice uses the browser's own speech synthesis (nothing is sent anywhere).
 */
(function () {
	'use strict';
	var L = window.WifiLab;
	if (!L) { return; }
	var el = L.el, svg = L.svg, RM = L.RM, fmt = L.fmt;
	window.WifiLabModels = window.WifiLabModels || {};
	var J = window.WifiLabJourney = {};
	var W = 1000, H = 380;

	/* ---------- small helpers shared by all stories ---------- */
	J.rng = function (seed) { var a = seed >>> 0; return function () { a += 0x6D2B79F5; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
	J.gauss = function (r) { var u = 0, v = 0; while (u === 0) { u = r(); } while (v === 0) { v = r(); } return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
	J.ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
	J.prog = function (t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); };
	J.T = function (s, x, y, str, cls, anchor) { var n = svg('text', { x: x, y: y, class: 'j-t' + (cls ? ' ' + cls : ''), 'text-anchor': anchor || 'start' }); n.textContent = str; s.append(n); return n; };
	J.line = function (s, x1, y1, x2, y2, cls) { var n = svg('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: cls || 'j-axis' }); s.append(n); return n; };
	J.path = function (s, d, cls) { var n = svg('path', { d: d, class: 'j-line' + (cls ? ' ' + cls : '') }); s.append(n); return n; };
	J.rect = function (s, x, y, w, h, cls, r) { var n = svg('rect', { x: x, y: y, width: Math.max(0, w), height: Math.max(0, h), rx: r === undefined ? 8 : r, class: cls || 'j-box' }); s.append(n); return n; };
	J.circle = function (s, x, y, r, cls) { var n = svg('circle', { cx: x, cy: y, r: r, class: cls || 'j-dot' }); s.append(n); return n; };
	J.arrow = function (s, x1, y1, x2, y2, cls) {          // line with a simple arrow head
		var a = Math.atan2(y2 - y1, x2 - x1), h = 11;
		J.line(s, x1, y1, x2, y2, cls || 'j-axis j-axis--b');
		J.path(s, 'M' + (x2 - h * Math.cos(a - 0.45)) + ' ' + (y2 - h * Math.sin(a - 0.45)) + 'L' + x2 + ' ' + y2 + 'L' + (x2 - h * Math.cos(a + 0.45)) + ' ' + (y2 - h * Math.sin(a + 0.45)), cls ? cls.replace('j-axis', 'j-line') : 'j-line--m');
	};
	/* a row of boxes holding 1s and 0s; reveal is how many are shown (can be fractional); marks colours each box */
	J.bitBoxes = function (s, bits, cx, y, size, gap, reveal, marks) {
		var n = bits.length, w = n * size + (n - 1) * gap, x0 = cx - w / 2;
		bits.forEach(function (b, i) {
			var a = Math.max(0, Math.min(1, reveal - i)); if (a <= 0) { return; }
			var cls = marks ? (marks[i] ? 'j-box j-box--good' : 'j-box j-box--bad') : 'j-box j-box--' + b;
			var g = svg('g', { opacity: a, transform: 'translate(0 ' + ((1 - a) * -14) + ')' });
			g.append(svg('rect', { x: x0 + i * (size + gap), y: y, width: size, height: size, rx: Math.min(14, size / 4), class: cls }));
			var t = svg('text', { x: x0 + i * (size + gap) + size / 2, y: y + size * 0.68, class: 'j-t j-t--bit' + (b ? ' is-1' : ' is-0'), 'text-anchor': 'middle', style: 'font-size:' + Math.round(size * 0.55) + 'px' }); t.textContent = String(b); g.append(t);
			s.append(g);
		});
		return { x0: x0, w: w };
	};
	J.steppath = function (vals, x0, x1, ym, amp, frac) {   // held (rectangular) waveform, drawn up to fraction frac
		var w = (x1 - x0) / vals.length, d = '', lim = x0 + (x1 - x0) * frac;
		vals.forEach(function (v, i) { var y = ym - v * amp, xa = x0 + i * w, xb = Math.min(lim, xa + w); if (xa >= lim) { return; } d += (d ? 'L' : 'M') + xa.toFixed(1) + ' ' + y.toFixed(1) + 'L' + xb.toFixed(1) + ' ' + y.toFixed(1); });
		return d;
	};
	J.linepath = function (vals, x0, x1, ym, amp, frac, clip) {
		var n = Math.max(2, Math.floor(vals.length * frac)), d = '';
		for (var i = 0; i < n && i < vals.length; i++) { var v = clip ? Math.max(-clip, Math.min(clip, vals[i])) : vals[i]; d += (i ? 'L' : 'M') + (x0 + i / (vals.length - 1) * (x1 - x0)).toFixed(1) + ' ' + (ym - v * amp).toFixed(1); }
		return d;
	};
	J.fmtTime = function (sec) { return sec >= 1 ? fmt(sec, sec >= 10 ? 0 : 1) + ' seconds' : (sec >= 0.1 ? fmt(sec, 2) + ' seconds' : fmt(sec * 1000, sec * 1000 >= 10 ? 0 : 1) + ' milliseconds'); };

	/* the last scene of the rate-based stories: how long would one megabyte take at best */
	var SPEEDS = [['DSSS and FHSS (the first radios)', 1], ['CCK (802.11b)', 11], ['OFDM (802.11a and g)', 54], ['Wi-Fi 6, one stream, 80 MHz', 600]];
	J.speedScene = function (key, rate, say, pro) {
		return {
			title: 'How fast?', say: say, pro: pro,
			draw: function (s, d, t) {
				J.T(s, 40, 52, 'Time to send a 1 megabyte photo (8 million bits), best case', 'j-t--s');
				SPEEDS.forEach(function (r, i) {
					var y = 74 + i * 70, sec = 8 / r[1], len = (80 + 150 * Math.log(r[1]) / Math.LN10) * 1.4, here = r[0].indexOf(key) === 0, a = J.prog(t, i * 0.12, 0.5 + i * 0.12);
					J.T(s, 40, y, r[0] + ': ' + (r[1] === 600 ? 'about 600' : r[1]) + ' Mbit/s', here ? 'j-t--a' : 'j-t--s');
					J.rect(s, 40, y + 10, len * J.ease(a), 34, 'j-box j-bar ' + (here ? 'j-bar--on' : 'j-bar--off'), 8);
					if (a > 0.6) { J.T(s, 40 + len * J.ease(a) + 14, y + 36, J.fmtTime(sec), here ? 'j-t--a' : 'j-t--s'); }
				});
				J.T(s, 40, 358, 'Real life is slower: waiting for a turn, headers, retries and other people all take airtime.', 'j-t--s');
			}
		};
	};

	/* =====================================================================
	 * The player
	 * cfg: { title, bits:[...] | null, sliders:[{key,label,min,max,step,val,unit}], segs:[{key,label,options,val}],
	 *        reseed:bool, compute(ctx)->d, scenes:[{title, say, pro, draw(s,d,t,ctx)}] }
	 * ===================================================================== */
	var USE_BROWSER_VOICE = false;      // switched off: the owner does not like synthetic voices. Set true to bring the voice button back.
	var synth = window.speechSynthesis, canSpeak = USE_BROWSER_VOICE && !!(synth && window.SpeechSynthesisUtterance);
	function pickVoice() {
		var vs = synth.getVoices() || [], i;
		for (i = 0; i < vs.length; i++) { if (/^en-GB/i.test(vs[i].lang)) { return vs[i]; } }
		for (i = 0; i < vs.length; i++) { if (/^en/i.test(vs[i].lang)) { return vs[i]; } }
		return null;
	}
	function rich(str) {            // **word** becomes bold
		var out = document.createDocumentFragment();
		str.split('**').forEach(function (part, i) { out.append(i % 2 ? el('strong', { text: part }) : document.createTextNode(part)); });
		return out;
	}
	function plain(str) { return str.replace(/\*\*/g, ''); }

	J.player = function (cfg) {
		return function (root) {
			var ctx = { p: {}, bits: cfg.bits ? cfg.bits.slice() : null, seed: 7 };
			(cfg.sliders || []).forEach(function (sl) { ctx.p[sl.key] = sl.val; });
			(cfg.segs || []).forEach(function (sg) { ctx.p[sg.key] = sg.val; });
			var N = cfg.scenes.length, scene = 0, t = 1, raf = 0, playing = false, voice = false, timer = 0, token = 0, d = null;

			/* controls */
			var controls = el('div', { class: 'lab-controls lab-jny__ctl' });
			if (ctx.bits) {
				var bw = el('div', { class: 'lab-bits', role: 'group', 'aria-label': 'Your message' });
				ctx.bits.forEach(function (b, i) {
					var btn = el('button', { type: 'button', class: 'lab-bit', 'aria-pressed': String(b === 1), 'aria-label': 'bit ' + (i + 1) + ' = ' + b, text: String(b) });
					btn.addEventListener('click', function () { ctx.bits[i] = ctx.bits[i] ? 0 : 1; btn.textContent = String(ctx.bits[i]); btn.setAttribute('aria-pressed', String(ctx.bits[i] === 1)); btn.setAttribute('aria-label', 'bit ' + (i + 1) + ' = ' + ctx.bits[i]); refresh(); });
					bw.append(el('span', { class: 'lab-bit__w' }, [btn, el('span', { class: 'lab-bit__n', text: String(i + 1) })]));
				});
				controls.append(el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Your message (tap a bit to flip it)' }), bw]));
			}
			(cfg.sliders || []).forEach(function (sl) {
				var out = el('output', { text: sl.val + sl.unit }), inp = el('input', { type: 'range', min: sl.min, max: sl.max, step: sl.step, value: sl.val, 'aria-label': sl.label });
				inp.addEventListener('input', function () { out.textContent = inp.value + sl.unit; ctx.p[sl.key] = Number(inp.value); refresh(); });
				controls.append(el('label', { class: 'lab-ctl lab-ctl--range' }, [el('span', { class: 'lab-ctl__t' }, [document.createTextNode(sl.label + ': '), out]), inp]));
			});
			(cfg.segs || []).forEach(function (sg) { controls.append(el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: sg.label }), L.seg(sg.label, sg.options, sg.val, function (v) { ctx.p[sg.key] = Number(v); refresh(); })])); });
			if (cfg.reseed) {
				var again = el('button', { type: 'button', class: 'lab-btn lab-btn--ghost', text: cfg.reseedLabel || 'New noise' });
				again.addEventListener('click', function () { ctx.seed = Math.floor(Math.random() * 1e6); refresh(); });
				controls.append(el('div', { class: 'lab-ctl' }, [again]));
			}

			/* layout */
			var head = el('div', { class: 'lab-jny__head' }, [el('span', { class: 'lab-jny__kicker', text: 'Watch it happen' }), el('h3', { class: 'lab-jny__title', text: cfg.title })]);
			var steps = el('ol', { class: 'lab-jny__steps', 'aria-label': 'Scenes' });
			cfg.scenes.forEach(function (sc, i) {
				var b = el('button', { type: 'button', class: 'lab-jny__step', 'aria-label': 'Scene ' + (i + 1) + ': ' + sc.title }, [el('b', { text: String(i + 1) }), el('span', { text: sc.title })]);
				b.addEventListener('click', function () { playing = false; go(i); });
				steps.append(el('li', {}, [b]));
			});
			var stage = el('div', { class: 'lab-stage lab-jny__stage' });
			var say = el('p', { class: 'lab-jny__say' }), pro = el('p', { class: 'lab-jny__pro' });
			var bBack = el('button', { type: 'button', class: 'lab-btn lab-btn--ghost', text: '◀ Back' });
			var bPlay = el('button', { type: 'button', class: 'lab-btn', text: '▶ Play the story' });
			var bNext = el('button', { type: 'button', class: 'lab-btn lab-btn--ghost', text: 'Next ▶' });
			var bVoice = el('button', { type: 'button', class: 'lab-btn lab-btn--ghost lab-jny__voice', 'aria-pressed': 'false', text: '🔊 Voice: off' });
			var nav = el('div', { class: 'lab-jny__nav' }, [bBack, bPlay, bNext].concat(canSpeak ? [bVoice] : []));
			root.append(head, controls, steps, stage, el('p', { class: 'lab-jny__hint', text: 'Swipe the picture sideways to see all of it.' }), el('div', { class: 'lab-jny__text' }, [say, pro]), nav);
			root.classList.add('lab-model--jny');

			/* drawing */
			function render() {
				var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg j-svg', role: 'img', 'aria-label': cfg.title + ', scene ' + (scene + 1) + ' of ' + N + ': ' + cfg.scenes[scene].title });
				cfg.scenes[scene].draw(s, d, t, ctx);
				stage.replaceChildren(s);
			}
			function setText() {
				var sc = cfg.scenes[scene], txt = typeof sc.say === 'function' ? sc.say(d, ctx) : sc.say, pr = typeof sc.pro === 'function' ? sc.pro(d, ctx) : sc.pro;
				say.replaceChildren(rich(txt)); pro.replaceChildren(el('strong', { text: 'Technical note: ' }), document.createTextNode(pr));
				return txt;
			}
			function refresh() { d = cfg.compute(ctx); if (!raf) { t = 1; } setText(); render(); }
			function startAnim() {
				cancelAnimationFrame(raf); raf = 0;
				if (RM) { t = 1; render(); return; }
				var t0 = performance.now(), dur = cfg.scenes[scene].dur || 2800; t = 0;
				(function step(now) { t = Math.min(1, (now - t0) / dur); render(); raf = t < 1 ? requestAnimationFrame(step) : 0; })(t0);
			}

			/* voice and timing */
			function stopTimers() { clearTimeout(timer); token++; if (canSpeak) { synth.cancel(); } }
			function speak(str, done) {
				var my = ++token;
				if (!canSpeak) { return; }
				synth.cancel();
				setTimeout(function () {
					if (my !== token) { return; }
					var u = new SpeechSynthesisUtterance(plain(str)), v = pickVoice();
					u.lang = 'en-GB'; u.rate = 0.95; u.pitch = 1.03; if (v) { u.voice = v; }
					u.onend = function () { if (my === token && done) { done(); } };
					u.onerror = function () { if (my === token && done) { done(); } };
					synth.speak(u);
				}, 60);
			}
			function advance() { if (scene < N - 1) { go(scene + 1); } else { playing = false; ui(); } }
			function go(i) {
				stopTimers(); scene = Math.max(0, Math.min(N - 1, i));
				var sc = cfg.scenes[scene], txt = setText();
				say.setAttribute('aria-live', voice ? 'off' : 'polite');
				startAnim(); ui();
				if (voice && canSpeak) { speak(txt, function () { if (playing) { timer = setTimeout(advance, 900); } }); }
				else if (playing) { timer = setTimeout(advance, Math.max(6500, plain(txt).length * 70)); }
			}
			function ui() {
				Array.prototype.forEach.call(steps.children, function (li, i) { var b = li.firstChild; if (i === scene) { b.setAttribute('aria-current', 'step'); } else { b.removeAttribute('aria-current'); } b.classList.toggle('is-done', i < scene); });
				bBack.disabled = scene === 0; bNext.disabled = scene === N - 1;
				bPlay.textContent = playing ? '❚❚ Pause' : (scene === N - 1 ? '↺ Play again' : (scene === 0 ? '▶ Play the story' : '▶ Keep playing'));
				bVoice.setAttribute('aria-pressed', String(voice)); bVoice.textContent = '🔊 Voice: ' + (voice ? 'on' : 'off');
			}
			bBack.addEventListener('click', function () { playing = false; go(scene - 1); });
			bNext.addEventListener('click', function () { playing = false; go(scene + 1); });
			bPlay.addEventListener('click', function () {
				if (playing) { playing = false; stopTimers(); ui(); return; }
				playing = true; go(scene === N - 1 ? 0 : scene);
			});
			bVoice.addEventListener('click', function () {
				voice = !voice; ui();
				if (voice) { go(scene); } else { stopTimers(); say.setAttribute('aria-live', 'polite'); if (playing) { timer = setTimeout(advance, 5000); } }
			});
			window.addEventListener('pagehide', function () { if (canSpeak) { synth.cancel(); } });

			d = cfg.compute(ctx);
			go(0); t = 1; render();            // first scene shown complete; Play starts the story
			cancelAnimationFrame(raf); raf = 0;
		};
	};

	/* =====================================================================
	 * DSSS story
	 * ===================================================================== */
	var BARKER = [1, -1, 1, 1, -1, 1, 1, 1, -1, -1, -1];
	function dsssCompute(ctx) {
		var sig = [], pol = 1, sigma = ctx.p.noise / 100, r = J.rng(ctx.seed), r2 = J.rng(ctx.seed + 99), chips = [], rx = [], n = ctx.bits.length;
		ctx.bits.forEach(function (b) { pol = b ? -pol : pol; sig.push(pol); });
		sig.forEach(function (a) { BARKER.forEach(function (c) { chips.push(a * c); }); });
		chips.forEach(function (c) { rx.push(c + sigma * J.gauss(r)); });
		var corr = sig.map(function (_, i) { var sum = 0; for (var k = 0; k < 11; k++) { sum += rx[i * 11 + k] * BARKER[k]; } return sum; });
		var rec = corr.map(function (v, i) { var prev = i ? corr[i - 1] : 1; return v * prev < 0 ? 1 : 0; });
		var tx = [], rw = [], SP = 12;      // carrier samples: two cycles per chip (drawn simply; the real carrier has about 220 per chip)
		chips.forEach(function (c) { for (var k = 0; k < SP; k++) { var v = c * Math.sin(2 * Math.PI * 2 * k / SP); tx.push(v); rw.push(v + sigma * 0.6 * J.gauss(r2)); } });
		return { sig: sig, chips: chips, corr: corr, rec: rec, tx: tx, rw: rw, sigma: sigma, n: n, noiseBand: sigma * Math.sqrt(11) };
	}
	var DSSS_STORY = {
		title: 'Follow four bits from your phone to the other side',
		bits: [1, 0, 1, 1], reseed: true,
		sliders: [{ key: 'noise', label: 'Noise on the air', min: 0, max: 400, step: 10, val: 70, unit: '%' }],
		compute: dsssCompute,
		scenes: [
			{ title: 'Your message', say: 'Here is your message: four **bits**. A bit is the smallest piece of data, a yes or a no, shown as a 1 or a 0. Every photo, video and web page is just millions of these.',
				pro: 'At 1 Mbit/s the original 802.11 radio sends one bit per microsecond, one symbol per bit.',
				draw: function (s, d, t, c) { J.T(s, 500, 70, 'Your message', 'j-t--b', 'middle'); J.bitBoxes(s, c.bits, 500, 110, 110, 24, t * (c.bits.length + 0.6), null); J.T(s, 500, 290, c.bits.length + ' bits', 'j-t--b j-t--a', 'middle'); J.T(s, 500, 330, 'a bit is a yes or a no: 1 or 0', 'j-t--s', 'middle'); } },
			{ title: 'Flip or stay', say: 'First we turn each bit into a wave. The rule is simple: for a 1, **flip** the wave upside down. For a 0, keep it the same as before.',
				pro: 'This is DBPSK, a differential phase code: a 1 is a 180 degree phase change and a 0 is no change (IEEE Std 802.11-2020, Table 16-7).',
				draw: function (s, d, t, c) {
					var x0 = 60, x1 = 940, n = d.n, bw = (x1 - x0) / n, ym = 250, i;
					J.T(s, 40, 40, 'Rule:  1 = flip the wave over     0 = keep it as it was', 'j-t--a');
					for (i = 0; i <= n; i++) { J.line(s, x0 + i * bw, 80, x0 + i * bw, 330, 'j-grid'); }
					J.line(s, x0, ym, x1, ym, 'j-axis');
					for (i = 0; i < n; i++) {
						var a = J.prog(t, i / n, (i + 1) / n * 0.95 + 0.05), cx = x0 + (i + 0.5) * bw;
						if (a > 0) { J.bitBoxes(s, [c.bits[i]], cx, 90, 62, 0, 1, null); J.T(s, cx, 185, c.bits[i] ? 'flip' : 'stay', 'j-t--b ' + (c.bits[i] ? 'j-t--a' : 'j-t--brand'), 'middle'); }
					}
					J.path(s, J.steppath(d.sig, x0, x1, ym, 40, J.ease(t)), 'j-line--a');
					J.T(s, x0 + 6, ym + 74, 'start: right way up', 'j-t--s');
				} },
			{ title: 'Add the secret code', say: 'Now the clever part. We cut every bit into 11 tiny pieces called **chips**, and flip some of them following a secret pattern that the sender and the receiver both know. One bit becomes 11 chips. It looks messy, and that is exactly the point.',
				pro: 'The pattern is the 11-chip Barker sequence, +1 -1 +1 +1 -1 +1 +1 +1 -1 -1 -1, sent at 11 million chips per second (16.3.6.5). The signal now needs about 22 MHz instead of about 2 MHz.',
				draw: function (s, d, t) {
					var x0 = 60, x1 = 940, n = d.n, bw = (x1 - x0) / n, i;
					J.T(s, 40, 36, 'Before: one wave per bit', 'j-t--s'); J.path(s, J.steppath(d.sig, x0, x1, 100, 28, 1), 'j-line--m');
					J.T(s, 40, 186, 'After: every bit chopped into 11 chips, flipped by the secret pattern', 'j-t--s');
					J.line(s, x0, 250, x1, 250, 'j-axis');
					for (i = 0; i <= n; i++) { J.line(s, x0 + i * bw, 70, x0 + i * bw, 330, 'j-grid'); }
					J.path(s, J.steppath(d.chips, x0, x1, 250, 40, J.ease(t)), 'j-line--b');
					J.T(s, x0 + 4, 335, 'secret pattern: ' + BARKER.map(function (v) { return v > 0 ? '+' : '−'; }).join(' '), 'j-t--a');
					J.T(s, x0 + bw / 2, 300, '\u2190 one bit = 11 chips \u2192', 'j-t--s', 'middle');
				} },
			{ title: 'Through the air', say: 'The chips ride on a radio wave through the air. On the way, **noise** from microwave ovens, neighbours and distance adds random wobbles. What arrives looks even messier than what left.',
				pro: 'The picture shows two carrier cycles per chip so you can see them. The real carrier is at about 2.4 GHz, roughly 220 cycles per chip.',
				draw: function (s, d, t) {
					var x0 = 40, x1 = 960;
					J.T(s, 40, 34, 'What leaves your device', 'j-t--a'); J.line(s, x0, 110, x1, 110, 'j-grid'); J.path(s, J.linepath(d.tx, x0, x1, 112, 36, J.ease(t)), 'j-line--b');
					J.arrow(s, 500, 176, 500, 214, 'j-axis j-axis--b'); J.T(s, 520, 202, 'through the air, noise gets added', 'j-t--s');
					J.T(s, 40, 236, 'What arrives', 'j-t--brand'); J.line(s, x0, 312, x1, 312, 'j-grid'); J.path(s, J.linepath(d.rw, x0, x1, 312, 36, J.ease(t), 1.5), 'j-line--a');
				} },
			{ title: 'Match with the code', say: 'The receiver knows the secret pattern. It lines the pattern up with what it heard and adds everything up. The real signal piles up into a **tall bar**. The noise points in random directions, so it mostly cancels itself out.',
				pro: 'This is a correlator. The wanted signal adds to about plus or minus 11. Random noise adds only like the square root of 11, 3.3 times, so the signal-to-noise ratio improves 11 times: 10.4 dB, the processing gain.',
				draw: function (s, d, t) {
					var x0 = 60, x1 = 940, n = d.n, bw = (x1 - x0) / n, YC = 205, K = 8.5, i, nb = d.noiseBand * K;
					J.rect(s, x0, YC - nb, x1 - x0, 2 * nb, 'j-band', 4); J.T(s, x1, YC - nb - 8, 'noise alone gives about this much', 'j-t--s', 'end');
					J.line(s, x0, YC, x1, YC, 'j-axis');
					d.corr.forEach(function (v, k) {
						var h = Math.max(-14, Math.min(14, v)) * K * J.ease(J.prog(t, k * 0.18, k * 0.18 + 0.55)), cx = x0 + (k + 0.5) * bw;
						J.rect(s, cx - 38, h >= 0 ? YC - h : YC, 76, Math.abs(h), 'j-box j-bar j-bar--on', 6);
						J.T(s, cx, h >= 0 ? YC - h - 10 : YC - h + 26, (v > 0 ? '+' : '−') + Math.abs(Math.round(v)), 'j-t--b', 'middle');
						J.T(s, cx, 372, 'bit ' + (k + 1), 'j-t--s', 'middle');
					});
				} },
			{ title: 'Read your bits back', say: 'Last step. Look at each tall bar: did it point the **same way** as the one before, or did it flip? Flipped means 1, the same means 0. And there is your message, back again.',
				pro: 'Differential detection: a sign change between consecutive symbols means a 1 (IEEE Std 802.11-2020, Table 16-7).',
				draw: function (s, d, t, c) {
					var x0 = 60, x1 = 940, n = d.n, bw = (x1 - x0) / n, i, ok = true;
					J.T(s, 40, 36, 'Which way is each bar pointing?', 'j-t--s'); J.T(s, 40, 156, 'Flipped compared with the one before?', 'j-t--s'); J.T(s, 40, 262, 'Your message, received', 'j-t--s');
					d.corr.forEach(function (v, k) {
						var a = J.prog(t, k / n, (k + 1) / n), cx = x0 + (k + 0.5) * bw;
						if (a <= 0) { return; }
						J.T(s, cx, 100, v > 0 ? '▲ up' : '▼ down', 'j-t--b ' + (v > 0 ? 'j-t--brand' : 'j-t--a'), 'middle');
						J.T(s, cx, 200, d.rec[k] ? 'flipped = 1' : 'same = 0', 'j-t--b', 'middle');
					});
					J.bitBoxes(s, d.rec, 500, 276, 64, 30, t * (n + 0.6), d.rec.map(function (b, k) { return b === c.bits[k]; }));
					for (i = 0; i < n; i++) { if (d.rec[i] !== c.bits[i]) { ok = false; } }
					if (t > 0.9) { J.T(s, 500, 372, ok ? 'Sent ' + c.bits.join(' ') + ' and received ' + d.rec.join(' ') + ': same message!' : 'Sent ' + c.bits.join(' ') + ' but received ' + d.rec.join(' ') + ': noise won this time. Turn the noise down.', ok ? 'j-t--good' : 'j-t--bad', 'middle'); }
				} },
			J.speedScene('DSSS', 1, 'This radio sends one million bits every second. A one megabyte photo is eight million bits, so even in perfect conditions it takes about **eight seconds**. Slow, but very tough, so it can reach far.',
				'Best case: it ignores the packet headers, waiting for a turn and retries. The next topics pack more bits into each burst to go much faster.')
		]
	};
	window.WifiLabModels.journeydsss = J.player(DSSS_STORY);

	/* =====================================================================
	 * FHSS story: tones, hops, a loud neighbour, retries
	 * ===================================================================== */
	var HOPS = [14, 37, 62, 29, 70, 8, 52, 20];      // a made-up secret hop list (channel numbers 0 to 78, 1 MHz apart)
	function fhssCompute(ctx) {
		var w = ctx.p.busy, lo = 35 - w / 2, hi = 35 + w / 2, att = [], pkt = 0, k = 0;
		while (pkt < 2 && k < 8) { var ch = HOPS[k], bad = w > 0 && ch >= lo && ch <= hi; att.push({ ch: ch, pkt: pkt, ok: !bad }); if (!bad) { pkt++; } k++; }
		return { w: w, lo: lo, hi: hi, att: att, done: pkt === 2 };
	}
	function fhssGrid(s, d, cols, showNeighbour, t, rowLabel) {
		var x0 = 90, x1 = 940, y0 = 60, y1 = 320, cw = (x1 - x0) / cols;
		function fy(ch) { return y1 - (ch + 0.5) / 79 * (y1 - y0); }
		if (showNeighbour && d.w > 0) { var za = Math.min(1, t * 3); J.rect(s, x0, fy(Math.min(78, d.hi)), x1 - x0, Math.max(3, (fy(Math.max(0, d.lo)) - fy(Math.min(78, d.hi))) * za), 'j-zone', 4); J.T(s, x1, fy(Math.min(78, d.hi)) - 6, 'a neighbour’s Wi-Fi is on these channels', 'j-t--s', 'end'); }
		[0, 20, 40, 60, 78].forEach(function (ch) { J.T(s, x0 - 10, fy(ch) + 6, String(ch), 'j-t--s', 'end'); J.line(s, x0, fy(ch), x1, fy(ch), 'j-grid'); });
		J.T(s, 40, 40, 'channel number (each 1 MHz wide)', 'j-t--s'); J.T(s, x1, 354, 'time →', 'j-t--s', 'end');
		return { x0: x0, cw: cw, fy: fy };
	}
	var FHSS_STORY = {
		title: 'Follow four bits as the radio hops from channel to channel',
		bits: [1, 0, 1, 1],
		sliders: [{ key: 'busy', label: 'Busy neighbour: channels it blocks', min: 0, max: 44, step: 2, val: 22, unit: '' }],
		compute: fhssCompute,
		scenes: [
			{ title: 'Your message', say: 'Here is your message: four **bits**, a string of yes and no, written as 1s and 0s.', pro: 'The original 802.11 frequency-hopping radio sent 1 Mbit/s. FHSS belongs to the 1997 standard and no longer appears in IEEE Std 802.11-2020, so this is the historic radio.',
				draw: function (s, d, t, c) { J.T(s, 500, 70, 'Your message', 'j-t--b', 'middle'); J.bitBoxes(s, c.bits, 500, 110, 110, 24, t * (c.bits.length + 0.6), null); J.T(s, 500, 300, c.bits.length + ' bits', 'j-t--b j-t--a', 'middle'); } },
			{ title: 'High or low note', say: 'To send a bit we use a **whistle**: a high note means 1 and a low note means 0. It is like a tiny musical code.', pro: 'Frequency-shift keying: the 1 Mbit/s mode used two-level GFSK (Gaussian frequency shift keying) and the 2 Mbit/s mode four-level GFSK.',
				draw: function (s, d, t, c) {
					var x0 = 60, x1 = 940, n = c.bits.length, bw = (x1 - x0) / n, ym = 250, i, pts = [], tot = 600, ph = 0, lim = Math.floor(tot * J.ease(t));
					J.line(s, x0, ym, x1, ym, 'j-axis');
					for (i = 0; i <= n; i++) { J.line(s, x0 + i * bw, 80, x0 + i * bw, 330, 'j-grid'); }
					for (i = 0; i < tot; i++) { var bi = Math.min(n - 1, Math.floor(i / tot * n)), f = c.bits[bi] ? 9 : 3; ph += 2 * Math.PI * f / (tot / n); pts.push(Math.sin(ph) * 46); }
					var dd = ''; pts.forEach(function (v, k) { if (k <= lim) { dd += (k ? 'L' : 'M') + (x0 + k / tot * (x1 - x0)).toFixed(1) + ' ' + (ym - v).toFixed(1); } });
					J.path(s, dd, 'j-line--a');
					c.bits.forEach(function (b, k) { var cx = x0 + (k + 0.5) * bw; J.bitBoxes(s, [b], cx, 88, 56, 0, 1, null); J.T(s, cx, 176, b ? 'high note' : 'low note', 'j-t--b ' + (b ? 'j-t--a' : 'j-t--brand'), 'middle'); });
				} },
			{ title: 'Jump to a new channel', say: 'Here is the trick. We do not stay on one radio channel. We send a couple of bits, then **hop** to another channel, following a secret list that both sides know. Like hopscotch, in a pattern only your friend knows.',
				pro: 'The band is split into 79 channels of 1 MHz (North America and Europe). A real hop carries many bits; two bits per hop just keeps the picture readable.',
				draw: function (s, d, t, c) {
					var g = fhssGrid(s, d, 5, false, t), k;
					J.T(s, 940, 40, 'secret list: ' + HOPS.slice(0, 4).join(', ') + ', …', 'j-t--a', 'end');
					for (k = 0; k < 2; k++) {
						var a = J.prog(t, k * 0.4, k * 0.4 + 0.5), cx = g.x0 + (k + 0.5) * g.cw, cy = g.fy(HOPS[k]);
						if (a <= 0) { continue; }
						J.rect(s, cx - g.cw * 0.38, cy - 15 - (1 - a) * 60, g.cw * 0.76, 30, 'j-box j-box--hop', 6); J.T(s, cx, cy + 7 - (1 - a) * 60, c.bits[k * 2] + ' ' + c.bits[k * 2 + 1], 'j-t--bar is-on', 'middle');
						J.T(s, cx, 354, 'hop ' + (k + 1) + ': channel ' + HOPS[k], 'j-t--s', 'middle');
					}
				} },
			{ title: 'A loud neighbour', say: 'Now a noisy neighbour switches on: a Wi-Fi network that fills a wide stretch of channels. If a hop lands there, that piece is **spoiled**. But the next hop goes somewhere quiet, and the spoiled piece is simply sent again.',
				pro: 'A 22 MHz-wide Wi-Fi channel covers about 22 of the 79 hop channels, so roughly one hop in four is hit. Lost packets are retried on the next hop, so the message gets through a little slower.',
				draw: function (s, d, t, c) {
					var cols = 5, g = fhssGrid(s, d, cols, true, t), k, last = d.att.length;
					d.att.slice(0, cols).forEach(function (a, k) {
						var p = J.prog(t, 0.25 + k * 0.14, 0.4 + k * 0.14), cx = g.x0 + (k + 0.5) * g.cw, cy = g.fy(a.ch);
						if (p <= 0) { return; }
						J.rect(s, cx - g.cw * 0.38, cy - 15, g.cw * 0.76, 30, 'j-box ' + (a.ok ? 'j-box--good' : 'j-box--bad'), 6);
						J.T(s, cx, cy + 7, a.ok ? c.bits[a.pkt * 2] + ' ' + c.bits[a.pkt * 2 + 1] : '✖', 'j-t--bar is-on', 'middle');
						J.T(s, cx, 354, a.ok ? 'hop ' + (k + 1) + ': delivered' : 'hop ' + (k + 1) + ': spoiled', 'j-t--s', 'middle');
					});
					if (d.w === 0) { J.T(s, 500, 200, 'No neighbour: every hop is quiet', 'j-t--b j-t--good', 'middle'); }
					else if (!d.done) { J.T(s, 500, 200, 'So much is blocked that it takes many hops. Try fewer blocked channels.', 'j-t--b j-t--bad', 'middle'); }
				} },
			{ title: 'The receiver hops too', say: 'The receiver has the same secret list, so it jumps to the same channel at the same moment and listens for the high or low note. Put the good pieces together and your message is back.',
				pro: 'Both sides learn the pattern and timing when the device joins the network, then stay in step as they hop.',
				draw: function (s, d, t, c) {
					var i, good = d.att.filter(function (a) { return a.ok; });
					J.T(s, 40, 44, 'The receiver follows the same list', 'j-t--s');
					d.att.slice(0, 5).forEach(function (a, k) {
						var p = J.prog(t, k * 0.12, k * 0.12 + 0.3), x = 60 + k * 175;
						if (p <= 0) { return; }
						J.rect(s, x, 70, 160, 100, 'j-box ' + (a.ok ? 'j-box--card' : 'j-box--badline'), 12);
						J.T(s, x + 80, 102, 'tune to ' + a.ch, 'j-t--s', 'middle');
						J.T(s, x + 80, 150, a.ok ? 'hears ' + c.bits[a.pkt * 2] + ' ' + c.bits[a.pkt * 2 + 1] : 'garbled', 'j-t--b ' + (a.ok ? 'j-t--good' : 'j-t--bad'), 'middle');
					});
					J.T(s, 40, 232, 'Good pieces put together', 'j-t--s');
					var msg = []; good.forEach(function (a) { msg.push(c.bits[a.pkt * 2], c.bits[a.pkt * 2 + 1]); });
					if (d.done) { J.bitBoxes(s, msg, 500, 250, 66, 28, t * (msg.length + 0.6), msg.map(function (b, k) { return b === c.bits[k]; })); J.T(s, 500, 366, 'Your message is back: ' + msg.join(' '), 'j-t--b j-t--good', 'middle'); }
					else { J.T(s, 500, 300, 'The message did not get through yet', 'j-t--b j-t--bad', 'middle'); }
				} },
			J.speedScene('DSSS', 1, 'This radio sent one million bits every second. A one megabyte photo takes about **eight seconds**, and a little longer if some hops are spoiled and need repeating. Its strength was not speed: it was surviving in a crowded band.',
				'Bluetooth uses the same hopping idea in the same band, and its adaptive version skips channels it knows are busy.')
		]
	};
	window.WifiLabModels.journeyfhss = J.player(FHSS_STORY);

	/* =====================================================================
	 * CCK story: 8 bits become one of 256 patterns of 8 chips
	 * ===================================================================== */
	function cckExp(p1, p2, p3, p4) { var n = [p1 + p2 + p3 + p4, p1 + p3 + p4, p1 + p2 + p4, p1 + p4 + 2, p1 + p2 + p3, p1 + p3, p1 + p2 + 2, p1]; return n.map(function (v) { return ((v % 4) + 4) % 4; }); }
	var DQ = { '00': 0, '01': 1, '11': 2, '10': 3 }, DQI = ['00', '01', '11', '10'];            // Table 16-9: 0, 90, 180, 270 degrees
	function cckCompute(ctx) {
		var b = ctx.bits, p1 = DQ['' + b[0] + b[1]], p2 = b[2] * 2 + b[3], p3 = b[4] * 2 + b[5], p4 = b[6] * 2 + b[7];     // Table 16-11 for phases 2 to 4
		var ex = cckExp(p1, p2, p3, p4), cx = ex.map(function (e) { return [Math.cos(e * Math.PI / 2), Math.sin(e * Math.PI / 2)]; });
		var sigma = ctx.p.noise / 100, r = J.rng(ctx.seed), rx = cx.map(function (c) { return [c[0] + sigma * J.gauss(r), c[1] + sigma * J.gauss(r)]; });
		var words = [], best = -1, bs = -1, bi = 0;
		for (var q2 = 0; q2 < 4; q2++) { for (var q3 = 0; q3 < 4; q3++) { for (var q4 = 0; q4 < 4; q4++) {
			var e2 = cckExp(0, q2, q3, q4), sr = 0, si = 0;
			for (var k = 0; k < 8; k++) { var cr = Math.cos(e2[k] * Math.PI / 2), ci = -Math.sin(e2[k] * Math.PI / 2); sr += rx[k][0] * cr - rx[k][1] * ci; si += rx[k][0] * ci + rx[k][1] * cr; }
			var sc = Math.sqrt(sr * sr + si * si); words.push({ q: [q2, q3, q4], sc: sc, ang: Math.atan2(si, sr) }); if (sc > bs) { bs = sc; best = words.length - 1; }
		} } }
		var w = words[best], q1 = ((Math.round(w.ang / (Math.PI / 2)) % 4) + 4) % 4;
		var rec = (DQI[q1] + '').split('').map(Number);
		w.q.forEach(function (q) { rec.push(q >> 1, q & 1); });
		var ph = [p1, p2, p3, p4];
		return { ph: ph, ex: ex, cx: cx, rx: rx, words: words, best: best, bs: bs, q1: q1, rec: rec, sigma: sigma };
	}
	function dial(s, cx, cy, r, ang, cls, scale) {         // a round dial with a pointer; ang in radians (0 = right), scale = pointer length factor
		J.circle(s, cx, cy, r, 'j-dial');
		var sc = scale === undefined ? 1 : scale;
		J.arrow(s, cx, cy, cx + Math.cos(ang) * r * 0.9 * sc, cy - Math.sin(ang) * r * 0.9 * sc, cls || 'j-axis j-axis--b');
	}
	var CCK_STORY = {
		title: 'Follow one byte, eight bits, through the 11 Mbit/s radio',
		bits: [1, 0, 1, 1, 0, 0, 1, 0], reseed: true,
		sliders: [{ key: 'noise', label: 'Noise on the air', min: 0, max: 150, step: 5, val: 45, unit: '%' }],
		compute: cckCompute,
		scenes: [
			{ title: 'Your message', say: 'This time your message is **eight bits**, one whole byte, about one letter of text. This faster radio sends all eight bits together in one go.',
				pro: '11 Mbit/s CCK sends 8 bits per symbol and 1.375 million symbols per second (11 million chips per second divided by 8 chips per symbol).',
				draw: function (s, d, t, c) { J.T(s, 500, 66, 'Your message', 'j-t--b', 'middle'); J.bitBoxes(s, c.bits, 500, 110, 82, 18, t * (c.bits.length + 0.6), null); J.T(s, 500, 262, '8 bits = 1 byte', 'j-t--b j-t--a', 'middle'); J.T(s, 500, 306, 'about one letter of text', 'j-t--s', 'middle'); } },
			{ title: 'Four dials', say: 'We split the eight bits into **four pairs**. Each pair turns a dial to one of four directions: pointing right, up, left or down, like the hand of a clock.',
				pro: 'The first pair is a phase change relative to the previous symbol (DQPSK, Table 16-9). The other three pairs set absolute QPSK phases of 0, 90, 180 or 270 degrees (Table 16-11). Here the first phase is shown as absolute to keep the picture simple.',
				draw: function (s, d, t, c) {
					for (var k = 0; k < 4; k++) {
						var cx = 130 + k * 247, a = J.prog(t, k * 0.15, k * 0.15 + 0.6), pr = c.bits[2 * k] + '' + c.bits[2 * k + 1], deg = d.ph[k] * 90;
						J.rect(s, cx - 82, 40, 164, 60, 'j-box j-box--card', 10); J.T(s, cx, 82, 'bits ' + c.bits[2 * k] + ' ' + c.bits[2 * k + 1], 'j-t--b', 'middle');
						J.arrow(s, cx, 108, cx, 142, 'j-axis j-axis--b');
						dial(s, cx, 232, 78, d.ph[k] * Math.PI / 2 * J.ease(a), 'j-axis j-axis--a');
						J.T(s, cx, 350, 'dial ' + (k + 1) + ': ' + Math.round(deg * J.ease(a)) + '°', 'j-t--s', 'middle');
					}
				} },
			{ title: 'A recipe makes eight chips', say: 'A fixed recipe mixes the four dials into a pattern of **eight chips**, each pointing one of four ways. Every different byte gives a different pattern, like choosing one page from a code book of 256 pages.',
				pro: 'Equation 16-1: c = { e^j(p1+p2+p3+p4), e^j(p1+p3+p4), e^j(p1+p2+p4), -e^j(p1+p4), e^j(p1+p2+p3), e^j(p1+p3), -e^j(p1+p2), e^j p1 }. 4 x 4 x 4 x 4 = 256 patterns.',
				draw: function (s, d, t) {
					d.ph.forEach(function (p, k) { var cx = 66 + k * 70; dial(s, cx, 70, 26, p * Math.PI / 2, 'j-axis j-axis--a'); });
					J.T(s, 40, 134, 'four dials', 'j-t--s'); J.arrow(s, 500, 148, 500, 184, 'j-axis j-axis--b'); J.T(s, 520, 174, 'mixed by the fixed recipe', 'j-t--s');
					for (var k = 0; k < 8; k++) {
						var a = J.prog(t, k * 0.1, k * 0.1 + 0.4), cx = 80 + k * 120;
						if (a > 0) { dial(s, cx, 270, 48, d.ex[k] * Math.PI / 2, 'j-axis j-axis--b', a); J.T(s, cx, 350, 'chip ' + (k + 1), 'j-t--s', 'middle'); }
					}
				} },
			{ title: 'Through the air', say: 'The eight chips fly through the air as one short burst. Noise nudges every arrow a little, so the arrows that arrive point **slightly the wrong way** and have slightly different lengths.',
				pro: 'Each chip is drawn as an arrow in the I/Q plane: its length is the strength and its direction is the phase. The noise here is added to every chip equally in I and Q.',
				draw: function (s, d, t) {
					J.T(s, 40, 36, 'Sent', 'j-t--b j-t--a'); J.T(s, 40, 226, 'Heard', 'j-t--b j-t--brand');
					for (var k = 0; k < 8; k++) {
						var cx = 130 + k * 106, a = J.prog(t, k * 0.08, k * 0.08 + 0.4), rx = d.rx[k];
						dial(s, cx, 120, 40, d.ex[k] * Math.PI / 2, 'j-axis j-axis--b');
						if (a > 0) { J.circle(s, cx, 305, 40, 'j-dial'); J.arrow(s, cx, 305, cx + rx[0] * 36 * a, 305 - rx[1] * 36 * a, 'j-axis j-axis--a'); }
					}
					J.arrow(s, 500, 178, 500, 214, 'j-axis j-axis--b'); J.T(s, 520, 204, 'through the air, noise gets added', 'j-t--s');
				} },
			{ title: 'Search the code book', say: 'The receiver does not read the arrows one by one. It tries every pattern in its **code book** and checks how well each one matches what it heard. The best match wins. Then it measures how far the whole pattern is turned, which gives the last two bits.',
				pro: '64 candidate patterns (phases 2, 3 and 4) are tried; the angle of the winning correlation gives phase 1. 64 x 4 rotations = 256 possible symbols. Brightness below is the match score.',
				dur: 3600,
				draw: function (s, d, t) {
					var max = 0, x0 = 540, y0 = 20, cs = 44, n = d.words.length, shown = Math.floor(n * J.ease(Math.min(1, t * 1.25))), k;
					d.words.forEach(function (w) { if (w.sc > max) { max = w.sc; } });
					for (k = 0; k < n; k++) {
						var cx = x0 + (k % 8) * cs, cy = y0 + Math.floor(k / 8) * cs, on = k < shown, v = d.words[k].sc / max;
						s.append(svg('rect', { x: cx + 2, y: cy + 2, width: cs - 4, height: cs - 4, rx: 5, class: 'j-tile', style: 'opacity:' + (on ? (0.12 + 0.88 * v * v) : 0.07) }));
					}
					if (t > 0.8) { var bx = x0 + (d.best % 8) * cs, by = y0 + Math.floor(d.best / 8) * cs; s.append(svg('rect', { x: bx, y: by, width: cs, height: cs, rx: 6, class: 'j-tile--win' })); J.T(s, 40, 120, 'Best match!', 'j-t--b j-t--good'); J.T(s, 40, 154, 'pattern ' + (d.best + 1) + ' of 64', 'j-t--s'); J.T(s, 40, 214, 'It is turned by', 'j-t--s'); J.T(s, 40, 250, (d.q1 * 90) + '°', 'j-t--b j-t--a'); }
					else { J.T(s, 40, 120, 'Trying all 64 patterns…', 'j-t--b'); }
					J.T(s, 40, 316, 'each square is one pattern', 'j-t--s'); J.T(s, 40, 342, 'from the code book;', 'j-t--s'); J.T(s, 40, 368, 'brighter = better match', 'j-t--s');
				} },
			{ title: 'Read your bits back', say: 'The winning pattern tells us all four dials. Turn each dial back into its two bits and put them in order. Your byte is back.',
				pro: 'The receiver also corrects for the phase reference of the preamble. Real 802.11b adds a scrambler, a preamble and filtering that are not shown here.',
				draw: function (s, d, t, c) {
					var k, ok = true;
					for (k = 0; k < 4; k++) {
						var a = J.prog(t, k * 0.15, k * 0.15 + 0.5), cx = 130 + k * 247;
						if (a <= 0) { continue; }
						dial(s, cx, 110, 58, (k === 0 ? d.q1 : d.words[d.best].q[k - 1]) * Math.PI / 2, 'j-axis j-axis--a');
						J.arrow(s, cx, 180, cx, 208, 'j-axis j-axis--b'); J.T(s, cx, 248, 'bits ' + d.rec[2 * k] + ' ' + d.rec[2 * k + 1], 'j-t--b', 'middle');
					}
					J.bitBoxes(s, d.rec, 500, 276, 56, 14, t * (d.rec.length + 0.6), d.rec.map(function (b, k) { return b === c.bits[k]; }));
					for (k = 0; k < 8; k++) { if (d.rec[k] !== c.bits[k]) { ok = false; } }
					if (t > 0.9) { J.T(s, 500, 372, ok ? 'Sent ' + c.bits.join('') + ' and received ' + d.rec.join('') + ': same message!' : 'Sent ' + c.bits.join('') + ' but received ' + d.rec.join('') + ': noise won. Turn it down.', ok ? 'j-t--good' : 'j-t--bad', 'middle'); }
				} },
			J.speedScene('CCK', 11, 'Because each burst carries a whole byte, this radio does eleven times better than the first one: about **three quarters of a second** for the photo, in perfect conditions. The price is that it is less tough in noise.',
				'Best case, as before. 802.11b also has a 5.5 Mbit/s CCK mode that carries 4 bits per symbol.')
		]
	};
	window.WifiLabModels.journeycck = J.player(CCK_STORY);

	/* =====================================================================
	 * OFDM story: many slow lanes, one wave, a safety margin, an echo, the FFT
	 * 802.11a/g layout: 64-point FFT, subcarriers -26..26 (not 0), pilots at -21 -7 7 21, 48 carry data.
	 * ===================================================================== */
	var PILOTS = [-21, -7, 7, 21], DATA_K = [];
	(function () { for (var k = -26; k <= 26; k++) { if (k !== 0 && PILOTS.indexOf(k) < 0) { DATA_K.push(k); } } })();
	function ofdmCompute(ctx) {
		var b = ctx.bits, rr = J.rng(5), X = {}, mapB = function (v) { return v ? 1 : -1; }, q = 1 / Math.SQRT2, sym = [], i, k, n, pairs = [];
		DATA_K.forEach(function (kk, idx) {
			var b0, b1;
			if (idx < 4) { b0 = b[2 * idx]; b1 = b[2 * idx + 1]; } else { b0 = rr() < 0.5 ? 0 : 1; b1 = rr() < 0.5 ? 0 : 1; }
			X[kk] = [mapB(b0) * q, mapB(b1) * q]; pairs.push([b0, b1]);
		});
		PILOTS.forEach(function (kk) { X[kk] = [1, 0]; });
		var x = [];                          // 64-sample time signal, x[n] = (1/8) sum X[k] e^{j 2 pi k n / 64}
		for (n = 0; n < 64; n++) { var re = 0, im = 0; for (k = -26; k <= 26; k++) { if (!X[k]) { continue; } var a = 2 * Math.PI * k * n / 64, c = Math.cos(a), sn = Math.sin(a); re += X[k][0] * c - X[k][1] * sn; im += X[k][0] * sn + X[k][1] * c; } x.push([re / 8, im / 8]); }
		var tx = x.slice(48).concat(x);        // 16-sample guard (copy of the last 16) in front: 80 samples
		var D = 10, EA = 0.5;                  // echo: 10 samples (0.5 microseconds), half the strength
		var sigma = ctx.p.noise / 100, rn = J.rng(ctx.seed), direct = tx, echo = [], rxs = [];
		for (n = 0; n < 80 + D; n++) {
			var dr = n < 80 ? tx[n][0] : 0, di = n < 80 ? tx[n][1] : 0, er = n - D >= 0 && n - D < 80 ? EA * tx[n - D][0] : 0, ei = n - D >= 0 && n - D < 80 ? EA * tx[n - D][1] : 0;
			echo.push([er, ei]); rxs.push([dr + er + sigma * 0.5 * J.gauss(rn), di + ei + sigma * 0.5 * J.gauss(rn)]);
		}
		var Y = {}, got = [];                  // receiver: drop the guard, FFT, then undo each lane's echo
		for (k = -26; k <= 26; k++) {
			if (k === 0) { continue; }
			var yr = 0, yi = 0;
			for (n = 0; n < 64; n++) { var s2 = rxs[16 + n], ang = -2 * Math.PI * k * n / 64, cc = Math.cos(ang), ss = Math.sin(ang); yr += s2[0] * cc - s2[1] * ss; yi += s2[0] * ss + s2[1] * cc; }
			yr /= 8; yi /= 8;
			var hr = 1 + EA * Math.cos(-2 * Math.PI * k * D / 64), hi = EA * Math.sin(-2 * Math.PI * k * D / 64), den = hr * hr + hi * hi;
			Y[k] = [(yr * hr + yi * hi) / den, (yi * hr - yr * hi) / den];
		}
		var rec = [];
		DATA_K.forEach(function (kk, idx) { got.push(Y[kk]); if (idx < 4) { rec.push(Y[kk][0] > 0 ? 1 : 0, Y[kk][1] > 0 ? 1 : 0); } });
		var OS = 5, rn2 = J.rng(ctx.seed + 17), cTx = [], cEcho = [], cRx = [];
		function xAt(nn) { var re = 0, im = 0, kk; for (kk = -26; kk <= 26; kk++) { if (!X[kk]) { continue; } var an = 2 * Math.PI * kk * nn / 64; re += X[kk][0] * Math.cos(an) - X[kk][1] * Math.sin(an); im += X[kk][0] * Math.sin(an) + X[kk][1] * Math.cos(an); } return [re / 8, im / 8]; }
		for (var q = 0; q <= (80 + D) * OS; q++) {
			var nn = -16 + q / OS, dr2 = nn < 64 ? xAt(nn)[0] : 0, er2 = (nn - D >= -16 && nn - D < 64) ? EA * xAt(nn - D)[0] : 0;
			cTx.push(dr2); cEcho.push(er2); cRx.push(dr2 + er2 + sigma * 0.5 * 0.8 * J.gauss(rn2));
		}
		return { X: X, x: x, tx: tx, echo: echo, rxs: rxs, got: got, rec: rec, sigma: sigma, D: D, OS: OS, cTx: cTx, cEcho: cEcho, cRx: cRx };
	}
	var OFDM_STORY = {
		title: 'Follow eight bits through a Wi-Fi 4 / Wi-Fi 5 style OFDM radio',
		bits: [1, 0, 1, 1, 0, 0, 1, 0], reseed: true,
		sliders: [{ key: 'noise', label: 'Noise on the air', min: 0, max: 80, step: 5, val: 15, unit: '%' }],
		compute: ofdmCompute,
		scenes: [
			{ title: 'Your message', say: 'Your message is eight bits again. A real OFDM burst carries hundreds of bits at once, so think of these eight as just the first few passengers on a very big bus.',
				pro: 'We follow one OFDM symbol of the 802.11a/g format, using QPSK. The other bits of the symbol are filled with other data so that the wave is realistic.',
				draw: function (s, d, t, c) { J.T(s, 500, 66, 'Your message', 'j-t--b', 'middle'); J.bitBoxes(s, c.bits, 500, 110, 82, 18, t * (c.bits.length + 0.6), null); J.T(s, 500, 270, 'the first 8 of about 96 bits in this burst', 'j-t--s', 'middle'); } },
			{ title: 'Many slow lanes', say: 'Instead of one fast sports car, OFDM uses **many slow lorries side by side**. The data is shared out over 48 lanes. Each lane, called a subcarrier, carries just two bits.',
				pro: 'In 802.11a/g, 52 subcarriers 312.5 kHz apart fill a 20 MHz channel: 48 carry data and 4 are pilots (IEEE Std 802.11-2020, Tables 17-4 and 17-5). 48 lanes x 2 bits is 96 bits per 4 microsecond symbol.',
				draw: function (s, d, t, c) {
					var x0 = 40, lw = 18.4, i, mine = 4;
					J.T(s, 40, 40, 'The channel is cut into 52 lanes (subcarriers)', 'j-t--s');
					for (i = 0; i < 52; i++) {
						var k = i < 26 ? i - 26 : i - 25, isP = PILOTS.indexOf(k) >= 0, di = DATA_K.indexOf(k), a = J.prog(t, i / 52 * 0.7, i / 52 * 0.7 + 0.3), x = x0 + i * lw;
						J.rect(s, x + 1, 150 - 90 * a, lw - 2, 90 * a, 'j-box ' + (isP ? 'j-box--pilot' : (di >= 0 && di < mine ? 'j-box--1' : 'j-box--0')), 3);
					}
					J.T(s, 960, 176, 'orange = pilot lanes (a known reference)', 'j-t--s', 'end');
					for (i = 0; i < mine; i++) {
						var a2 = J.prog(t, 0.6 + i * 0.08, 0.85 + i * 0.08), cx = 60 + i * 150;
						if (a2 > 0) { J.rect(s, cx, 222, 128, 74, 'j-box j-box--card', 10); J.T(s, cx + 64, 250, 'lane ' + (i + 1), 'j-t--s', 'middle'); J.T(s, cx + 64, 284, 'bits ' + c.bits[2 * i] + ' ' + c.bits[2 * i + 1], 'j-t--b j-t--a', 'middle'); J.line(s, cx + 64, 218, x0 + i * lw + lw / 2, 158, 'j-axis'); }
					}
					J.T(s, 700, 250, '← your 8 bits ride on', 'j-t--a'); J.T(s, 700, 280, 'the first four lanes', 'j-t--a');
					J.T(s, 960, 360, '48 data lanes + 4 pilot lanes', 'j-t--s', 'end');
				} },
			{ title: 'Each lane is a note', say: 'Every lane becomes its own **musical note**, with a different pitch. How loud the note is, and when it starts, carries the two bits. Add all the notes together and you get one wave that looks like random noise, but hides all the data.',
				pro: 'The sum is an inverse FFT with 64 points, 52 of them used. The four small waves are the first four lanes; the big wave is all 52 added together.',
				draw: function (s, d, t) {
					var x0 = 40, x1 = 960, n, i, f = J.ease(t);
					for (i = 0; i < 4; i++) {
						var kk = DATA_K[i], vals = [];
						for (n = 0; n < 320; n++) { var an = 2 * Math.PI * kk * (n / 5) / 64; vals.push((d.X[kk][0] * Math.cos(an) - d.X[kk][1] * Math.sin(an)) * 22); }
						J.line(s, 110, 56 + i * 36, x1, 56 + i * 36, 'j-grid'); J.path(s, J.linepath(vals, 110, x1, 56 + i * 36, 1, 1), 'j-line--b');
						J.T(s, x0, 62 + i * 36, 'lane ' + (i + 1), 'j-t--s');
					}
					J.arrow(s, 500, 206, 500, 236, 'j-axis j-axis--b'); J.T(s, 520, 228, 'add up all 52 lanes', 'j-t--s');
					var big = d.cTx.slice(16 * d.OS, 80 * d.OS + 1).map(function (v) { return v * 50; });
					J.line(s, x0, 326, x1, 326, 'j-grid'); J.path(s, J.linepath(big, x0, x1, 326, 1, f, 46), 'j-line--a');
					J.T(s, x0, 270, 'one wave, one burst', 'j-t--brand');
				} },
			{ title: 'A safety margin', say: 'Walls make echoes, and echoes smear signals. So before sending, we copy the **end** of the wave and stick it on the **front**. That extra bit is a guard time, a safety margin.',
				pro: 'This is the cyclic prefix: 0.8 microseconds (16 samples) copied from the end of each 3.2 microsecond symbol, 4 microseconds in all (T_GI and T_FFT, IEEE Std 802.11-2020, Tables 17-4 and 17-5).',
				draw: function (s, d, t) {
					var x0 = 40, x1 = 960, w = (x1 - x0) / 80, f = J.ease(t), vals = d.cTx.slice(0, 80 * d.OS + 1).map(function (v) { return v * 50; });
					J.rect(s, x0, 90, 16 * w, 190, 'j-zone j-zone--guard', 4); J.rect(s, x0 + 16 * w, 90, 64 * w, 190, 'j-zone j-zone--sym', 4);
					J.T(s, x0 + 8 * w, 78, 'safety margin', 'j-t--a', 'middle'); J.T(s, x0 + 48 * w, 78, 'the burst itself: 3.2 microseconds', 'j-t--brand', 'middle');
					J.line(s, x0, 185, x1, 185, 'j-axis'); J.path(s, J.linepath(vals, x0, x1, 185, 1, 1, 80), 'j-line--a');
					var lx0 = x0 + 64 * w, lx1 = x0 + 80 * w;
					J.rect(s, lx0, 296, lx1 - lx0, 16, 'j-box j-box--1', 3); J.rect(s, x0, 296, 16 * w, 16, 'j-box j-box--1', 3);
					J.arrow(s, lx0 + (lx1 - lx0) / 2, 326, x0 + 8 * w + (1 - f) * (lx0 - x0), 326, 'j-axis j-axis--b');
					J.T(s, 500, 366, 'the last 0.8 microseconds are copied to the front', 'j-t--b j-t--a', 'middle');
				} },
			{ title: 'Through the air, with an echo', say: 'On the way, the wave bounces off walls, so a weaker copy arrives a bit **late**. Noise gets added too. But the late echo only lands inside the safety margin, which the receiver simply throws away, so it does no harm.',
				pro: 'The echo here is 0.5 microseconds late and half as strong. It is shorter than the 0.8 microsecond guard interval, so it cannot spill into the useful part of the symbol. An echo later than the guard would.',
				draw: function (s, d, t) {
					var x0 = 40, x1 = 960, N = d.cTx.length, w = (x1 - x0) / (80 + d.D), f = J.ease(t), px = function (a) { return a.map(function (v) { return v * 50; }); };
					J.rect(s, x0, 36, 16 * w, 330, 'j-zone j-zone--guard', 4); J.T(s, x0 + 8 * w, 26, 'safety margin', 'j-t--s', 'middle');
					J.T(s, x0 + 18 * w, 50, 'Straight to the receiver', 'j-t--a'); J.line(s, x0, 108, x1, 108, 'j-grid'); J.path(s, J.linepath(px(d.cTx), x0, x1, 108, 1, f, 34), 'j-line--b');
					J.T(s, x0 + 18 * w, 162, 'The echo: later and weaker', 'j-t--s'); J.line(s, x0, 220, x1, 220, 'j-grid'); J.path(s, J.linepath(px(d.cEcho), x0, x1, 220, 1, f, 34), 'j-line--m');
					J.T(s, x0 + 18 * w, 274, 'What the receiver hears: all of it, plus noise', 'j-t--brand'); J.line(s, x0, 334, x1, 334, 'j-grid'); J.path(s, J.linepath(px(d.cRx), x0, x1, 334, 1, f, 38), 'j-line--a');
				} },
			{ title: 'Split the lanes again', say: 'The receiver drops the safety margin and uses a maths trick called the **FFT** to split the mixed wave back into its separate lanes. Each lane shows up as a dot near one of four spots, and the spot tells the two bits. The orange dots are your message.',
				pro: 'Before deciding, the receiver corrects every lane for the echo, using the known training symbols sent at the start of each frame. Spots: QPSK with bit 0 = minus and bit 1 = plus on each axis (Table 17-13).',
				draw: function (s, d, t, c) {
					var cx = 250, cy = 195, R = 130, i, ok = true;
					J.line(s, cx - R - 30, cy, cx + R + 30, cy, 'j-axis'); J.line(s, cx, cy - R - 30, cx, cy + R + 30, 'j-axis');
					[[1, 1, '1 1'], [-1, 1, '0 1'], [-1, -1, '0 0'], [1, -1, '1 0']].forEach(function (p) { J.circle(s, cx + p[0] * R * 0.7, cy - p[1] * R * 0.7, 20, 'j-spot'); J.T(s, cx + p[0] * R * 0.7 + (p[0] > 0 ? 28 : -28), cy - p[1] * R * 0.7 + 6, p[2], 'j-t--s', p[0] > 0 ? 'start' : 'end'); });
					d.got.forEach(function (v, k) {
						var a = J.prog(t, k / 60, k / 60 + 0.3), mine = k < 4;
						if (a <= 0) { return; }
						J.circle(s, cx + v[0] / 0.7071 * R * 0.7, cy - v[1] / 0.7071 * R * 0.7, mine ? 8 : 4.5, mine ? 'j-dot j-dot--mine' : 'j-dot');
					});
					J.T(s, 520, 80, 'Lane by lane, what the receiver reads:', 'j-t--s');
					for (i = 0; i < 4; i++) { var a2 = J.prog(t, 0.5 + i * 0.1, 0.7 + i * 0.1); if (a2 > 0) { J.T(s, 520, 126 + i * 40, 'lane ' + (i + 1) + ' → bits ' + d.rec[2 * i] + ' ' + d.rec[2 * i + 1], 'j-t--b ' + (d.rec[2 * i] === c.bits[2 * i] && d.rec[2 * i + 1] === c.bits[2 * i + 1] ? 'j-t--good' : 'j-t--bad')); } }
					for (i = 0; i < 8; i++) { if (d.rec[i] !== c.bits[i]) { ok = false; } }
					if (t > 0.9) { J.T(s, 520, 330, ok ? 'Sent ' + c.bits.join('') + ' and received ' + d.rec.join('') + ': same!' : 'Sent ' + c.bits.join('') + ' but got ' + d.rec.join('') + '. Turn the noise down.', ok ? 'j-t--b j-t--good' : 'j-t--b j-t--bad'); }
				} },
			J.speedScene('OFDM', 54, 'Because so many lanes work at once, and echoes do no harm, this design reached **54 megabits** a second in 802.11a and g. Our example, QPSK, gives 12. The next topics show how to squeeze more bits into each dot.',
				'54 Mbit/s uses 64-QAM with rate 3/4 coding. QPSK with rate 1/2 coding gives 12 Mbit/s. Every Wi-Fi generation since 802.11a still uses OFDM.')
		]
	};
	window.WifiLabModels.journeyofdm = J.player(OFDM_STORY);
})();
