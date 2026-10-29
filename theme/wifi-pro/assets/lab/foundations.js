/* Wi-Fi Pro Lab: foundations (waves, superposition, decibels).
 * Every number is defined by a formula stated on the page:
 *   wavelength = c / f with c = 299 792 458 m/s (exact, by the definition of the metre);
 *   period = 1 / f; dB = 10 log10(P2 / P1) for power and 20 log10(A2 / A1) for amplitude; dBm = 10 log10(P / 1 mW);
 *   sum of two sine waves of amplitudes A1, A2 and phase difference d: A = sqrt(A1^2 + A2^2 + 2 A1 A2 cos d).
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
		var wrap = el('label', { class: 'lab-ctl lab-ctl--range' }, [el('span', { class: 'lab-ctl__t' }, [document.createTextNode(label + ': '), out]), inp]);
		wrap.set = function (v) { inp.value = v; out.textContent = fmtv(Number(v)); };
		return wrap;
	}
	function fmtFreq(hz) { return hz >= 1e9 ? fmt(hz / 1e9, hz >= 1e10 ? 1 : 3) + ' GHz' : fmt(hz / 1e6, hz >= 1e8 ? 0 : 1) + ' MHz'; }
	function fmtLen(m) { return m >= 1 ? fmt(m, 2) + ' m' : (m >= 0.01 ? fmt(m * 100, 1) + ' cm' : fmt(m * 1000, 1) + ' mm'); }
	function fmtTime(s) { return s >= 1e-6 ? fmt(s * 1e6, 2) + ' µs' : (s >= 1e-9 ? fmt(s * 1e9, 2) + ' ns' : fmt(s * 1e12, 1) + ' ps'); }
	function fmtPower(mw) {
		var v = Math.abs(mw);
		if (v >= 1000) { return fmt(mw / 1000, 3) + ' W'; }
		if (v >= 1) { return fmt(mw, 3) + ' mW'; }
		if (v >= 1e-3) { return fmt(mw * 1e3, 3) + ' µW'; }
		if (v >= 1e-6) { return fmt(mw * 1e6, 3) + ' nW'; }
		return fmt(mw * 1e9, 3) + ' pW';
	}
	function fmtTimes(x) { return x >= 100 ? fmt(x, 0) : (x >= 1 ? fmt(x, 2) : (x >= 0.01 ? fmt(x, 3) : x.toExponential(2))); }

	/* =====================================================================
	 * Wave basics: frequency, wavelength, period, amplitude, phase
	 * ===================================================================== */
	window.WifiLabModels.wavebasics = function (root) {
		var PRE = [['FM radio, 100 MHz', 100e6], ['2.4 GHz, channel 6 (2437 MHz)', 2437e6], ['5 GHz, channel 100 (5500 MHz)', 5500e6], ['6 GHz, channel 37 (6135 MHz)', 6135e6]];
		var st = { f: 2437e6, a: 8, ph: 0 };
		function toSlider(f) { return Math.round((Math.log10(f) - 6) / 4.5 * 1000); }
		function fromSlider(v) { return Math.pow(10, 6 + v / 1000 * 4.5); }
		var sf = slider('Frequency', 0, 1000, 1, toSlider(st.f), function (v) { return fmtFreq(fromSlider(v)); }, function (v) { st.f = fromSlider(v); draw(); });
		var sa = slider('Amplitude', 1, 10, 1, st.a, function (v) { return String(v); }, function (v) { st.a = v; draw(); });
		var sp = slider('Phase', 0, 360, 5, st.ph, function (v) { return v + '°'; }, function (v) { st.ph = v; draw(); });
		var pre = seg('Example frequencies', PRE.map(function (p, i) { return [i, p[0]]; }), 1, function (v) { st.f = PRE[v][1]; sf.set(toSlider(st.f)); draw(); });
		var controls = el('div', { class: 'lab-controls' }, [el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Try a real frequency' }), pre]), sf, sa, sp]);
		var stage = el('div', { class: 'lab-stage' });
		var roLam = readout('', 'wavelength (c / f)'), roT = readout('', 'period (1 / f)'), roHalf = readout('', 'half a wavelength'), roN = readout('', 'wavelengths in one metre');
		var roP = readout('', 'power, compared with amplitude 1');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roLam, roT, roHalf, roN, roP]), note);
		function draw() {
			Array.prototype.forEach.call(pre.children, function (b) { b.setAttribute('aria-pressed', 'false'); });
			PRE.forEach(function (p, i) { if (Math.abs(p[1] - st.f) / p[1] < 0.004) { pre.children[i].setAttribute('aria-pressed', 'true'); } });
			var lam = C / st.f, T = 1 / st.f;
			var W = 1000, H = 300, x0 = 40, x1 = 960, yc = 135, amp = st.a / 10 * 100;
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'A sine wave over three wavelengths. One wavelength is ' + fmtLen(lam) + '.' });
			s.append(svg('line', { x1: x0, y1: yc, x2: x1, y2: yc, class: 'lab-axis' }));
			var span = 3, px = (x1 - x0) / (span * lam), d = '';
			for (var i = 0; i <= 600; i++) { var x = i / 600 * span * lam; var y = yc - amp * Math.sin(TAU * x / lam + st.ph / 360 * TAU); d += (i ? 'L' : 'M') + (x0 + x * px).toFixed(1) + ' ' + y.toFixed(1); }
			s.append(svg('path', { d: d, class: 'lab-wave is-on' }));
			// amplitude marker and wavelength marker
			s.append(svg('line', { x1: x0 - 12, y1: yc - amp, x2: x0 - 12, y2: yc, class: 'lab-ov-edge' }));
			text(s, x0 - 16, yc - amp / 2 + 4, 'A', 'lab-tick lab-tick--f', 'end');
			var ly = yc + 138;
			s.append(svg('line', { x1: x0, y1: ly, x2: x0 + lam * px, y2: ly, class: 'lab-axis', 'stroke-width': 3 }));
			s.append(svg('line', { x1: x0, y1: ly - 7, x2: x0, y2: ly + 7, class: 'lab-axis' })); s.append(svg('line', { x1: x0 + lam * px, y1: ly - 7, x2: x0 + lam * px, y2: ly + 7, class: 'lab-axis' }));
			text(s, x0 + lam * px / 2, ly - 10, 'one wavelength = ' + fmtLen(lam), 'lab-tick lab-tick--f', 'middle');
			for (var k = 0; k <= span; k++) { var tx = x0 + k * lam * px; s.append(svg('line', { x1: tx, y1: yc + 112, x2: tx, y2: yc + 120, class: 'lab-axis' })); text(s, tx, yc + 112 + 22 + 8, fmtLen(k * lam), 'lab-tick', k === 0 ? 'start' : (k === span ? 'end' : 'middle')); }
			stage.replaceChildren(s);
			roLam.set(fmtLen(lam)); roT.set(fmtTime(T)); roHalf.set(fmtLen(lam / 2)); roN.set(fmt(1 / lam, 1)); roP.set(fmt(st.a * st.a, 0) + ' times');
			note.textContent = 'Frequency is how many cycles happen each second; the period is the time one cycle takes. The wave moves at the speed of light, 299 792 458 m/s, so the distance it covers during one cycle is the wavelength: wavelength = c / f. Double the frequency and the wavelength halves. Amplitude is the height of the wave; power grows with its square, so twice the amplitude is four times the power. Phase is how far along its cycle the wave is at a given point, in degrees; 360 degrees is one full cycle.';
		}
		draw();
	};

	/* =====================================================================
	 * Superposition: a direct wave plus an echo
	 * ===================================================================== */
	window.WifiLabModels.superpos = function (root) {
		var FREQS = [['2.4 GHz (2437 MHz)', 2437e6], ['5 GHz (5500 MHz)', 5500e6], ['6 GHz (6135 MHz)', 6135e6]];
		var st = { fi: 0, echo: 80, d: 0 };
		var sel = seg('Frequency', FREQS.map(function (p, i) { return [i, p[0]]; }), 0, function (v) { st.fi = Number(v); draw(); });
		var sd = slider('Extra distance the echo travels', 0, 30, 0.5, st.d, function (v) { return fmt(v, 1) + ' cm'; }, function (v) { st.d = v; draw(); });
		var se = slider('Echo strength (share of the direct wave)', 0, 100, 5, st.echo, function (v) { return v + '%'; }, function (v) { st.echo = v; draw(); });
		var controls = el('div', { class: 'lab-controls' }, [el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Frequency' }), sel]), sd, se]);
		var stage = el('div', { class: 'lab-stage' });
		var roPh = readout('', 'phase difference'), roAmp = readout('', 'combined amplitude (direct wave = 1)'), roDb = readout('', 'power change against the direct wave alone');
		var verdict = el('p', { class: 'lab-verdict', 'aria-live': 'polite' });
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, verdict, el('div', { class: 'lab-reads' }, [roPh, roAmp, roDb]), note);
		function draw() {
			var f = FREQS[st.fi][1], lam = C / f, dphi = (st.d / 100 / lam) * 360, dmod = dphi % 360, g = st.echo / 100;
			var a = Math.sqrt(1 + g * g + 2 * g * Math.cos(dphi / 360 * TAU)), db = 20 * Math.log10(Math.max(a, 1e-4));
			var W = 1000, H = 330, x0 = 40, x1 = 960, yc = 165, amp = 60;
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'A direct wave, its echo and their sum over two cycles. The sum has amplitude ' + fmt(a, 2) + ' times the direct wave.' });
			s.append(svg('line', { x1: x0, y1: yc, x2: x1, y2: yc, class: 'lab-axis' }));
			function trace(fn, cls) { var d = ''; for (var i = 0; i <= 400; i++) { var t = i / 400 * 2; d += (i ? 'L' : 'M') + (x0 + i / 400 * (x1 - x0)).toFixed(1) + ' ' + (yc - amp * fn(t)).toFixed(1); } s.append(svg('path', { d: d, class: 'lab-trace ' + cls })); }
			trace(function (t) { return Math.sin(TAU * t); }, 'is-a');
			trace(function (t) { return g * Math.sin(TAU * t - dphi / 360 * TAU); }, 'is-b');
			trace(function (t) { return Math.sin(TAU * t) + g * Math.sin(TAU * t - dphi / 360 * TAU); }, 'is-sum');
			var lg = [['Direct wave', 'is-a'], ['Echo (delayed copy)', 'is-b'], ['What the receiver sees: the sum', 'is-sum']];
			lg.forEach(function (l, i) { s.append(svg('line', { x1: 50 + i * 290, y1: 24, x2: 80 + i * 290, y2: 24, class: 'lab-trace ' + l[1] })); text(s, 88 + i * 290, 28, l[0], 'lab-tick lab-tick--f'); });
			text(s, x1, H - 8, 'time: two cycles', 'lab-tick', 'end');
			stage.replaceChildren(s);
			roPh.set(fmt(dmod, 0) + '°', ''); roAmp.set(fmt(a, 2), a >= 1 ? 'good' : 'bad'); roDb.set((db >= 0 ? '+' : '') + fmt(db, 1) + ' dB', db >= 0 ? 'good' : (db > -6 ? 'warn' : 'bad'));
			var lo = Math.abs(1 - g), hi = 1 + g, t = g === 0 ? 1 : (a - lo) / (hi - lo);
			if (g === 0) { verdict.textContent = 'No echo, so nothing to add: the receiver sees the direct wave unchanged.'; }
			else if (t > 0.8) { verdict.textContent = 'Nearly in step (constructive): the waves reinforce each other and the signal is stronger.'; }
			else if (t < 0.2) { verdict.textContent = g > 0.95 ? 'Nearly opposite (destructive): the waves cancel almost completely. This is a fade, or a null.' : 'Nearly opposite (destructive): the echo cancels part of the direct wave, so the signal is weaker.'; }
			else { verdict.textContent = 'Partly in step: the signal is somewhere between the strongest and the weakest it could be.'; }
			note.textContent = 'At ' + FREQS[st.fi][0].split(' (')[0] + ' one wavelength is ' + fmtLen(lam) + ', so an echo that travels ' + fmt(lam * 100 / 2, 1) + ' cm further than the direct wave arrives half a cycle (180 degrees) behind. Phase difference = 360 x extra distance / wavelength. Add the two waves point by point and the result is a wave whose amplitude is sqrt(1 + g^2 + 2g cos(difference)), where g is the echo strength. Move the receiver by a few centimetres and the sum swings between its strongest and weakest values: that is multipath fading.';
		}
		draw();
	};

	/* =====================================================================
	 * Decibels: dBm, ratios and a short chain
	 * ===================================================================== */
	window.WifiLabModels.decibels = function (root) {
		var st = { dbm: 20, db: 3, tx: 15, cable: 2, gain: 5 };
		// 1. dBm <-> power
		var s1 = slider('Power level', -100, 36, 1, st.dbm, function (v) { return (v > 0 ? '+' : '') + v + ' dBm'; }, function (v) { st.dbm = v; draw1(); });
		var r1 = readout('', 'the same power', 'good'), r1b = readout('', 'as a plain number of milliwatts');
		var n1 = el('p', { class: 'lab-note' });
		var p1 = el('div', { class: 'lab-panel' }, [el('h3', { class: 'lab-rules__t', text: 'A. dBm: power on a log scale' }), el('div', { class: 'lab-controls' }, [s1]), el('div', { class: 'lab-reads' }, [r1, r1b]), n1]);
		function draw1() {
			var mw = Math.pow(10, st.dbm / 10);
			r1.set(fmtPower(mw)); r1b.set(mw >= 1e-3 ? fmt(mw, mw >= 100 ? 0 : 3) + ' mW' : mw.toExponential(2) + ' mW');
			var ref = { 0: '0 dBm is exactly 1 mW: the reference all dBm values are measured against.', 20: '20 dBm is 100 mW, the 2.4 GHz EIRP limit in the UK and the EU.', 30: '30 dBm is 1 W.', '-30': '-30 dBm is one millionth of a watt (1 µW).', '-90': '-90 dBm is one trillionth of a watt (1 pW): a very weak Wi-Fi signal.' };
			n1.textContent = ref[String(st.dbm)] || 'dBm = 10 x log10(power in mW). Every +10 dBm is ten times the power; every +3 dBm roughly doubles it.';
		}
		// 2. dB <-> ratio
		var s2 = slider('Gain or loss', -30, 30, 1, st.db, function (v) { return (v > 0 ? '+' : '') + v + ' dB'; }, function (v) { st.db = v; draw2(); });
		var r2 = readout('', 'power is multiplied by', 'good'), r2b = readout('', 'amplitude (voltage) is multiplied by');
		var n2 = el('p', { class: 'lab-note' });
		var p2 = el('div', { class: 'lab-panel' }, [el('h3', { class: 'lab-rules__t', text: 'B. dB: a ratio between two powers' }), el('div', { class: 'lab-controls' }, [s2]), el('div', { class: 'lab-reads' }, [r2, r2b]), n2]);
		function draw2() {
			var pr = Math.pow(10, st.db / 10), ar = Math.pow(10, st.db / 20);
			r2.set(fmtTimes(pr) + ' x', st.db >= 0 ? 'good' : 'warn'); r2b.set(fmtTimes(ar) + ' x');
			n2.textContent = 'dB = 10 x log10(power ratio) = 20 x log10(amplitude ratio). Rules worth remembering: +3 dB is about twice the power (1.995 x), +6 dB is about four times, +10 dB is ten times, +20 dB is a hundred times, and a negative number is the same thing in reverse (-3 dB is about half, -10 dB is a tenth). Because dB is a ratio, adding decibels multiplies the ratios.';
		}
		// 3. a chain
		var s3 = slider('Transmitter power', 0, 30, 1, st.tx, function (v) { return v + ' dBm'; }, function (v) { st.tx = v; draw3(); });
		var s4 = slider('Cable loss', 0, 10, 0.5, st.cable, function (v) { return '-' + fmt(v, 1) + ' dB'; }, function (v) { st.cable = v; draw3(); });
		var s5 = slider('Antenna gain', 0, 12, 0.5, st.gain, function (v) { return '+' + fmt(v, 1) + ' dBi'; }, function (v) { st.gain = v; draw3(); });
		var stage3 = el('div', { class: 'lab-stage' });
		var r3 = readout('', 'power radiated (EIRP)', ''), r3b = readout('', 'as a plain number');
		var n3 = el('p', { class: 'lab-note' });
		var p3 = el('div', { class: 'lab-panel' }, [el('h3', { class: 'lab-rules__t', text: 'C. Adding decibels along a chain' }), el('div', { class: 'lab-controls' }, [s3, s4, s5]), stage3, el('div', { class: 'lab-reads' }, [r3, r3b]), n3]);
		function draw3() {
			var eirp = st.tx - st.cable + st.gain, mw = Math.pow(10, eirp / 10), limit = 20;
			var W = 1000, H = 150, x0 = 60, x1 = 940, lo = -10, hi = 50;
			function x(v) { return x0 + (v - lo) / (hi - lo) * (x1 - x0); }
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Transmitter ' + st.tx + ' dBm, minus ' + st.cable + ' dB cable, plus ' + st.gain + ' dBi antenna gives ' + fmt(eirp, 1) + ' dBm EIRP.' });
			s.append(svg('line', { x1: x0, y1: 100, x2: x1, y2: 100, class: 'lab-axis' }));
			for (var v = lo; v <= hi; v += 10) { s.append(svg('line', { x1: x(v), y1: 96, x2: x(v), y2: 106, class: 'lab-axis' })); text(s, x(v), 126, (v > 0 ? '+' : '') + v, 'lab-tick', 'middle'); }
			text(s, x1, 144, 'dBm', 'lab-tick', 'end');
			var steps = [[st.tx, 'is-good', 'Transmitter ' + st.tx + ' dBm'], [st.tx - st.cable, 'is-warn', 'After cable ' + fmt(st.tx - st.cable, 1)], [eirp, 'is-good', 'After antenna ' + fmt(eirp, 1)]];
			steps.forEach(function (stp, i) { s.append(svg('rect', { x: x0, y: 14 + i * 24, width: Math.max(2, x(Math.max(stp[0], lo)) - x0), height: 18, rx: 4, class: 'lab-bar ' + stp[1], style: 'opacity:' + (i === 2 ? .95 : .55) })); text(s, Math.max(x(Math.max(stp[0], lo)), x(limit)) + 10, 28 + i * 24, stp[2], 'lab-tick lab-tick--f'); });
			s.append(svg('line', { x1: x(limit), y1: 6, x2: x(limit), y2: 110, class: 'lab-ov-edge' })); text(s, x(limit) + 6, 112, '20 dBm = 100 mW', 'lab-tick');
			stage3.replaceChildren(s);
			r3.set((eirp > 0 ? '+' : '') + fmt(eirp, 1) + ' dBm', eirp > limit ? 'bad' : 'good'); r3b.set(fmtPower(mw));
			n3.textContent = 'Radiated power (EIRP) = transmitter power - cable loss + antenna gain, all in dB, so you simply add and subtract. Antenna gain in dBi is measured against an ideal antenna that radiates equally in every direction (an isotropic radiator, hence the i); an antenna does not create power, it concentrates it. The dashed line marks 20 dBm (100 mW), the 2.4 GHz EIRP limit in the UK and the EU. The US sets its limits differently, so never reuse a number across regions.';
		}
		root.append(p1, p2, p3);
		draw1(); draw2(); draw3();
	};
})();
