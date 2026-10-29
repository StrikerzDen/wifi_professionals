/* Wi-Fi Pro Lab: propagation and antennas, QAM, OFDMA and MIMO models.
 * Formulas (all stated on the lesson pages):
 *   free-space path loss: 20 log10(d) + 20 log10(f) - 27.55 (d in m, f in MHz);
 *   log-distance model: PL(d) = PL(1 m) + 10 n log10(d) + wall losses;
 *   first Fresnel zone radius at distance d1, d2 from the ends: sqrt(lambda d1 d2 / (d1 + d2));
 *   square QAM: levels +-1, +-3 ... scaled to unit average power, symbol error ~ 4(1 - 1/sqrt(M)) Q(sqrt(3 SNR / (M - 1)));
 *   OFDMA: HE resource units of 26, 52, 106, 242, 484 tones with 24, 48, 102, 234, 468 data subcarriers, 12.8 us + 0.8 us symbol;
 *   uniform linear array of N elements at half-wavelength spacing: |AF| = |sin(N psi / 2) / (N sin(psi / 2))|, psi = pi (sin phi - sin phi0).
 * Antenna patterns are idealised teaching shapes, not measurements of a real product.
 * Helpers come from lab.js (window.WifiLab); models register themselves in window.WifiLabModels.
 */
(function () {
	'use strict';
	var L = window.WifiLab;
	if (!L) { return; }
	var el = L.el, svg = L.svg, seg = L.seg, readout = L.readout, fmt = L.fmt;
	window.WifiLabModels = window.WifiLabModels || {};
	var C = 299792458, TAU = 2 * Math.PI;

	function text(parent, x, y, str, cls, anchor) { var t = svg('text', { x: x, y: y, class: cls || 'lab-tick', 'text-anchor': anchor || 'start' }); t.textContent = str; parent.append(t); return t; }
	function slider(label, min, max, step, val, fmtv, onInput) {
		var out = el('output', { text: fmtv(val) });
		var inp = el('input', { type: 'range', min: min, max: max, step: step, value: val, 'aria-label': label });
		inp.addEventListener('input', function () { out.textContent = fmtv(Number(inp.value)); onInput(Number(inp.value)); });
		return el('label', { class: 'lab-ctl lab-ctl--range' }, [el('span', { class: 'lab-ctl__t' }, [document.createTextNode(label + ': '), out]), inp]);
	}
	function ctl(title, node) { return el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: title }), node]); }
	function rng(seed) { var a = seed >>> 0; return function () { a += 0x6D2B79F5; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
	function gauss(r) { var u = 0, v = 0; while (u === 0) { u = r(); } while (v === 0) { v = r(); } return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
	function erfc(x) { var z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
	function Q(x) { return 0.5 * erfc(x / Math.SQRT2); }

	/* =====================================================================
	 * Link budget: how far does a signal reach?
	 * ===================================================================== */
	window.WifiLabModels.linkbudget = function (root) {
		var F = [['2.4 GHz', 2437], ['5 GHz', 5500], ['6 GHz', 6135]];
		var ENV = [['2', 'Free space (n = 2)'], ['3', 'Open office (n = 3)'], ['4', 'Cluttered (n = 4)']];
		var st = { f: 0, n: 3, eirp: 20, walls: 1, wall: 5, req: -67 };
		var controls = el('div', { class: 'lab-controls' }, [
			ctl('Frequency', seg('Frequency', F.map(function (f, i) { return [i, f[0]]; }), 0, function (v) { st.f = Number(v); draw(); })),
			ctl('Environment (path-loss exponent)', seg('Environment', ENV, '3', function (v) { st.n = Number(v); draw(); })),
			slider('Transmit EIRP', 10, 30, 1, st.eirp, function (v) { return v + ' dBm'; }, function (v) { st.eirp = v; draw(); }),
			slider('Walls in the way', 0, 6, 1, st.walls, function (v) { return String(v); }, function (v) { st.walls = v; draw(); }),
			slider('Loss per wall', 1, 15, 1, st.wall, function (v) { return v + ' dB'; }, function (v) { st.wall = v; draw(); }),
			slider('Signal the receiver needs', -90, -50, 1, st.req, function (v) { return v + ' dBm'; }, function (v) { st.req = v; draw(); })
		]);
		var stage = el('div', { class: 'lab-stage' });
		var roR = readout('', 'range (signal still strong enough)', 'good'), roPL = readout('', 'path loss at 10 m'), roRx = readout('', 'signal at 10 m');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roR, roPL, roRx]), note);
		function pl1(fm) { return 20 * Math.log10(fm) - 27.55; }
		function rx(fm, d) { return st.eirp - (pl1(fm) + 10 * st.n * Math.log10(d) + st.walls * st.wall); }
		function range(fm) { return Math.pow(10, (st.eirp - st.walls * st.wall - pl1(fm) - st.req) / (10 * st.n)); }
		function draw() {
			var W = 1000, H = 330, x0 = 70, x1 = 960, yT = 20, yB = 270, lo = -110, hi = 0;
			function X(d) { return x0 + (Math.log10(d) - 0) / Math.log10(200) * (x1 - x0); }
			function Y(v) { return yT + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (yB - yT); }
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Received signal against distance for three bands, with the level the receiver needs' });
			for (var v = lo; v <= hi; v += 20) { s.append(svg('line', { x1: x0, y1: Y(v), x2: x1, y2: Y(v), class: 'lab-axis', 'stroke-dasharray': '2 5', opacity: .5 })); text(s, x0 - 8, Y(v) + 4, String(v), 'lab-tick', 'end'); }
			text(s, x0 - 8, yT - 6, 'dBm', 'lab-tick', 'end');
			[1, 2, 5, 10, 20, 50, 100, 200].forEach(function (d) { s.append(svg('line', { x1: X(d), y1: yB, x2: X(d), y2: yB + 5, class: 'lab-axis' })); text(s, X(d), yB + 22, d + ' m', 'lab-tick', 'middle'); });
			s.append(svg('line', { x1: x0, y1: yB, x2: x1, y2: yB, class: 'lab-axis' }));
			F.forEach(function (f, i) {
				var d = '';
				for (var k = 0; k <= 120; k++) { var dist = Math.pow(200, k / 120); d += (k ? 'L' : 'M') + X(dist).toFixed(1) + ' ' + Y(rx(f[1], dist)).toFixed(1); }
				s.append(svg('path', { d: d, class: 'lab-wave' + (i === st.f ? ' is-on' : ''), style: i === st.f ? '' : 'opacity:.5;stroke-dasharray:6 5' }));
				text(s, x1 - 4, Y(rx(f[1], 200)) - 6 - i * 13, f[0], i === st.f ? 'lab-tick lab-tick--f' : 'lab-tick', 'end');
			});
			s.append(svg('line', { x1: x0, y1: Y(st.req), x2: x1, y2: Y(st.req), class: 'lab-ov-edge' }));
			text(s, x0 + 6, Y(st.req) - 6, 'needed: ' + st.req + ' dBm', 'lab-tick lab-tick--f');
			var rg = range(F[st.f][1]);
			if (rg >= 1 && rg <= 200) { s.append(svg('line', { x1: X(rg), y1: yT, x2: X(rg), y2: yB, class: 'lab-ov-edge' })); text(s, X(rg), yT + 12, 'range ' + fmt(rg, rg < 10 ? 1 : 0) + ' m', 'lab-tick lab-tick--f', 'middle'); }
			stage.replaceChildren(s);
			roR.set(rg < 1 ? 'under 1 m' : (rg > 1000 ? 'over 1 km' : fmt(rg, rg < 10 ? 1 : 0) + ' m'), rg < 3 ? 'bad' : 'good');
			roPL.set(fmt(pl1(F[st.f][1]) + 10 * st.n * 1 + st.walls * st.wall, 1) + ' dB'); roRx.set(fmt(rx(F[st.f][1], 10), 1) + ' dBm');
			var others = F.map(function (f, i) { return i === st.f ? null : f[0] + ': ' + (range(f[1]) > 1000 ? 'over 1 km' : fmt(range(f[1]), range(f[1]) < 10 ? 1 : 0) + ' m'); }).filter(Boolean).join('; ');
			note.textContent = 'Received signal = EIRP - path loss, with path loss = free-space loss at 1 m + 10 n log10(distance) + the loss of each wall. The exponent n is 2 in free space and larger indoors; the numbers for n and the wall loss are illustrative, so always measure a real building. For the same settings the other bands reach: ' + others + '. Free-space loss grows with frequency, which is why higher bands reach less far with the same power and antennas.';
		}
		draw();
	};

	/* =====================================================================
	 * Antenna patterns (idealised)
	 * ===================================================================== */
	window.WifiLabModels.antenna = function (root) {
		var st = { type: 'dipole', gain: 12 };
		var sType = seg('Antenna type', [['dipole', 'Dipole (omnidirectional)'], ['dir', 'Directional (patch or sector)']], 'dipole', function (v) { st.type = v; draw(); });
		var sGain = slider('Gain of the directional antenna', 6, 20, 1, st.gain, function (v) { return v + ' dBi'; }, function (v) { st.gain = v; draw(); });
		var controls = el('div', { class: 'lab-controls' }, [ctl('Antenna', sType), sGain]);
		var stage = el('div', { class: 'lab-stage' });
		var roG = readout('', 'peak gain', 'good'), roBW = readout('', 'half-power beamwidth'), roE = readout('', 'EIRP from a 15 dBm transmitter');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roG, roBW, roE]), note);
		function pattern(th) { // th = angle from the antenna's horizontal plane (dipole) or from the boresight (directional); returns relative power 0..1
			if (st.type === 'dipole') { var c = Math.cos(th), s = Math.sin(th); var a = Math.abs(c) < 1e-6 ? 0 : Math.cos(Math.PI / 2 * s) / c; return a * a; } // vertical dipole seen from the side: th = elevation
			var n = Math.pow(10, st.gain / 10) / 2 - 1; return Math.abs(th) >= Math.PI / 2 ? 0 : Math.pow(Math.cos(th), n);
		}
		function draw() {
			sGain.style.display = st.type === 'dir' ? '' : 'none';
			var W = 640, H = 330, cx = st.type === 'dir' ? 120 : 320, cy = 165, R = st.type === 'dir' ? 266 : 140;
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': st.type === 'dipole' ? 'Side view of a dipole pattern: a doughnut with nulls along the antenna axis' : 'Pattern of a directional antenna, a lobe pointing right' });
			[0.5, 1].forEach(function (r) { s.append(svg('circle', { cx: cx, cy: cy, r: R * Math.sqrt(r), fill: 'none', class: 'lab-axis', 'stroke-dasharray': '3 5', opacity: .6 })); });
			text(s, cx + R * Math.sqrt(0.5) * 0.71 + 4, cy - R * Math.sqrt(0.5) * 0.71, '-3 dB', 'lab-tick');
			var d = '', k, th, p, r2;
			if (st.type === 'dipole') {
				for (k = 0; k <= 360; k++) { th = (k - 90) * Math.PI / 180; // elevation angle around the circle
					var el_ = Math.asin(Math.sin(th)); p = pattern(el_); r2 = R * Math.sqrt(p); d += (k ? 'L' : 'M') + (cx + r2 * Math.cos(th)).toFixed(1) + ' ' + (cy + r2 * Math.sin(th)).toFixed(1); }
				s.append(svg('path', { d: d + 'Z', class: 'lab-ov-bell is-sel', style: 'cursor:default' }));
				s.append(svg('line', { x1: cx, y1: cy - R - 10, x2: cx, y2: cy + R + 10, stroke: 'currentColor', 'stroke-width': 4, 'stroke-linecap': 'round' }));
				text(s, cx + 12, cy - R - 4, 'the dipole', 'lab-tick lab-tick--f'); text(s, cx + R + 4, cy + 4, 'strongest sideways', 'lab-tick', 'start');
				text(s, cx - 8, cy - R + 8, 'null', 'lab-tick', 'end'); text(s, cx - 8, cy + R + 2, 'null', 'lab-tick', 'end');
			} else {
				for (k = -90; k <= 90; k += 0.5) { th = k * Math.PI / 180; p = pattern(th); r2 = R * Math.sqrt(p); if (k === -90) { d += 'M' + cx + ' ' + cy; } d += 'L' + (cx + r2 * Math.cos(th)).toFixed(1) + ' ' + (cy + r2 * Math.sin(th)).toFixed(1); }
				s.append(svg('path', { d: d + 'Z', class: 'lab-ov-bell is-sel', style: 'cursor:default' }));
				s.append(svg('rect', { x: cx - 10, y: cy - 28, width: 10, height: 56, rx: 2, fill: 'currentColor' }));
				text(s, cx + 12, cy - 34, 'boresight', 'lab-tick lab-tick--f');
			}
			text(s, 6, 20, st.type === 'dipole' ? 'Side view (vertical plane)' : 'Top view, power pattern', 'lab-tick lab-tick--f');
			stage.replaceChildren(s);
			var g = st.type === 'dipole' ? 2.15 : st.gain, bw;
			if (st.type === 'dipole') { var lo = 0, hi_ = Math.PI / 2; for (var i = 0; i < 60; i++) { var m = (lo + hi_) / 2; if (pattern(m) > 0.5) { lo = m; } else { hi_ = m; } } bw = 2 * (lo * 180 / Math.PI); }
			else { var n = Math.pow(10, st.gain / 10) / 2 - 1; bw = 2 * Math.acos(Math.pow(0.5, 1 / n)) * 180 / Math.PI; }
			roG.set(fmt(g, 2) + ' dBi'); roBW.set(fmt(bw, 0) + '°'); roE.set(fmt(15 + g, 1) + ' dBm');
			note.textContent = st.type === 'dipole'
				? 'A half-wave dipole has a gain of 2.15 dBi (so dBd = dBi - 2.15). Its pattern is a doughnut: it radiates well all round the antenna but not along its length, which is why the orientation of a vertical antenna matters for devices above or below it. The half-power beamwidth in the vertical plane is about 78 degrees.'
				: 'A directional antenna does not create power: it squeezes the same power into a narrower beam, so it is stronger on boresight and weaker everywhere else. The pattern here is an idealised cos^n shape matched to the gain you choose (gain = 10 log10(2(n + 1))): higher gain means a narrower beam. Real antennas also have side lobes and a back lobe. Remember that regulators limit EIRP, which includes this gain.';
		}
		draw();
	};

	/* =====================================================================
	 * Fresnel zone
	 * ===================================================================== */
	window.WifiLabModels.fresnel = function (root) {
		var F = [['2.4 GHz', 2437], ['5 GHz', 5500], ['6 GHz', 6135]];
		var st = { f: 0, d: 100 };
		var controls = el('div', { class: 'lab-controls' }, [ctl('Frequency', seg('Frequency', F.map(function (f, i) { return [i, f[0]]; }), 0, function (v) { st.f = Number(v); draw(); })), slider('Link length', 10, 500, 10, st.d, function (v) { return v + ' m'; }, function (v) { st.d = v; draw(); })]);
		var stage = el('div', { class: 'lab-stage' });
		var roR = readout('', 'first Fresnel zone radius at the middle'), roC = readout('', 'keep clear (60% of it)', 'good');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roR, roC]), note);
		function draw() {
			var lam = C / (F[st.f][1] * 1e6), r = 0.5 * Math.sqrt(lam * st.d), W = 1000, H = 230, x0 = 60, x1 = 940, yc = 115, sc = Math.min(1, 85 / r) * 1;
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'The first Fresnel zone between two antennas' });
			var d = '';
			for (var k = 0; k <= 100; k++) { var t = k / 100, rr = Math.sqrt(lam * st.d * t * (1 - t)); d += (k ? 'L' : 'M') + (x0 + t * (x1 - x0)).toFixed(1) + ' ' + (yc - rr * sc).toFixed(1); }
			for (k = 100; k >= 0; k--) { t = k / 100; rr = Math.sqrt(lam * st.d * t * (1 - t)); d += 'L' + (x0 + t * (x1 - x0)).toFixed(1) + ' ' + (yc + rr * sc).toFixed(1); }
			s.append(svg('path', { d: d + 'Z', class: 'lab-ov-bell is-ov', style: 'opacity:.35;cursor:default' }));
			s.append(svg('line', { x1: x0, y1: yc, x2: x1, y2: yc, class: 'lab-axis', 'stroke-dasharray': '4 4' }));
			[x0, x1].forEach(function (x) { s.append(svg('line', { x1: x, y1: yc - 40, x2: x, y2: yc + 40, stroke: 'currentColor', 'stroke-width': 4, 'stroke-linecap': 'round' })); });
			var mid = (x0 + x1) / 2; s.append(svg('line', { x1: mid, y1: yc - r * sc, x2: mid, y2: yc + r * sc, class: 'lab-ov-edge' }));
			text(s, mid + 8, yc - r * sc - 6, 'radius ' + fmt(r, 2) + ' m', 'lab-tick lab-tick--f');
			text(s, x0, yc + 62, 'transmitter', 'lab-tick', 'middle'); text(s, x1, yc + 62, 'receiver', 'lab-tick', 'middle'); text(s, mid, H - 8, st.d + ' m', 'lab-tick', 'middle');
			stage.replaceChildren(s);
			roR.set(fmt(r, 2) + ' m'); roC.set(fmt(0.6 * r, 2) + ' m');
			note.textContent = 'The first Fresnel zone is the ellipsoid around the straight line in which reflected waves arrive less than half a wavelength late. Its radius at distance d1 and d2 from the two ends is sqrt(lambda d1 d2 / (d1 + d2)), which at the middle of a link of length d is 0.5 sqrt(lambda d). An obstacle that cuts into it costs signal even though the straight line is clear; a common rule of thumb is to keep about 60% of the radius free. The drawing is not to scale vertically.';
		}
		draw();
	};

	/* =====================================================================
	 * QAM constellations
	 * ===================================================================== */
	var QAMS = [['BPSK', 2], ['QPSK', 4], ['16-QAM', 16], ['64-QAM', 64], ['256-QAM', 256], ['1024-QAM', 1024], ['4096-QAM', 4096]];
	function constellation(M) {
		if (M === 2) { return { pts: [[-1, 0], [1, 0]], norm: 1, side: 2, bpa: 1, bpsym: 1 }; }
		var side = Math.round(Math.sqrt(M)), levels = [], pts = [], i, j, norm = Math.sqrt(2 * (M - 1) / 3);
		for (i = 0; i < side; i++) { levels.push(-(side - 1) + 2 * i); }
		for (i = 0; i < side; i++) { for (j = 0; j < side; j++) { pts.push([levels[i] / norm, levels[j] / norm, i, j]); } }
		return { pts: pts, levels: levels, norm: norm, side: side, bpa: Math.log2(side) };
	}
	function gray(i, bits) { var g = i ^ (i >> 1), s = g.toString(2); while (s.length < bits) { s = '0' + s; } return s; }
	function qamSER(M, snrDb) { var snr = Math.pow(10, snrDb / 10); if (M === 2) { return Q(Math.sqrt(2 * snr)); } return 4 * (1 - 1 / Math.sqrt(M)) * Q(Math.sqrt(3 * snr / (M - 1))); }
	window.WifiLabModels.qam = function (root) {
		var st = { m: 3, snr: 25, seed: 7 };
		var sm = seg('Modulation', QAMS.map(function (q, i) { return [i, q[0]]; }), st.m, function (v) { st.m = Number(v); draw(); });
		var controls = el('div', { class: 'lab-controls' }, [ctl('Modulation', sm), slider('Signal-to-noise ratio', 0, 45, 1, st.snr, function (v) { return v + ' dB'; }, function (v) { st.snr = v; draw(); }), el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Noise' }), (function () { var b = el('button', { type: 'button', class: 'lab-net__b', text: 'Draw new noise' }); b.addEventListener('click', function () { st.seed += 1; draw(); }); return b; })()])]);
		var stage = el('div', { class: 'lab-stage' });
		var roB = readout('', 'bits in every symbol'), roD = readout('', 'smallest gap between points (average power = 1)'), roSim = readout('', 'symbols wrongly decided (this run)'), roTh = readout('', 'expected symbol error rate (theory)'), roNeed = readout('', 'SNR for about 1% symbol errors, uncoded');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roB, roD, roSim, roTh, roNeed]), note);
		function need(M) { var lo = 0, hi = 60; for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (qamSER(M, mid) > 0.01) { lo = mid; } else { hi = mid; } } return hi; }
		function draw() {
			var M = QAMS[st.m][1], c = constellation(M), W = 520, H = 520, cx = 260, cy = 260, S = 215;
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': QAMS[st.m][0] + ' constellation with received symbols at ' + st.snr + ' dB SNR', style: 'max-width:520px;margin:0 auto' });
			s.append(svg('line', { x1: 20, y1: cy, x2: W - 20, y2: cy, class: 'lab-axis' })); s.append(svg('line', { x1: cx, y1: 20, x2: cx, y2: H - 20, class: 'lab-axis' }));
			text(s, W - 24, cy - 8, 'I', 'lab-tick lab-tick--f', 'end'); text(s, cx + 8, 34, 'Q', 'lab-tick lab-tick--f');
			var amax = M === 2 ? 1.25 : (c.levels[c.side - 1] + 1) / c.norm, k = S / amax;
			function px(v) { return cx + v * k; } function py(v) { return cy - v * k; }
			var sigma = Math.sqrt(Math.pow(10, -st.snr / 10) / 2), r = rng(st.seed * 2654435761), N = 1500, errs = 0, i, dots = '';
			for (i = 0; i < N; i++) {
				var p = c.pts[Math.floor(r() * c.pts.length)], ri = p[0] + sigma * gauss(r), rq = p[1] + sigma * gauss(r), di, dq;
				if (M === 2) { di = ri >= 0 ? 1 : -1; if (di !== p[0]) { errs++; } }
				else { var li = Math.round((ri * c.norm + (c.side - 1)) / 2), lq = Math.round((rq * c.norm + (c.side - 1)) / 2); li = Math.max(0, Math.min(c.side - 1, li)); lq = Math.max(0, Math.min(c.side - 1, lq)); if (li !== p[2] || lq !== p[3]) { errs++; } }
				s.append(svg('circle', { cx: px(ri).toFixed(1), cy: py(M === 2 ? rq : rq).toFixed(1), r: 1.8, fill: 'var(--wp--preset--color--brand)', opacity: .35 }));
			}
			var big = M <= 64, pr = M <= 16 ? 7 : (M <= 64 ? 4.5 : (M <= 256 ? 2.8 : 1.6));
			c.pts.forEach(function (p) { s.append(svg('circle', { cx: px(p[0]), cy: py(p[1]), r: pr, fill: 'var(--wp--preset--color--accent)', stroke: 'var(--wp--preset--color--ink)', 'stroke-width': M <= 64 ? 1 : 0.4 })); });
			if (M <= 16) { c.pts.forEach(function (p) { var lab = M === 2 ? (p[0] > 0 ? '1' : '0') : gray(p[2], c.bpa) + gray(p[3], c.bpa); text(s, px(p[0]), py(p[1]) - 12, lab, 'lab-tick lab-tick--f', 'middle'); }); }
			stage.replaceChildren(s);
			var th = qamSER(M, st.snr), bps = M === 2 ? 1 : 2 * c.bpa, dmin = M === 2 ? 2 : 2 / c.norm;
			roB.set(String(bps)); roD.set(fmt(dmin, 3)); roSim.set(fmt(errs / N * 100, 1) + '%', errs / N > 0.05 ? 'bad' : (errs / N > 0.005 ? 'warn' : 'good')); roTh.set(th < 0.0001 ? 'under 0.01%' : fmt(th * 100, th < 0.01 ? 2 : 1) + '%'); roNeed.set(fmt(need(M), 0) + ' dB');
			note.textContent = 'Each large orange circle is a symbol the transmitter may send; each small blue dot is what the receiver sees after noise (1500 symbols). The receiver decides by picking the nearest point, so a symbol is lost when noise pushes it across the line between two points. More points carry more bits per symbol but sit closer together, so they need a cleaner signal. Wi-Fi adds error-correcting coding, so real links work at a lower SNR than the uncoded figure shown. Points up to 16-QAM are labelled with their Gray-coded bits: neighbouring points differ by a single bit.';
		}
		draw();
	};

	/* =====================================================================
	 * OFDMA: resource units
	 * ===================================================================== */
	var HE_MCS = [['MCS 0', 1, 0.5], ['MCS 1', 2, 0.5], ['MCS 2', 2, 0.75], ['MCS 3', 4, 0.5], ['MCS 4', 4, 0.75], ['MCS 5', 6, 2 / 3], ['MCS 6', 6, 0.75], ['MCS 7', 6, 5 / 6], ['MCS 8', 8, 0.75], ['MCS 9', 8, 5 / 6], ['MCS 10', 10, 0.75], ['MCS 11', 10, 5 / 6]];
	var NSD = { 26: 24, 52: 48, 106: 102, 242: 234, 484: 468 };
	window.WifiLabModels.ofdma = function (root) {
		var LAYOUTS = { '20': [['1 x 242', [242]], ['2 x 106 + 26', [106, 26, 106]], ['4 x 52 + 26', [52, 52, 26, 52, 52]], ['9 x 26', [26, 26, 26, 26, 26, 26, 26, 26, 26]]], '40': [['1 x 484', [484]], ['2 x 242', [242, 242]], ['4 x 106 + 2 x 26', [106, 26, 106, 106, 26, 106]], ['8 x 52 + 2 x 26', [52, 52, 26, 52, 52, 52, 52, 26, 52, 52]], ['18 x 26', [26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26]]] };
		var st = { w: '20', lay: 3, mcs: 7, over: 120, bytes: 200 };
		var layBox = el('div', { class: 'lab-ctl' });
		var sw = seg('Channel width', [['20', '20 MHz'], ['40', '40 MHz']], '20', function (v) { st.w = v; st.lay = Math.min(st.lay, LAYOUTS[v].length - 1); buildLay(); draw(); });
		function buildLay() { layBox.replaceChildren(el('span', { class: 'lab-ctl__t', text: 'Split the channel into' }), seg('Resource unit layout', LAYOUTS[st.w].map(function (l, i) { return [i, l[0]]; }), st.lay, function (v) { st.lay = Number(v); draw(); })); }
		var smcs = el('select', { 'aria-label': 'HE modulation and coding scheme' }); HE_MCS.forEach(function (m, i) { smcs.append(el('option', { value: i, text: m[0] + ': ' + (m[1] === 1 ? 'BPSK' : (m[1] === 2 ? 'QPSK' : (Math.pow(2, m[1]) + '-QAM'))) + ', rate ' + (m[2] === 2 / 3 ? '2/3' : (m[2] === 5 / 6 ? '5/6' : (m[2] === 0.75 ? '3/4' : '1/2'))) })); }); smcs.value = st.mcs; smcs.addEventListener('change', function () { st.mcs = Number(smcs.value); draw(); });
		var controls = el('div', { class: 'lab-controls' }, [ctl('Channel width', sw), layBox, ctl('Modulation and coding (one spatial stream)', smcs),
			slider('Fixed cost of each transmission', 40, 300, 10, st.over, function (v) { return v + ' µs'; }, function (v) { st.over = v; draw(); }),
			slider('Data for each client', 50, 1500, 50, st.bytes, function (v) { return v + ' bytes'; }, function (v) { st.bytes = v; draw(); })]);
		buildLay();
		var stage = el('div', { class: 'lab-stage' }), stage2 = el('div', { class: 'lab-stage' });
		var roU = readout('', 'clients served in one transmission', 'good'), roR = readout('', 'data rate of the smallest resource unit'), roT = readout('', 'time saved against one client at a time', 'good');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roU, roR, roT]), stage2, note);
		function draw() {
			var rus = LAYOUTS[st.w][st.lay][1], total = rus.reduce(function (a, b) { return a + b; }, 0), m = HE_MCS[st.mcs], W = 1000, H = 130, x0 = 20, x1 = 980, x = x0;
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'A ' + st.w + ' MHz channel split into ' + rus.length + ' resource units' });
			var users = rus.length;
			rus.forEach(function (r, i) {
				var w = (x1 - x0) * r / (st.w === '20' ? 242 : 484), used = true;
				s.append(svg('rect', { x: x, y: 20, width: Math.max(4, w - 4), height: 60, rx: 5, class: 'lab-bar ' + (used ? 'is-good' : 'is-warn'), style: 'opacity:' + (used ? .75 : .3) }));
				if (w > 24) { text(s, x + w / 2 - 2, 56, String(r), 'lab-tick lab-tick--f', 'middle'); }
				x += w;
			});
			text(s, x0, 106, 'Frequency across the ' + st.w + ' MHz channel. Each block is a resource unit; the number is its width in subcarrier tones.', 'lab-tick');
			stage.replaceChildren(s);
			var nu = users, ruRate = function (r) { return NSD[r] * m[1] * m[2] / 13.6; };
			var firstRU = Math.min.apply(null, rus);
			// comparison: one client at a time on the whole channel vs everyone together in resource units
			var full = st.w === '20' ? 242 : 484, bits = st.bytes * 8;
			var seqTime = nu * (st.over + bits / ruRate(full)), togTime = st.over + bits / ruRate(firstRU);
			var W2 = 1000, H2 = 130, s2 = svg('svg', { viewBox: '0 0 ' + W2 + ' ' + H2, class: 'lab-svg', role: 'img', 'aria-label': 'Time to deliver data to every client, one at a time or together' });
			var sc = 700 / Math.max(seqTime, togTime);
			[['One client at a time (OFDM)', seqTime, 'is-bad', 'one at a time'], ['All clients at once (OFDMA)', togTime, 'is-good', 'together']].forEach(function (b, i) {
				var y = 14 + i * 50; s2.append(svg('rect', { x: 130, y: y, width: Math.max(3, b[1] * sc), height: 32, rx: 5, class: 'lab-bar ' + b[2], style: 'opacity:.8' }));
				text(s2, 124, y + 20, i ? 'OFDMA' : 'One by one', 'lab-tick lab-tick--f', 'end'); text(s2, 136 + b[1] * sc, y + 21, fmt(b[1], 0) + ' µs', 'lab-tick lab-tick--f');
			});
			stage2.replaceChildren(s2);
			roU.set(String(nu)); roR.set(fmt(ruRate(firstRU), 1) + ' Mbit/s'); var saved = (1 - togTime / seqTime) * 100; roT.set(fmt(saved, 0) + '%', saved > 0 ? 'good' : 'warn');
			note.textContent = 'In 802.11ax a transmission can be shared between clients: the channel is split into resource units (RUs) of 26, 52, 106, 242 or 484 tones (the widths in the chart), each carrying 24, 48, 102, 234 or 468 data subcarriers. The rate of one RU is data subcarriers x bits per subcarrier x coding rate / 13.6 microseconds (12.8 microsecond symbol plus 0.8 microsecond guard interval), here for one spatial stream. The comparison below uses a fixed cost per transmission (waiting for the channel, preamble, acknowledgement); the figure is yours to change, so treat the saving as an illustration of why OFDMA helps most with many small packets. Every client uses a narrower slice, so each one gets a lower rate than it would with the whole channel, but nobody waits for a turn.';
		}
		draw();
	};

	/* =====================================================================
	 * MIMO: beamforming array and spatial streams
	 * ===================================================================== */
	window.WifiLabModels.mimo = function (root) {
		var st = { n: 4, steer: 20, nt: 4, nr: 2, gen: 'ax' };
		var CAP = { n: ['802.11n (Wi-Fi 4)', 4], ac: ['802.11ac (Wi-Fi 5)', 8], ax: ['802.11ax (Wi-Fi 6)', 8], be: ['802.11be (Wi-Fi 7)', 16] };
		var panelA = el('div', { class: 'lab-panel' }), panelB = el('div', { class: 'lab-panel' });
		var stageA = el('div', { class: 'lab-stage' });
		var roG = readout('', 'array gain at the beam peak (same total power)', 'good'), roBW = readout('', 'half-power beamwidth'), roA = readout('', 'steered to');
		panelA.append(el('h3', { class: 'lab-rules__t', text: 'A. Beamforming: steering a beam with several antennas' }), el('div', { class: 'lab-controls' }, [
			slider('Antennas in the array', 1, 8, 1, st.n, function (v) { return String(v); }, function (v) { st.n = v; drawA(); }),
			slider('Steer the beam to', -60, 60, 5, st.steer, function (v) { return v + '°'; }, function (v) { st.steer = v; drawA(); })]), stageA, el('div', { class: 'lab-reads' }, [roG, roBW, roA]));
		var noteA = el('p', { class: 'lab-note' }); panelA.append(noteA);
		function af(phi, phi0, n) { var psi = Math.PI * (Math.sin(phi) - Math.sin(phi0)); var d = n * Math.sin(psi / 2); if (Math.abs(d) < 1e-9) { return 1; } var v = Math.sin(n * psi / 2) / d; return v * v; }
		function drawA() {
			var W = 640, H = 300, cx = 320, cy = 270, R = 230, phi0 = st.steer * Math.PI / 180;
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Beam pattern of ' + st.n + ' antennas steered to ' + st.steer + ' degrees' });
			[0.25, 0.5, 1].forEach(function (r) { var p = ''; for (var k = -90; k <= 90; k += 3) { var a = k * Math.PI / 180; p += (k === -90 ? 'M' : 'L') + (cx + R * Math.sqrt(r) * Math.sin(a)).toFixed(1) + ' ' + (cy - R * Math.sqrt(r) * Math.cos(a)).toFixed(1); } s.append(svg('path', { d: p, fill: 'none', class: 'lab-axis', 'stroke-dasharray': '3 5', opacity: .6 })); });
			var d = 'M' + cx + ' ' + cy;
			for (var k = -90; k <= 90; k += 0.5) { var a = k * Math.PI / 180, p = af(a, phi0, st.n), r2 = R * Math.sqrt(p); d += 'L' + (cx + r2 * Math.sin(a)).toFixed(1) + ' ' + (cy - r2 * Math.cos(a)).toFixed(1); }
			s.append(svg('path', { d: d + 'Z', class: 'lab-ov-bell is-sel', style: 'cursor:default' }));
			for (var i = 0; i < st.n; i++) { s.append(svg('circle', { cx: cx + (i - (st.n - 1) / 2) * 22, cy: cy + 8, r: 6, fill: 'currentColor' })); }
			text(s, 6, 20, 'Top view: the antennas sit along the bottom, the beam points away from them', 'lab-tick lab-tick--f');
			stageA.replaceChildren(s);
			var lo = st.steer, hi = st.steer, a0 = phi0; while (lo > -90 && af(lo * Math.PI / 180, a0, st.n) >= 0.5) { lo -= 0.25; } while (hi < 90 && af(hi * Math.PI / 180, a0, st.n) >= 0.5) { hi += 0.25; }
			roG.set('+' + fmt(10 * Math.log10(st.n), 1) + ' dB'); roBW.set(st.n === 1 ? 'all round' : fmt(hi - lo, 0) + '°'); roA.set(st.steer + '°');
			noteA.textContent = 'Each antenna sends the same signal with a slightly different delay (phase). In the steered direction the waves add up; elsewhere they partly cancel, which is the interference idea from Foundations used on purpose. With N antennas and the same total power, the beam peak is 10 log10(N) dB stronger than a single antenna, and the beam gets narrower as N grows. The antennas here are spaced half a wavelength apart, and the beam widens when it is steered away from straight ahead.';
		}
		// B: spatial streams
		var stageB = el('div', { class: 'lab-stage' });
		var roS = readout('', 'spatial streams the link can use', 'good'), roM = readout('', 'speed compared with one stream'), roX = readout('', 'limit set by');
		var genSel = seg('Wi-Fi generation', Object.keys(CAP).map(function (k) { return [k, CAP[k][0]]; }), st.gen, function (v) { st.gen = v; drawB(); });
		panelB.append(el('h3', { class: 'lab-rules__t', text: 'B. Spatial multiplexing: how many streams?' }), el('div', { class: 'lab-controls' }, [ctl('Generation', genSel),
			slider('Antennas on the access point', 1, 8, 1, st.nt, function (v) { return String(v); }, function (v) { st.nt = v; drawB(); }),
			slider('Antennas on the client', 1, 4, 1, st.nr, function (v) { return String(v); }, function (v) { st.nr = v; drawB(); })]), stageB, el('div', { class: 'lab-reads' }, [roS, roM, roX]));
		var noteB = el('p', { class: 'lab-note' }); panelB.append(noteB);
		function drawB() {
			var cap = CAP[st.gen][1], ns = Math.min(st.nt, st.nr, cap), W = 1000, H = 130, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': ns + ' spatial streams' });
			for (var i = 0; i < Math.max(ns, 1); i++) { var y = 18 + i * Math.min(14, 100 / Math.max(ns, 1)); s.append(svg('rect', { x: 140, y: y, width: 720, height: Math.min(11, 90 / Math.max(ns, 1)), rx: 3, class: 'lab-bar is-good', style: 'opacity:.7' })); }
			text(s, 130, 60, ns + (ns === 1 ? ' stream' : ' streams'), 'lab-tick lab-tick--f', 'end'); text(s, 870, 60, '× ' + ns + ' speed', 'lab-tick lab-tick--f');
			stageB.replaceChildren(s);
			roS.set(String(ns)); roM.set(ns + ' x'); roX.set(ns === cap ? 'the generation (' + cap + ' at most)' : (st.nr === st.nt ? 'both antenna counts' : (st.nr < st.nt ? 'the client antennas' : 'the access point antennas')));
			noteB.textContent = 'With spatial multiplexing the transmitter sends several independent data streams at once on the same frequencies; the receiver separates them because each antenna sees a different mix. The number of streams is limited by the smaller of the antenna counts and by the generation (802.11n up to 4 streams, 802.11ac and 802.11ax up to 8, 802.11be up to 16). A typical phone has two antennas, so a 4x4 access point serves it with two streams, and the extra antennas are used to serve other clients or to improve the signal. Multi-user MIMO lets an access point send different streams to different clients at the same moment (downlink in 802.11ac, and both directions in 802.11ax). The reference rates: one 802.11n 20 MHz stream at MCS 7 is 65 Mbit/s; one 802.11ac 80 MHz stream at MCS 9 is 390 Mbit/s with the standard 0.8 microsecond guard interval.';
		}
		root.append(panelA, panelB);
		drawA(); drawB();
	};
})();
