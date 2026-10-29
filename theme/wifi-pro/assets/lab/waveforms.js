/* Wi-Fi Pro Lab: how the signal is built (waveform models).
 * DSSS (Barker spreading, DBPSK), FHSS (frequency hopping), CCK (complementary code keying) and OFDM.
 * Checked against IEEE Std 802.11-2020: clause 16 (HR/DSSS: Barker sequence 16.3.6.5, CCK equation 16-1 and
 * Tables 16-7 to 16-11 in 16.3.6.6) and clause 17 (OFDM: Tables 17-4, 17-5, 17-11 to 17-15, pilots 17.3.5.9).
 * FHSS is not in the 2020 standard (it was part of the 1997 original), so that model describes the historic radio.
 * These are teaching simulations that show the mechanism, not bit-exact transmitters (no scrambler seed,
 * preamble, filtering or bit ordering on the air).
 * Helpers come from lab.js (window.WifiLab); models register themselves in window.WifiLabModels.
 */
(function () {
	'use strict';
	var L = window.WifiLab;
	if (!L) { return; }
	var el = L.el, svg = L.svg, seg = L.seg, readout = L.readout, fmt = L.fmt, RM = L.RM;
	window.WifiLabModels = window.WifiLabModels || {};

	/* ---------- helpers ---------- */
	function rng(seed) {   // mulberry32: small seeded random generator so demos are repeatable
		var a = seed >>> 0;
		return function () { a += 0x6D2B79F5; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
	}
	function gauss(r) { var u = 0, v = 0; while (u === 0) { u = r(); } while (v === 0) { v = r(); } return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
	function bitToggles(label, bits, onChange, names) {
		var wrap = el('div', { class: 'lab-bits', role: 'group', 'aria-label': label });
		bits.forEach(function (b, i) {
			var btn = el('button', { type: 'button', class: 'lab-bit', 'aria-pressed': String(b === 1), 'aria-label': (names ? names[i] : 'bit ' + i) + ' = ' + b, text: String(b) });
			btn.addEventListener('click', function () {
				bits[i] = bits[i] ? 0 : 1; btn.textContent = String(bits[i]); btn.setAttribute('aria-pressed', String(bits[i] === 1)); btn.setAttribute('aria-label', (names ? names[i] : 'bit ' + i) + ' = ' + bits[i]); onChange();
			});
			wrap.append(el('span', { class: 'lab-bit__w' }, [btn, el('span', { class: 'lab-bit__n', text: names ? names[i] : String(i) })]));
		});
		return wrap;
	}
	function slider(label, min, max, step, val, unit, onInput) {
		var out = el('output', { text: val + unit });
		var inp = el('input', { type: 'range', min: min, max: max, step: step, value: val, 'aria-label': label });
		inp.addEventListener('input', function () { out.textContent = inp.value + unit; onInput(Number(inp.value)); });
		return el('label', { class: 'lab-ctl lab-ctl--range' }, [el('span', { class: 'lab-ctl__t' }, [document.createTextNode(label + ': '), out]), inp]);
	}
	function text(parent, x, y, str, cls, anchor) { var t = svg('text', { x: x, y: y, class: cls || 'lab-tick', 'text-anchor': anchor || 'start' }); t.textContent = str; parent.append(t); return t; }
	function stepPath(vals, x0, x1, yMid, amp, per) {      // rectangular (held) waveform
		var w = (x1 - x0) / vals.length, d = '';
		vals.forEach(function (v, i) { var y = yMid - v * amp; d += (i ? 'L' : 'M') + (x0 + i * w).toFixed(1) + ' ' + y.toFixed(1) + 'L' + (x0 + (i + 1) * w).toFixed(1) + ' ' + y.toFixed(1); });
		return d;
	}
	function linePath(vals, x0, x1, yMid, amp, lo, hi) {
		var d = '';
		vals.forEach(function (v, i) { var x = x0 + (i / (vals.length - 1)) * (x1 - x0), y = yMid - Math.max(lo, Math.min(hi, v)) * amp; d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); });
		return d;
	}

	/* =====================================================================
	 * DSSS: Barker-11 spreading, and what a correlator buys you
	 * ===================================================================== */
	var BARKER = [1, -1, 1, 1, -1, 1, 1, 1, -1, -1, -1];

	window.WifiLabModels.dsss = function (root) {
		var bits = [1, 0, 1, 1, 0, 0], st = { noise: 120, jam: false, seed: 7 };
		var N = bits.length, C = 11;
		var controls = el('div', { class: 'lab-controls' });
		var bitsBox = el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Your data bits (click to flip)' }), bitToggles('Data bits', bits, draw, bits.map(function (_, i) { return 'bit ' + (i + 1); }))]);
		controls.append(bitsBox,
			slider('Noise (per chip, as % of signal)', 0, 400, 10, st.noise, '%', function (v) { st.noise = v; draw(); }));
		var jam = el('label', { class: 'lab-tog' }, [el('input', { type: 'checkbox' }), document.createTextNode(' Add a strong narrowband jammer')]);
		jam.firstChild.addEventListener('change', function (e) { st.jam = e.target.checked; draw(); });
		var again = el('button', { type: 'button', class: 'lab-btn lab-btn--ghost', text: 'New noise' });
		again.addEventListener('click', function () { st.seed = Math.floor(Math.random() * 1e6); draw(); });
		controls.append(el('div', { class: 'lab-ctl' }, [jam, again]));
		var stage = el('div', { class: 'lab-stage' });
		var roGain = readout('10.4 dB', 'processing gain, 10 log10(11)', 'good'), roOk = readout('', 'bits recovered correctly'), roBw = readout('22 MHz', 'channel width used (1 Mbit/s data)');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roGain, roOk, roBw]), note);

		function draw() {
			var r = rng(st.seed), sig = [], pol = 1;
			bits.forEach(function (b) { pol = b ? -pol : pol; sig.push(pol); });      // DBPSK: a 1 flips the phase, a 0 keeps it (Table 16-7)
			var chips = [], rx = [], sigma = st.noise / 100;
			sig.forEach(function (b) { BARKER.forEach(function (c) { chips.push(b * c); }); });
			chips.forEach(function (c, i) {
				var jammer = st.jam ? 3.0 * Math.sin(2 * Math.PI * i / 3.3) : 0;
				rx.push(c + sigma * gauss(r) + jammer);
			});
			var corr = sig.map(function (_, i) { var sum = 0; for (var k = 0; k < C; k++) { sum += rx[i * C + k] * BARKER[k]; } return sum; });
			var rec = corr.map(function (v, i) { var prev = i ? corr[i - 1] : 1; return v * prev < 0 ? 1 : 0; });      // a sign change between symbols means a 1
			var good = rec.filter(function (b, i) { return b === bits[i]; }).length;

			var W = 1000, H = 660, x0 = 70, x1 = 985;
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'DSSS: data bits, spread chips, received signal with noise, and the correlator output' });
			function bound(i) { return x0 + i * (x1 - x0) / N; }
			var Y1 = 62, Y2 = 182, Y3 = 316, YC = 520, CH = 80;
			text(s, 6, 16, 'Phase of each symbol after DBPSK: a data bit of 1 flips it, 0 keeps it', 'lab-tick lab-tick--f');
			text(s, 6, 132, 'Chips sent: 11 chips per bit (the symbol phase times the Barker code)', 'lab-tick lab-tick--f');
			text(s, 6, 256, 'Received: the chips plus noise' + (st.jam ? ' plus a strong narrowband jammer' : ''), 'lab-tick lab-tick--f');
			[Y1, Y2, Y3].forEach(function (y) { s.append(svg('line', { x1: x0, y1: y, x2: x1, y2: y, class: 'lab-axis' })); });
			for (var i = 0; i <= N; i++) { s.append(svg('line', { x1: bound(i), y1: 24, x2: bound(i), y2: 380, class: 'lab-grid' })); }
			s.append(svg('path', { d: stepPath(sig, x0, x1, Y1, 30), class: 'lab-wave is-on' }));
			sig.forEach(function (b, i) { text(s, (bound(i) + bound(i + 1)) / 2, 112, 'bit ' + bits[i], 'lab-tick lab-tick--f', 'middle'); });
			s.append(svg('path', { d: stepPath(chips, x0, x1, Y2, 30), class: 'lab-wave is-on', style: 'stroke: var(--wp--preset--color--accent)' }));
			text(s, bound(0) + 4, 232, 'Barker code: ' + BARKER.map(function (c) { return c > 0 ? '+' : '-'; }).join(' '), 'lab-tick');
			s.append(svg('path', { d: linePath(rx, x0, x1, Y3, 9, -6, 6), class: 'lab-wave', style: 'opacity:.9' }));
			text(s, 6, 404, 'Correlator: multiply what was received by the Barker code and add up the 11 chips of each bit', 'lab-tick lab-tick--f');
			s.append(svg('line', { x1: x0, y1: YC, x2: x1, y2: YC, class: 'lab-axis' }));
			[11, -11].forEach(function (lv) { s.append(svg('line', { x1: x0, y1: YC - lv / 14 * CH, x2: x1, y2: YC - lv / 14 * CH, class: 'lab-grid' })); text(s, x0 - 6, YC - lv / 14 * CH + 4, (lv > 0 ? '+' : '') + lv, 'lab-tick', 'end'); });
			text(s, x0 - 6, YC + 4, '0', 'lab-tick', 'end');
			corr.forEach(function (v, i) {
				var h = Math.max(-CH * 1.3, Math.min(CH * 1.3, v / 14 * CH)), ok = rec[i] === bits[i], bw = (x1 - x0) / N * 0.5, bx = (bound(i) + bound(i + 1)) / 2 - bw / 2;
				s.append(svg('rect', { x: bx, y: h >= 0 ? YC - h : YC, width: bw, height: Math.abs(h), rx: 3, class: 'lab-bar is-' + (ok ? 'good' : 'bad') }));
				text(s, bx + bw / 2, h >= 0 ? YC - h - 6 : YC - h + 16, fmt(v, 0) + ' so bit ' + rec[i], 'lab-tick lab-tick--f', 'middle');
			});
			stage.replaceChildren(s);
			roOk.set(good + ' of ' + N, good === N ? 'good' : (good >= N - 1 ? 'warn' : 'bad'));
			note.textContent = 'At 1 Mbit/s the data is first encoded differentially (DBPSK): a 1 flips the phase of the next symbol and a 0 leaves it unchanged. Each symbol is then multiplied by the 11-chip Barker code, so one 1-microsecond symbol becomes 11 chips of about 91 nanoseconds each. The signal now needs about 22 MHz instead of 2 MHz and its power is spread thin. The receiver multiplies by the same code and adds up: the wanted signal adds coherently to +11 or -11, while noise and the jammer, which do not match the code, add up randomly. That is the processing gain, 10 log10(11) = 10.4 dB. A 1 is detected when the sign changes from one symbol to the next. Reference: IEEE Std 802.11-2020, 16.3.6.5 (Barker sequence) and Table 16-7 (DBPSK). 2 Mbit/s uses the same code with DQPSK (Table 16-8). Raise the noise until some bars turn red, then add the jammer to see a strong narrowband signal being rejected.';
		}
		draw();
	};

	/* =====================================================================
	 * Barker-11 correlation: why the code is chosen as it is
	 * ===================================================================== */
	window.WifiLabModels.barker = function (root) {
		var st = { k: 0 }, n = BARKER.length;
		function ac(k) { var a = Math.abs(k), s = 0; for (var i = 0; i < n - a; i++) { s += BARKER[i] * BARKER[i + a]; } return s; }
		var controls = el('div', { class: 'lab-controls' }, [slider('Shift the copy of the code by', -10, 10, 1, 0, ' chips', function (v) { st.k = v; draw(); })]);
		var stage = el('div', { class: 'lab-stage' });
		var roSum = readout('', 'sum of the products (the correlation)'), roPeak = readout('11', 'at perfect alignment', 'good'), roSide = readout('1', 'largest value at any other shift', 'good');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roSum, roPeak, roSide]), note);
		function draw() {
			var W = 1000, H = 330, x0 = 80, cw = 56, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'The Barker code, a shifted copy, their products, and the correlation at every shift' });
			var k = st.k, rows = [['The code', function (i) { return BARKER[i]; }], ['A copy shifted by ' + k, function (i) { var j = i - k; return (j >= 0 && j < n) ? BARKER[j] : 0; }]];
			rows.forEach(function (r, ri) {
				var y = 30 + ri * 44;
				text(s, 6, y + 20, r[0], 'lab-tick lab-tick--f');
				for (var i = 0; i < n; i++) { var v = r[1](i); s.append(svg('rect', { x: x0 + 180 + i * (cw - 12), y: y, width: cw - 16, height: 30, rx: 5, class: 'lab-bar is-' + (v > 0 ? 'good' : (v < 0 ? 'bad' : 'warn')), style: v === 0 ? 'opacity:.12' : 'opacity:.85' })); text(s, x0 + 180 + i * (cw - 12) + (cw - 16) / 2, y + 21, v > 0 ? '+' : (v < 0 ? '-' : ''), 'lab-tick lab-tick--f', 'middle'); }
			});
			text(s, 6, 142, 'Products', 'lab-tick lab-tick--f');
			var sum = 0;
			for (var i = 0; i < n; i++) { var p = rows[0][1](i) * rows[1][1](i); sum += p; text(s, x0 + 180 + i * (cw - 12) + (cw - 16) / 2, 144, p > 0 ? '+1' : (p < 0 ? '-1' : '0'), 'lab-tick lab-tick--f', 'middle'); }
			// correlation at every shift
			var cx0 = 120, cx1 = 940, cy = 250, ch = 64;
			s.append(svg('line', { x1: cx0, y1: cy, x2: cx1, y2: cy, class: 'lab-axis' }));
			for (var kk = -10; kk <= 10; kk++) {
				var v = ac(kk), x = cx0 + (kk + 10) / 20 * (cx1 - cx0), h = v / 11 * ch;
				s.append(svg('rect', { x: x - 14, y: v >= 0 ? cy - h : cy, width: 28, height: Math.max(2, Math.abs(h)), rx: 3, class: 'lab-bar is-' + (kk === k ? 'good' : 'warn'), style: kk === k ? '' : 'opacity:.45' }));
				text(s, x, cy + 46, String(kk), kk === k ? 'lab-tick lab-tick--f' : 'lab-tick', 'middle');
				text(s, x, v >= 0 ? cy - h - 6 : cy - h + 16, String(v), kk === k ? 'lab-tick lab-tick--f' : 'lab-tick', 'middle');
			}
			text(s, 6, 178, 'Correlation of the code with a shifted copy of itself, at every shift (shift in chips along the bottom)', 'lab-tick lab-tick--f');
			stage.replaceChildren(s);
			roSum.set(String(sum), k === 0 ? 'good' : 'warn');
			note.textContent = 'Multiply the code chip by chip with a shifted copy of itself and add up. With no shift every product is +1 and the sum is 11. At any other shift the sum is only 0 or -1. That sharp peak is why a receiver can lock on to the Barker code even when the signal is buried in noise, and why an echo arriving a few chips late (a shifted copy) adds almost nothing to the answer at the right moment.';
		}
		draw();
	};

	/* =====================================================================
	 * FHSS: hopping across 79 x 1 MHz channels
	 * ===================================================================== */
	window.WifiLabModels.fhss = function (root) {
		var st = { jamCh: 6, adaptive: false, jam: true, slots: 40, cur: 0 };
		var controls = el('div', { class: 'lab-controls' });
		var jamBox = el('label', { class: 'lab-tog' }, [el('input', { type: 'checkbox', checked: 'checked' }), document.createTextNode(' A 22 MHz-wide network is on the air')]);
		jamBox.firstChild.addEventListener('change', function (e) { st.jam = e.target.checked; draw(); });
		var adBox = el('label', { class: 'lab-tog' }, [el('input', { type: 'checkbox' }), document.createTextNode(' Adaptive hopping (skip the busy channels, as Bluetooth does)')]);
		adBox.firstChild.addEventListener('change', function (e) { st.adaptive = e.target.checked; draw(); });
		controls.append(slider('Wi-Fi channel of the other network', 1, 13, 1, st.jamCh, '', function (v) { st.jamCh = v; draw(); }), el('div', { class: 'lab-ctl' }, [jamBox, adBox]));
		var stage = el('div', { class: 'lab-stage' });
		var roHit = readout('', 'of the hops land on the other network', 'warn'), roCh = readout('79', 'hop channels (1 MHz each)'), roTheory = readout('', 'expected: busy channels / 79');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roHit, roCh, roTheory]), note);

		var perm = (function () { var r = rng(11), a = []; for (var i = 0; i < 79; i++) { a.push(i); } for (var j = 78; j > 0; j--) { var k = Math.floor(r() * (j + 1)), t = a[j]; a[j] = a[k]; a[k] = t; } return a; })();
		var W = 1000, H = 330, x0 = 54, x1 = 990, y0 = 14, y1 = 290;
		function draw() {
			var jamLo = 2407 + 5 * st.jamCh - 11, jamHi = 2407 + 5 * st.jamCh + 11;      // MHz
			function busy(ch) { var f = 2402 + ch + 0.5; return st.jam && f >= jamLo && f <= jamHi; }
			var seq = [], i = 0;
			perm.forEach(function (ch) { if (!(st.adaptive && busy(ch))) { seq.push(ch); } });
			var slots = []; for (i = 0; i < st.slots; i++) { slots.push(seq[i % seq.length]); }
			var hits = slots.filter(busy).length;
			function fy(ch) { return y1 - (ch + 0.5) / 79 * (y1 - y0); }
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Frequency hopping across 79 channels, with a 22 MHz-wide network shown as a shaded band' });
			if (st.jam) { s.append(svg('rect', { x: x0, y: fy(Math.min(78, jamHi - 2402)), width: x1 - x0, height: Math.max(2, fy(Math.max(0, jamLo - 2402)) - fy(Math.min(78, jamHi - 2402))), class: 'lab-ov-zone', style: 'opacity:.25' })); }
			[0, 20, 40, 60, 78].forEach(function (ch) { text(s, x0 - 8, fy(ch) + 4, String(2402 + ch), 'lab-tick', 'end'); s.append(svg('line', { x1: x0, y1: fy(ch), x2: x1, y2: fy(ch), class: 'lab-grid' })); });
			text(s, 6, 12, 'MHz', 'lab-tick');
			text(s, x1, H - 6, 'time: one dwell (one packet) per column  →', 'lab-tick', 'end');
			var cw = (x1 - x0) / st.slots, prev = null;
			slots.forEach(function (ch, k) {
				var cx = x0 + k * cw + cw / 2, cy = fy(ch), bad = busy(ch);
				if (prev) { s.append(svg('line', { x1: prev[0], y1: prev[1], x2: cx, y2: cy, class: 'lab-axis', style: 'opacity:.5' })); }
				s.append(svg('circle', { cx: cx, cy: cy, r: Math.max(3, cw * 0.28), class: 'lab-bar is-' + (bad ? 'bad' : 'good'), 'data-k': k }));
				prev = [cx, cy];
			});
			stage.replaceChildren(s);
			var nb = 0; for (i = 0; i < 79; i++) { if (busy(i)) { nb++; } }
			roHit.set(fmt(hits / st.slots * 100, 0) + '%', hits / st.slots > 0.15 ? 'bad' : 'good');
			roTheory.set(nb + ' / 79 = ' + fmt(nb / 79 * 100, 0) + '%');
			note.textContent = 'Frequency-hopping spread spectrum (FHSS) keeps a narrow signal, but moves it: transmit one packet on one 1 MHz channel (the dwell), then hop to another according to a pseudo-random pattern that the transmitter and receiver both know. A wideband interferer only spoils the hops that land inside it, about 22 of 79 here, and the lost packets are simply retried on the next hop. The original 802.11 FHSS radio sent 1 Mbit/s (2-level GFSK) or 2 Mbit/s (4-level GFSK) this way. FHSS belongs to the 1997 standard: it no longer appears at all in the current IEEE Std 802.11-2020, so this is the historic radio. Bluetooth uses the same idea in the same band, and its adaptive version avoids channels it knows are busy, which is why the two coexist better than their rules alone would suggest.';
		}
		draw();
	};

	/* =====================================================================
	 * CCK: complementary code keying (802.11b, 5.5 and 11 Mbit/s)
	 *   c = { e^j(p1+p2+p3+p4), e^j(p1+p3+p4), e^j(p1+p2+p4), -e^j(p1+p4), e^j(p1+p2+p3), e^j(p1+p3), -e^j(p1+p2), e^j p1 }
	 * phases are multiples of 90 degrees, so every chip is one of 1, j, -1, -j.
	 * ===================================================================== */
	var CHIP_NAME = ['1', 'j', '-1', '-j'];
	function cckChips(p1, p2, p3, p4) {
		var n = [p1 + p2 + p3 + p4, p1 + p3 + p4, p1 + p2 + p4, p1 + p4 + 2, p1 + p2 + p3, p1 + p3, p1 + p2 + 2, p1];
		return n.map(function (v) { return ((v % 4) + 4) % 4; });          // exponent in units of 90 degrees
	}
	var IQ = [[1, 0], [0, 1], [-1, 0], [0, -1]];

	window.WifiLabModels.cck = function (root) {
		var st = { rate: 11 }, bits = [1, 0, 1, 1, 0, 0, 1, 0];
		var names11 = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
		var controls = el('div', { class: 'lab-controls' });
		var bitHost = el('div', { class: 'lab-ctl' });
		var rateSeg = seg('CCK rate', [[11, '11 Mbit/s: 8 bits per symbol'], [5.5, '5.5 Mbit/s: 4 bits per symbol']], st.rate, function (v) { st.rate = Number(v); build(); draw(); });
		controls.append(el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Rate' }), rateSeg]), bitHost);
		var stage = el('div', { class: 'lab-stage' });
		var corrStage = el('div', { class: 'lab-stage' });
		var roSym = readout('', 'chips in this symbol'), roWords = readout('', 'possible code words'), roRate = readout('', 'bit rate');
		var tbl = el('div', { class: 'lab-tablewrap' });
		var note = el('p', { class: 'lab-note' });
		root.append(controls, el('div', { class: 'lab-reads' }, [roSym, roWords, roRate]), tbl, stage, corrStage, note);

		function build() {
			var n = st.rate === 11 ? 8 : 4, arr = bits.slice(0, n);
			bitHost.replaceChildren(el('span', { class: 'lab-ctl__t', text: 'Bits in this symbol (click to flip)' }), bitToggles('CCK bits', arr, function () { for (var i = 0; i < n; i++) { bits[i] = arr[i]; } draw(); }, names11.slice(0, n)));
		}
		function phases() {
			var d = bits, p1 = (d[0] === 0 && d[1] === 0) ? 0 : (d[0] === 0 && d[1] === 1) ? 1 : (d[0] === 1 && d[1] === 1) ? 2 : 3;   // DQPSK (Gray), relative to the previous symbol
			var p2, p3, p4;
			if (st.rate === 11) { p2 = d[2] * 2 + d[3]; p3 = d[4] * 2 + d[5]; p4 = d[6] * 2 + d[7]; }
			else { p2 = d[2] * 2 + 1; p3 = 0; p4 = d[3] * 2; }
			return [p1, p2, p3, p4];
		}
		function draw() {
			var ph = phases(), chips = cckChips(ph[0], ph[1], ph[2], ph[3]);
			var n = st.rate === 11 ? 8 : 4;
			roSym.set('8'); roWords.set(st.rate === 11 ? '256 (64 x 4)' : '16 (4 x 4)'); roRate.set(st.rate + ' Mbit/s');
			tbl.replaceChildren(el('table', { class: 'lab-table' }, [
				el('thead', {}, [el('tr', {}, ['Step', 'Result'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]),
				el('tbody', {}, [
					el('tr', {}, [el('th', { scope: 'row', text: 'Bits' }), el('td', { text: bits.slice(0, n).map(function (b, i) { return 'd' + i + '=' + b; }).join('  ') })]),
					el('tr', {}, [el('th', { scope: 'row', text: 'Phase 1 (from d0 d1)' }), el('td', { text: (ph[0] * 90) + ' degrees: a DQPSK phase change relative to the previous symbol (Gray coded: 00 = 0, 01 = 90, 11 = 180, 10 = 270)' })])
					, el('tr', {}, [el('th', { scope: 'row', text: 'Phases 2, 3, 4' }), el('td', { text: (st.rate === 11 ? 'from d2 d3, d4 d5, d6 d7 (00 = 0, 01 = 90, 10 = 180, 11 = 270):  ' : 'from d2 and d3 (phase 2 = 90 or 270, phase 3 = 0, phase 4 = 0 or 180):  ') + (ph[1] * 90) + ', ' + (ph[2] * 90) + ', ' + (ph[3] * 90) + ' degrees' })]),
					el('tr', {}, [el('th', { scope: 'row', text: 'The 8 chips' }), el('td', { text: chips.map(function (c, i) { return 'c' + i + ' = ' + CHIP_NAME[c]; }).join('  \u00b7  ') })])
				])]));
			// constellation + I/Q waveforms
			var W = 1000, H = 300, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'The eight CCK chips: constellation and I and Q waveforms' });
			var cx = 150, cy = 140, R = 85;
			s.append(svg('circle', { cx: cx, cy: cy, r: R, fill: 'none', class: 'lab-axis' }));
			s.append(svg('line', { x1: cx - R - 24, y1: cy, x2: cx + R + 24, y2: cy, class: 'lab-axis' })); s.append(svg('line', { x1: cx, y1: cy - R - 24, x2: cx, y2: cy + R + 24, class: 'lab-axis' }));
			var groups = [[], [], [], []];
			chips.forEach(function (c, i) { groups[c].push('c' + i); });
			groups.forEach(function (g, c) {
				if (!g.length) { return; }
				var p = IQ[c], px = cx + p[0] * R, py = cy - p[1] * R;
				s.append(svg('circle', { cx: px, cy: py, r: 6, class: 'lab-bar is-good' }));
				text(s, px + (p[0] === 1 ? 14 : (p[0] === -1 ? -14 : 0)), py + (p[1] === 1 ? -14 : (p[1] === -1 ? 24 : 5)), CHIP_NAME[c] + ':  ' + g.join(' '), 'lab-tick lab-tick--f', p[0] === 1 ? 'start' : (p[0] === -1 ? 'end' : 'middle'));
			});
			text(s, cx, H - 10, 'horizontal = I (real), vertical = Q (imaginary)', 'lab-tick', 'middle');
			var ix = 360, iw = 600;
			['I (real part)', 'Q (imaginary part)'].forEach(function (lbl, row) {
				var y = 80 + row * 110, vals = chips.map(function (c) { return IQ[c][row]; });
				text(s, ix, y - 40, lbl, 'lab-tick lab-tick--f');
				s.append(svg('line', { x1: ix, y1: y, x2: ix + iw, y2: y, class: 'lab-axis' }));
				for (var k = 0; k <= 8; k++) { s.append(svg('line', { x1: ix + k * iw / 8, y1: y - 36, x2: ix + k * iw / 8, y2: y + 36, class: 'lab-grid' })); }
				s.append(svg('path', { d: stepPath(vals, ix, ix + iw, y, 30), class: 'lab-wave is-on' }));
			});
			chips.forEach(function (c, i) { text(s, 360 + (i + 0.5) * 75, 14, 'c' + i, 'lab-tick', 'middle'); });
			text(s, ix + iw, H - 8, '8 chips x 91 ns = 0.73 microseconds per symbol  →', 'lab-tick', 'end');
			stage.replaceChildren(s);

			// receiver: correlate against every possible code word
			var cands = [], truth = -1, nc = st.rate === 11 ? 64 : 4;
			for (var a = 0; a < nc; a++) {
				var q2, q3, q4;
				if (st.rate === 11) { q2 = (a >> 4) & 3; q3 = (a >> 2) & 3; q4 = a & 3; } else { q2 = ((a >> 1) & 1) * 2 + 1; q3 = 0; q4 = (a & 1) * 2; }
				var ref = cckChips(0, q2, q3, q4);
				var re = 0, im = 0;
				for (var k = 0; k < 8; k++) { var rc = IQ[chips[k]], cc = IQ[ref[k]]; re += rc[0] * cc[0] + rc[1] * cc[1]; im += rc[1] * cc[0] - rc[0] * cc[1]; }
				var mag = Math.sqrt(re * re + im * im);
				cands.push(mag);
				if (q2 === ph[1] && q3 === ph[2] && q4 === ph[3]) { truth = a; }
			}
			var bw = 960 / nc, s2 = svg('svg', { viewBox: '0 0 1000 190', class: 'lab-svg', role: 'img', 'aria-label': 'Correlation of the received symbol against every possible CCK code word' });
			text(s2, 6, 14, 'The receiver correlates the 8 chips against all ' + nc + ' possible code words (phase 1 is removed by the magnitude). Only the right one reaches 8.', 'lab-tick lab-tick--f');
			s2.append(svg('line', { x1: 20, y1: 160, x2: 990, y2: 160, class: 'lab-axis' }));
			cands.forEach(function (m, a) { var h = m / 8 * 110; s2.append(svg('rect', { x: 20 + a * bw + 0.5, y: 160 - h, width: Math.max(1.5, bw - 1.5), height: h, class: 'lab-bar is-' + (a === truth ? 'good' : 'warn'), style: a === truth ? '' : 'opacity:.5' })); });
			text(s2, 20, 184, 'candidate code words →', 'lab-tick');
			text(s2, 20 + truth * bw + bw / 2, 160 - cands[truth] / 8 * 110 - 6, '8', 'lab-tick lab-tick--f', 'middle');
			var others = cands.filter(function (_, a) { return a !== truth; });
			text(s2, 990, 184, 'best wrong answer: ' + fmt(Math.max.apply(null, others), 1) + ' of 8', 'lab-tick', 'end');
			corrStage.replaceChildren(s2);
			note.textContent = 'CCK (complementary code keying) is the trick that took the 802.11 DSSS radio from 2 to 11 Mbit/s without changing the 11 Mchip/s chip rate or the 22 MHz channel. Instead of the fixed Barker code, the transmitter builds an 8-chip code word from the data bits: four phases (one DQPSK phase for the first two bits, plus phases from the remaining bits) are combined by a fixed equation into eight chips. Eight chips take 0.73 microseconds, so there are 1.375 million symbols a second, and 8 bits per symbol is 11 Mbit/s. The receiver correlates what arrives against every possible code word and picks the best match (the chart above). The right word scores a full 8, but other words are partly similar: the best wrong answer here is well above zero, because a word that differs in only some of the phases still agrees on several chips. That is why 11 Mbit/s needs a cleaner signal than 1 or 2 Mbit/s, and why an 802.11b link falls back to 5.5, 2 and then 1 Mbit/s as the signal weakens. Across all 64 words the worst wrong answer scores 5.7 out of 8. 5.5 Mbit/s uses the same equation with only 4 bits, and its four words are completely distinct (the worst wrong answer scores 0), which is why it survives a weaker signal. Reference: IEEE Std 802.11-2020, 16.3.6.6 (Equation 16-1, the cover code, and Tables 16-8 to 16-11). The code word equation and the bit-to-phase tables here were checked against that clause. In a real transmission odd-numbered symbols get an extra 180 degrees on phase 1, which this demonstration leaves out.';
		}
		build(); draw();
	};

	/* =====================================================================
	 * OFDM: bits -> subcarriers -> IFFT -> cyclic prefix (802.11a/g numerology)
	 * ===================================================================== */
	var OFDM_RATES = [
		{ mbps: 6,  mod: 'BPSK',   bpsc: 1, r: '1/2', ndbps: 24 },  { mbps: 9,  mod: 'BPSK',   bpsc: 1, r: '3/4', ndbps: 36 },
		{ mbps: 12, mod: 'QPSK',   bpsc: 2, r: '1/2', ndbps: 48 },  { mbps: 18, mod: 'QPSK',   bpsc: 2, r: '3/4', ndbps: 72 },
		{ mbps: 24, mod: '16-QAM', bpsc: 4, r: '1/2', ndbps: 96 },  { mbps: 36, mod: '16-QAM', bpsc: 4, r: '3/4', ndbps: 144 },
		{ mbps: 48, mod: '64-QAM', bpsc: 6, r: '2/3', ndbps: 192 }, { mbps: 54, mod: '64-QAM', bpsc: 6, r: '3/4', ndbps: 216 }
	];
	var PILOT_K = [-21, -7, 7, 21], PILOT_V = [1, 1, 1, -1];
	var DATA_K = (function () { var a = []; for (var k = -26; k <= 26; k++) { if (k !== 0 && PILOT_K.indexOf(k) < 0) { a.push(k); } } return a; })();   // 48 data subcarriers
	var LV = { 1: { 0: -1, 1: 1 }, 2: { 0: -1, 1: 1 }, 4: { 0: -3, 1: -1, 3: 1, 2: 3 }, 6: { 0: -7, 1: -5, 3: -3, 2: -1, 6: 1, 7: 3, 5: 5, 4: 7 } };   // Gray-coded levels (bit pattern as a number)
	var NORM = { 1: 1, 2: Math.SQRT2, 4: Math.sqrt(10), 6: Math.sqrt(42) };
	function mapBits(bs, bpsc) {
		if (bpsc === 1) { return [LV[1][bs[0]], 0]; }
		var h = bpsc / 2, iv = 0, qv = 0, i;
		for (i = 0; i < h; i++) { iv = iv * 2 + bs[i]; qv = qv * 2 + bs[h + i]; }
		return [LV[bpsc][iv] / NORM[bpsc], LV[bpsc][qv] / NORM[bpsc]];
	}
	function sinc(x) { return Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x); }

	window.WifiLabModels.ofdm = function (root) {
		var st = { rate: 7, seed: 5, sel: 3, all: true, echo: 0.5 };
		var controls = el('div', { class: 'lab-controls' });
		var selRate = el('select', { 'aria-label': 'Data rate' });
		OFDM_RATES.forEach(function (o, i) { selRate.append(el('option', { value: i, text: o.mbps + ' Mbit/s: ' + o.mod + ' ' + o.r })); });
		selRate.value = st.rate;
		selRate.addEventListener('change', function () { st.rate = Number(selRate.value); draw(); });
		var again = el('button', { type: 'button', class: 'lab-btn lab-btn--ghost', text: 'New random data' });
		again.addEventListener('click', function () { st.seed = Math.floor(Math.random() * 1e6); draw(); });
		controls.append(el('label', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Data rate (modulation and coding)' }), selRate]), el('div', { class: 'lab-ctl' }, [again]));
		var pipe = el('div', { class: 'lab-pipe' });
		var specStage = el('div', { class: 'lab-stage' });
		var specTools = el('div', { class: 'lab-controls' });
		var table = el('div', { class: 'lab-tablewrap' });
		var constStage = el('div', { class: 'lab-stage' });
		var timeStage = el('div', { class: 'lab-stage' });
		var echoWrap = el('div', { class: 'lab-controls' });
		var echoNote = el('p', { class: 'lab-note' });
		var note = el('p', { class: 'lab-note' });
		function h3(t) { return el('h3', { class: 'lab-rules__t', text: t }); }
		var subSeg = seg('Spectrum view', [['all', 'All subcarriers'], ['one', 'Only the one I picked']], 'all', function (v) { st.all = v === 'all'; draw(); });
		specTools.append(el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Show' }), subSeg]));
		echoWrap.append(slider('Echo delay (a reflection arriving after the main signal)', 0, 1.5, 0.05, st.echo, ' µs', function (v) { st.echo = v; draw(); }));
		root.append(controls,
			h3('1. What happens to the bits'), pipe,
			h3('2. The subcarriers: orthogonal narrow carriers'), specTools, specStage,
			h3('3. Bits to constellation points, and the time signal'), table, el('div', { class: 'lab-dual' }, [constStage, timeStage]),
			h3('4. Why the guard interval exists'), echoWrap, echoNote, note);

		function draw() {
			var R = OFDM_RATES[st.rate], r = rng(st.seed);
			var ncbps = 48 * R.bpsc;

			// ---- 1. pipeline ----
			var steps = [
				['Data bits', R.ndbps + ' bits per OFDM symbol', 'Scrambled so there are no long runs of 0s or 1s'],
				['Convolutional encoder', ncbps + ' coded bits', 'Rate ' + R.r + ' (constraint length 7); extra bits let the receiver correct errors'],
				['Interleaver', ncbps + ' bits, reordered', 'Neighbouring bits are spread across subcarriers so one faded subcarrier does not destroy a run of bits'],
				['Mapper', '48 points, ' + R.bpsc + ' bit' + (R.bpsc > 1 ? 's' : '') + ' each (' + R.mod + ')', 'Each group of bits chooses one constellation point for one subcarrier'],
				['Pilots added', '52 subcarriers', '4 BPSK pilots (subcarriers -21, -7, 7, 21), polarity set by a pseudo-random sequence, let the receiver track phase'],
				['64-point IFFT', '64 time samples', 'Adds all 52 subcarriers together into one waveform (3.2 microseconds)'],
				['Cyclic prefix', '16 + 64 = 80 samples', 'The last 0.8 microseconds are copied to the front: the guard interval'],
				['Radio', '20 million samples/s', '80 samples = 4 microseconds per symbol: ' + R.ndbps + ' bits / 4 µs = ' + R.mbps + ' Mbit/s']
			];
			pipe.replaceChildren.apply(pipe, steps.map(function (sp, i) {
				return el('div', { class: 'lab-pipe__step' }, [el('span', { class: 'lab-pipe__n', text: String(i + 1) }), el('b', { text: sp[0] }), el('span', { class: 'lab-pipe__v', text: sp[1] }), el('span', { class: 'lab-pipe__d', text: sp[2] })]);
			}));

			// ---- random bits -> subcarrier values ----
			var bits = [], i, k;
			for (i = 0; i < 48 * R.bpsc; i++) { bits.push(r() < 0.5 ? 0 : 1); }
			var X = {}, rows = [];
			DATA_K.forEach(function (kk, idx) {
				var bs = bits.slice(idx * R.bpsc, (idx + 1) * R.bpsc), pt = mapBits(bs, R.bpsc);
				X[kk] = pt; if (idx < 8) { rows.push([kk, bs.join(''), pt]); }
			});
			PILOT_K.forEach(function (kk, idx) { X[kk] = [PILOT_V[idx], 0]; });

			// ---- 2. spectrum with sinc shapes ----
			var W = 1000, H = 300, x0 = 40, x1 = 975, yb = 250, ytop = 40;
			function fx(f) { return x0 + (f + 32) / 64 * (x1 - x0); }
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'OFDM subcarriers: 52 used subcarriers each with a sinc-shaped spectrum that is zero at every other subcarrier' });
			s.append(svg('line', { x1: x0, y1: yb, x2: x1, y2: yb, class: 'lab-axis' }));
			function curve(kk, cls) {
				var d = '';
				for (var f = -32; f <= 32; f += 0.1) { var v = sinc(f - kk); d += (d ? 'L' : 'M') + fx(f).toFixed(1) + ' ' + (yb - Math.abs(v) * (yb - ytop)).toFixed(1); }
				s.append(svg('path', { d: d, class: cls }));
			}
			var used = DATA_K.concat(PILOT_K);
			if (st.all) { used.forEach(function (kk) { if (kk !== st.sel) { curve(kk, 'lab-sinc'); } }); }
			curve(st.sel, 'lab-sinc is-sel');
			used.forEach(function (kk) {
				var pilot = PILOT_K.indexOf(kk) >= 0;
				var g = svg('g', { class: 'lab-ov-row', tabindex: '0', role: 'button', 'aria-label': 'Subcarrier ' + kk + (pilot ? ' (pilot)' : '') });
				g.append(svg('rect', { x: fx(kk) - 6, y: yb + 2, width: 12, height: 24, fill: 'transparent' }));
				g.append(svg('line', { x1: fx(kk), y1: yb, x2: fx(kk), y2: yb + 10, class: 'lab-axis', style: 'stroke:' + (pilot ? 'var(--wp--preset--color--accent)' : 'var(--wp--preset--color--brand)') + ';stroke-width:3' }));
				g.addEventListener('click', function () { st.sel = kk; draw(); });
				g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); st.sel = kk; draw(); } });
				s.append(g);
			});
			// dots where the picked subcarrier's neighbours sit: its spectrum is exactly zero there
			used.forEach(function (kk) { if (kk !== st.sel) { s.append(svg('circle', { cx: fx(kk), cy: yb, r: 2.6, class: 'lab-sinc-zero' })); } });
			text(s, fx(0), yb + 40, 'subcarrier number (each is 312.5 kHz wide: 20 MHz / 64)', 'lab-tick', 'middle');
			[-26, -21, -7, 0, 7, 21, 26].forEach(function (kk) { text(s, fx(kk), yb + 22, String(kk), 'lab-tick', 'middle'); });
			text(s, fx(0), ytop - 14, 'DC: unused', 'lab-tick', 'middle');
			text(s, fx(-29.5), ytop + 40, 'guard', 'lab-tick', 'middle'); text(s, fx(29.5), ytop + 40, 'guard', 'lab-tick', 'middle');
			text(s, x1, ytop - 14, 'orange ticks: pilots   blue ticks: data   dots: where every other subcarrier is exactly zero', 'lab-tick', 'end');
			specStage.replaceChildren(s);

			// ---- 3. table, constellation, time signal ----
			table.replaceChildren(el('table', { class: 'lab-table' }, [
				el('thead', {}, [el('tr', {}, ['Subcarrier', 'Bits carried', 'Constellation point (I, Q)'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]),
				el('tbody', {}, rows.map(function (rw) { return el('tr', {}, [el('th', { scope: 'row', text: String(rw[0]) }), el('td', { text: rw[1] }), el('td', { text: '(' + fmt(rw[2][0], 2) + ', ' + fmt(rw[2][1], 2) + ')' })]); }))]));
			var cs = svg('svg', { viewBox: '0 0 360 300', class: 'lab-svg', role: 'img', 'aria-label': 'Constellation: the points assigned to the 48 data subcarriers' });
			var ccx = 180, ccy = 150, sc = 110;
			cs.append(svg('line', { x1: 20, y1: ccy, x2: 340, y2: ccy, class: 'lab-axis' })); cs.append(svg('line', { x1: ccx, y1: 10, x2: ccx, y2: 290, class: 'lab-axis' }));
			var pts = {};
			DATA_K.forEach(function (kk) { var p = X[kk], key = p[0].toFixed(3) + ',' + p[1].toFixed(3); pts[key] = p; });
			Object.keys(pts).forEach(function (key) { var p = pts[key]; cs.append(svg('circle', { cx: ccx + p[0] * sc, cy: ccy - p[1] * sc, r: 5, class: 'lab-bar is-good', style: 'opacity:.5' })); });
			DATA_K.forEach(function (kk) { var p = X[kk]; cs.append(svg('circle', { cx: ccx + p[0] * sc, cy: ccy - p[1] * sc, r: 2.2, class: 'lab-bar is-good' })); });
			text(cs, 6, 14, R.mod + ': ' + Math.pow(2, R.bpsc) + ' possible points', 'lab-tick lab-tick--f');

			// IFFT (direct DFT, 64 points)
			var N = 64, xr = [], xi = [], n;
			for (n = 0; n < N; n++) {
				var re = 0, im = 0;
				for (k = -26; k <= 26; k++) { var p2 = X[k]; if (!p2) { continue; } var ang = 2 * Math.PI * k * n / N, c = Math.cos(ang), sn = Math.sin(ang); re += p2[0] * c - p2[1] * sn; im += p2[0] * sn + p2[1] * c; }
				xr.push(re / Math.sqrt(52)); xi.push(im / Math.sqrt(52));
			}
			var sym = xr.slice(48).concat(xr);     // cyclic prefix: copy of the last 16 samples
			var tw = 640, ts = svg('svg', { viewBox: '0 0 ' + (tw + 60) + ' 300', class: 'lab-svg', role: 'img', 'aria-label': 'The time-domain OFDM symbol: 16 samples of cyclic prefix followed by 64 samples' });
			var tx0 = 20, tx1 = tw + 40, ty = 150, amp = 38;
			var cpw = (tx1 - tx0) * 16 / 80;
			ts.append(svg('rect', { x: tx0, y: 30, width: cpw, height: 240, class: 'lab-ov-zone' }));
			ts.append(svg('line', { x1: tx0, y1: ty, x2: tx1, y2: ty, class: 'lab-axis' }));
			ts.append(svg('path', { d: linePath(sym, tx0, tx1, ty, amp, -3.2, 3.2), class: 'lab-wave is-on' }));
			text(ts, tx0, 22, 'shaded: guard interval 0.8 µs (a copy of the end of the symbol)', 'lab-tick lab-tick--f');
			text(ts, tx1, 292, 'one OFDM symbol = 4 µs: 80 samples  →', 'lab-tick', 'end');
			text(ts, tx0, 292, 'The sum of 52 subcarriers (real part shown)', 'lab-tick');
			constStage.replaceChildren(cs); timeStage.replaceChildren(ts);

			// ---- 4. echo / guard interval ----
			var inside = st.echo <= 0.8;
			echoNote.textContent = (inside
				? 'An echo ' + fmt(st.echo, 2) + ' µs late arrives inside the 0.8 µs guard interval. The receiver simply discards the guard interval, the echo only changes the gain and phase of each subcarrier (which the pilots and a short training field let it correct), and there is no interference between symbols.'
				: 'An echo ' + fmt(st.echo, 2) + ' µs late is longer than the 0.8 µs guard interval, so its start spills into the next symbol and causes inter-symbol interference. This is why OFDM designs choose a guard interval longer than the delay spread of the room, and why very large spaces can cause trouble.')
				+ ' For comparison, one DSSS chip lasts only 0.09 µs, so the same echo smears across about ' + Math.round(st.echo / 0.0909) + ' chips, which the DSSS receiver has to untangle.';
			note.textContent = 'This is the OFDM of IEEE Std 802.11-2020 clause 17 (first used by 802.11a), which 802.11g uses in 2.4 GHz as the ERP-OFDM of clause 18. The numbers here match Tables 17-4 and 17-5 (data rates, 48 data and 4 pilot subcarriers, 312.5 kHz spacing, 3.2 microsecond symbol, 0.8 microsecond guard interval) and the constellation Tables 17-11 to 17-15. The idea is to replace one fast, wide carrier by 52 slow, narrow ones: each subcarrier carries few bits at a low symbol rate, so each is robust against echoes. They can sit so close that their spectra overlap, because their spacing (312.5 kHz = 1 / 3.2 µs) makes each one exactly zero at the centre of every other (the dots on the chart): that is orthogonality. The IFFT is just the efficient way to add up all the subcarriers. Later generations keep the idea and change the numbers: 802.11n uses 52 data subcarriers in 20 MHz with spatial streams on top; 802.11ax and 802.11be use 4 times longer symbols (12.8 µs, 78.125 kHz spacing, a 256-point FFT in 20 MHz) for better efficiency and echo tolerance.';
		}
		draw();
	};
})();
