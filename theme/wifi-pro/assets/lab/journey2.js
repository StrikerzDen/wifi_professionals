/* Wi-Fi Pro Lab: "Watch it happen" stories, part two: QAM, OFDMA and MIMO.
 * Uses the player and helpers from journey.js (window.WifiLabJourney).
 * QAM: 16-QAM with Gray coding as in IEEE Std 802.11-2020 Table 17-14 (levels -3 -1 +1 +3, scaled by 1/sqrt(10), Table 17-11).
 * OFDMA and MIMO come from the 802.11ax and 802.11n/ac amendments, not from the 2020 base text, and the numbers in them are
 * illustrations of the idea (labelled as such on screen), not measurements.
 */
(function () {
	'use strict';
	var J = window.WifiLabJourney;
	if (!J) { return; }
	window.WifiLabModels = window.WifiLabModels || {};
	var T = J.T, ease = J.ease, prog = J.prog, svg = window.WifiLab.svg;

	/* =====================================================================
	 * QAM: 4 bits pick one dot of 16
	 * ===================================================================== */
	var LVL = { '00': -3, '01': -1, '11': 1, '10': 3 };
	function snap(v) { return v < -2 ? -3 : v < 0 ? -1 : v < 2 ? 1 : 3; }
	function lvBits(l) { return l === -3 ? [0, 0] : l === -1 ? [0, 1] : l === 1 ? [1, 1] : [1, 0]; }
	function qamCompute(ctx) {
		var b = ctx.bits, I = LVL['' + b[0] + b[1]], Q = LVL['' + b[2] + b[3]], sg = ctx.p.noise / 100, r = J.rng(ctx.seed), i;
		var rx = [I + sg * J.gauss(r), Q + sg * J.gauss(r)], cloud = [], rc = J.rng(ctx.seed + 7);
		for (i = 0; i < 45; i++) { cloud.push([I + sg * J.gauss(rc), Q + sg * J.gauss(rc)]); }
		var dI = snap(rx[0]), dQ = snap(rx[1]);
		return { I: I, Q: Q, rx: rx, cloud: cloud, dI: dI, dQ: dQ, rec: lvBits(dI).concat(lvBits(dQ)), sg: sg };
	}
	function qmap(s, cx, cy, sp, labels, fade) {
		var gl = [-3, -1, 1, 3], k;
		J.line(s, cx - 4.3 * sp, cy, cx + 4.3 * sp, cy, 'j-axis'); J.line(s, cx, cy - 4.3 * sp, cx, cy + 4.3 * sp, 'j-axis');
		gl.forEach(function (q) {
			gl.forEach(function (i) {
				J.circle(s, cx + i * sp, cy - q * sp, Math.max(4, sp * 0.26), 'j-dot j-dot--map').setAttribute('opacity', fade === undefined ? 1 : fade);
				if (labels) { var a = lvBits(i).concat(lvBits(q)).join(''); T(s, cx + i * sp, cy - q * sp + sp * 0.62, a, 'j-t--s j-t--tiny', 'middle'); }
			});
		});
		return function (v, w) { return [cx + v * sp, cy - w * sp]; };
	}
	var QAM_STORY = {
		title: 'Follow four bits as they become one dot',
		bits: [1, 0, 1, 1], reseed: true,
		sliders: [{ key: 'noise', label: 'Noise on the air', min: 0, max: 120, step: 5, val: 40, unit: '%' }],
		compute: qamCompute,
		scenes: [
			{ title: 'Your message', say: 'Here is your message: four **bits**. Watch how all four travel together as just **one dot**.',
				pro: 'In Wi-Fi every symbol carries a fixed number of bits: 1 for BPSK, 2 for QPSK, 4 for 16-QAM, up to 12 for 4096-QAM.',
				draw: function (s, d, t, c) { T(s, 500, 70, 'Your message', 'j-t--b', 'middle'); J.bitBoxes(s, c.bits, 500, 110, 110, 24, t * (c.bits.length + 0.6), null); T(s, 500, 300, 'four bits, one dot', 'j-t--b j-t--a', 'middle'); } },
			{ title: 'Pick a spot on the map', say: 'Think of a **map** with 16 spots. Every spot has its own four-bit address. The first two bits pick the column and the last two bits pick the row. Your message lands on one spot.',
				pro: '16-QAM with Gray coding: spots next to each other differ by only one bit, so a small mistake costs only one wrong bit (IEEE Std 802.11-2020, Table 17-14). The spots are scaled by 1 over the square root of 10 so the average power stays the same (Table 17-11).',
				draw: function (s, d, t, c) {
					var cx = 330, cy = 195, sp = 44, a1 = prog(t, 0.15, 0.4), a2 = prog(t, 0.45, 0.7), a3 = prog(t, 0.75, 1);
					if (a1 > 0) { J.rect(s, cx + d.I * sp - sp, cy - 4.3 * sp, 2 * sp, 8.6 * sp, 'j-zone j-zone--sym', 4).setAttribute('opacity', a1); }
					if (a2 > 0) { J.rect(s, cx - 4.3 * sp, cy - d.Q * sp - sp, 8.6 * sp, 2 * sp, 'j-zone j-zone--guard', 4).setAttribute('opacity', a2); }
					var P = qmap(s, cx, cy, sp, true);
					if (a3 > 0) { var p = P(d.I, d.Q); J.circle(s, p[0], p[1], 13 + 12 * (1 - a3), 'j-dot j-dot--mine'); }
					T(s, 600, 96, 'First two bits  ' + c.bits[0] + ' ' + c.bits[1], 'j-t--b j-t--brand'); T(s, 600, 128, '→ this column', 'j-t--s');
					T(s, 600, 200, 'Last two bits  ' + c.bits[2] + ' ' + c.bits[3], 'j-t--b j-t--a'); T(s, 600, 232, '→ this row', 'j-t--s');
					if (a3 > 0.5) { T(s, 600, 310, 'Your spot', 'j-t--b'); T(s, 600, 342, 'is where they cross', 'j-t--s'); }
				} },
			{ title: 'A spot is a wave', say: 'A spot cannot fly through the air, so we turn it into a wave. How **far** the spot is from the middle sets how loud the wave is. Which **direction** it lies in sets when the wave starts, a little earlier or later.',
				pro: 'The horizontal position is the in-phase part (I) and the vertical position is the quadrature part (Q) of the carrier. Loudness is the length of the line from the middle; the timing shift is its angle.',
				draw: function (s, d, t) {
					var cx = 170, cy = 195, sp = 26, P = qmap(s, cx, cy, sp, false, 0.55), p = P(d.I, d.Q), f = ease(t);
					J.arrow(s, cx, cy, cx + (p[0] - cx) * f, cy + (p[1] - cy) * f, 'j-axis j-axis--b'); J.circle(s, p[0], p[1], 8, 'j-dot j-dot--mine');
					var r = Math.sqrt(d.I * d.I + d.Q * d.Q), phi = Math.atan2(d.Q, d.I), amp = 26 * r / Math.SQRT2, x0 = 380, x1 = 960, ym = 215, pts = [], ref = [], n = 140, k;
					for (k = 0; k < n; k++) { var u = k / (n - 1); pts.push(amp * Math.cos(2 * Math.PI * 2 * u + phi)); ref.push(26 * Math.cos(2 * Math.PI * 2 * u)); }
					J.line(s, x0, ym, x1, ym, 'j-grid');
					J.path(s, J.linepath(ref, x0, x1, ym, 1, 1), 'j-line--m'); T(s, x0, 70, 'a reference wave (grey)', 'j-t--s');
					J.path(s, J.linepath(pts, x0, x1, ym, 1, f), 'j-line--b'); T(s, x0, 98, 'your spot as a wave (orange)', 'j-t--a');
					T(s, x0, 340, 'loudness ' + (r / Math.SQRT2).toFixed(1) + ' times the quietest spots,  shifted by ' + Math.round(phi * 180 / Math.PI) + '°', 'j-t--s');
				} },
			{ title: 'Noise nudges the dot', say: 'Noise nudges the wave, so the spot that arrives is **not exactly** where we sent it. Send the same spot again and again and the arrivals make a little cloud around it.',
				pro: 'The cloud is the noise. Its size follows the signal-to-noise ratio: more noise, a bigger cloud. The bright dot is this one transmission.',
				draw: function (s, d, t) {
					var cx = 330, cy = 195, sp = 44, P = qmap(s, cx, cy, sp, false);
					d.cloud.forEach(function (q, k) { if (prog(t, 0.1, 0.9) * 45 > k) { var p = P(Math.max(-4.4, Math.min(4.4, q[0])), Math.max(-4.4, Math.min(4.4, q[1]))); J.circle(s, p[0], p[1], 4, 'j-dot j-dot--cloud'); } });
					var a = P(d.I, d.Q); J.circle(s, a[0], a[1], 13, 'j-dot j-dot--sent');
					var f = ease(prog(t, 0.55, 1)), rp = P(Math.max(-4.4, Math.min(4.4, d.rx[0])), Math.max(-4.4, Math.min(4.4, d.rx[1])));
					J.circle(s, a[0] + (rp[0] - a[0]) * f, a[1] + (rp[1] - a[1]) * f, 8, 'j-dot j-dot--mine');
					T(s, 600, 110, 'Orange ring: where we sent it', 'j-t--s'); T(s, 600, 142, 'Faint dots: the same spot, sent many times', 'j-t--s'); T(s, 600, 174, 'Bright dot: what arrived this time', 'j-t--a');
				} },
			{ title: 'Nearest spot wins', say: 'The receiver does something simple: it finds the **nearest spot** on its map. As long as what arrived is still closest to the right spot, nothing is lost. That spot’s address is your four bits.',
				pro: 'This is a hard decision with thresholds at -2, 0 and +2 on each axis, measured in units where neighbouring spots are 2 apart.',
				draw: function (s, d, t, c) {
					var cx = 330, cy = 195, sp = 44, lo = function (l) { return l === -3 ? -4.6 : l - 1; }, hi = function (l) { return l === 3 ? 4.6 : l + 1; };
					var ok = d.dI === d.I && d.dQ === d.Q, cell = prog(t, 0.2, 0.5);
					J.rect(s, cx + lo(d.dI) * sp, cy - hi(d.dQ) * sp, (hi(d.dI) - lo(d.dI)) * sp, (hi(d.dQ) - lo(d.dQ)) * sp, 'j-zone j-zone--' + (ok ? 'sym' : 'bad'), 4).setAttribute('opacity', cell);
					var P = qmap(s, cx, cy, sp, true), rp = P(Math.max(-4.4, Math.min(4.4, d.rx[0])), Math.max(-4.4, Math.min(4.4, d.rx[1]))), dp = P(d.dI, d.dQ), g = ease(prog(t, 0.5, 0.9));
					J.circle(s, rp[0], rp[1], 8, 'j-dot j-dot--mine'); J.arrow(s, rp[0], rp[1], rp[0] + (dp[0] - rp[0]) * g, rp[1] + (dp[1] - rp[1]) * g, 'j-axis j-axis--b');
					if (g > 0.95) { J.circle(s, dp[0], dp[1], 17, 'j-dot j-dot--ring'); T(s, 600, 130, 'Nearest spot', 'j-t--b'); T(s, 600, 172, 'address  ' + d.rec.join(' '), 'j-t--b ' + (ok ? 'j-t--good' : 'j-t--bad')); T(s, 600, 214, ok ? 'the right spot' : 'the wrong spot: noise pushed it over a line', 'j-t--s'); }
				} },
			{ title: 'Your bits back', say: 'Read the address of that spot and you have your four bits back. If the noise is small, the message is **perfect**. Turn the noise up and watch for the moment the dot jumps to the wrong spot.',
				pro: 'With Gray coding a jump to a neighbouring spot flips only one bit, which the error-correcting code can often repair.',
				draw: function (s, d, t, c) {
					var ok = d.rec.every(function (b, k) { return b === c.bits[k]; });
					T(s, 500, 60, 'Received', 'j-t--b', 'middle'); J.bitBoxes(s, d.rec, 500, 90, 110, 24, t * (d.rec.length + 0.6), d.rec.map(function (b, k) { return b === c.bits[k]; }));
					T(s, 500, 260, 'Sent', 'j-t--s', 'middle'); J.bitBoxes(s, c.bits, 500, 276, 50, 14, 5, null);
					if (t > 0.8) { T(s, 500, 366, ok ? 'Same message!' : 'Noise won this time. Turn it down.', 'j-t--b ' + (ok ? 'j-t--good' : 'j-t--bad'), 'middle'); }
				} },
			{ title: 'Why not a bigger map?', dur: 2400,
				say: 'Why not use a huge map? Because the more spots we pack in, the **closer together** they sit. The same noise that is harmless on a small map pushes dots over the line on a big one. That is why Wi-Fi uses small maps far from the router and big maps close to it.',
				pro: '64-QAM is the top of Wi-Fi 4 (and 802.11a and g), 256-QAM came with Wi-Fi 5, 1024-QAM with Wi-Fi 6 and 4096-QAM with Wi-Fi 7. Each step adds 2 bits per symbol but needs a cleaner signal, a higher SNR.',
				draw: function (s, d, t) {
					var orders = [[2, 'QPSK', '2 bits', 'slow and tough'], [4, '16-QAM', '4 bits', ''], [8, '64-QAM', '6 bits', 'Wi-Fi 4'], [16, '256-QAM', '8 bits', 'Wi-Fi 5'], [32, '1024-QAM', '10 bits', 'Wi-Fi 6'], [64, '4096-QAM', '12 bits', 'Wi-Fi 7']];
					orders.forEach(function (o, i) {
						var a = prog(t, i * 0.12, i * 0.12 + 0.4), sz = 140, px = 28 + i * 160, py = 70, m = o[0], dd = '', j, k;
						if (a <= 0) { return; }
						s.append(svg('rect', { x: px, y: py, width: sz, height: sz, rx: 8, class: 'j-box j-box--card', opacity: a }));
						for (j = 0; j < m; j++) { for (k = 0; k < m; k++) { dd += 'M' + (px + (j + 0.5) * sz / m).toFixed(1) + ' ' + (py + (k + 0.5) * sz / m).toFixed(1) + 'h0.01'; } }
						s.append(svg('path', { d: dd, class: 'j-dots', style: 'stroke-width:' + Math.max(1.6, sz / m * 0.5) + 'px', opacity: a }));
						s.append(svg('circle', { cx: px + sz / 2 + sz / m / 2, cy: py + sz / 2 + sz / m / 2, r: 11, class: 'j-noise', opacity: a }));
						T(s, px + sz / 2, 250, o[1], 'j-t--b', 'middle'); T(s, px + sz / 2, 282, o[2] + ' per dot', 'j-t--a', 'middle'); if (o[3]) { T(s, px + sz / 2, 312, o[3], 'j-t--s', 'middle'); }
					});
					T(s, 28, 48, 'The dashed circle is the same amount of noise in every box', 'j-t--s');
				} }
		]
	};
	window.WifiLabModels.journeyqam = J.player(QAM_STORY);

	/* =====================================================================
	 * OFDMA: sharing the lanes between devices
	 * ===================================================================== */
	var DEVICES = [['Laptop', 0], ['Phone', 1], ['Watch', 2], ['Doorbell', 3]];
	var OVER = 2.0, DATA_OLD = 0.5, TRIG = 1.0, DATA_NEW = 1.0, ACK = 0.5;     // illustration units
	function ofdmaCompute(ctx) {
		var n = ctx.p.n, oldT = n * (OVER + DATA_OLD), newT = OVER + TRIG + DATA_NEW + ACK, per = Math.floor(9 / n);
		return { n: n, oldT: oldT, newT: newT, per: per, spare: 9 - per * n, ratio: oldT / newT };
	}
	var OFDMA_STORY = {
		title: 'Follow several devices sharing one Wi-Fi 6 channel',
		segs: [{ key: 'n', label: 'Devices talking at once', options: [[2, '2'], [3, '3'], [4, '4']], val: 4 }],
		compute: ofdmaCompute,
		scenes: [
			{ title: 'Small messages', say: function (d) { return d.n + ' devices each have a small message: a laptop ping, a phone notification, a watch heartbeat, a doorbell chime. Not much data, but everybody wants to talk **right now**.'; },
				pro: 'Small frames are very common on real networks: acknowledgements, chat, voice, and sensor reports.',
				draw: function (s, d, t) { for (var i = 0; i < d.n; i++) { var a = prog(t, i * 0.18, i * 0.18 + 0.4), x = 500 - d.n * 110 + i * 220 + 10; if (a > 0) { J.rect(s, x, 120, 190, 110, 'j-box j-dev j-dev--' + i, 14).setAttribute('opacity', a); T(s, x + 95, 170, DEVICES[i][0], 'j-t--b j-t--onc', 'middle'); T(s, x + 95, 205, 'small message', 'j-t--s j-t--onc', 'middle'); } } T(s, 500, 320, 'everybody wants to send at once', 'j-t--b j-t--a', 'middle'); } },
			{ title: 'The old way', say: function (d) { return 'In the old way, devices take **turns**. Each one waits, grabs the whole channel for a moment, sends its tiny message and gives it back. Most of the channel sits empty while it does, and all that waiting adds up to ' + d.oldT + ' time units.'; },
				pro: 'Every transmission pays a fixed cost: waiting for a free channel (backoff and inter-frame spacing), a preamble, and an acknowledgement. The times on this page are an illustration, not measurements.',
				draw: function (s, d, t) {
					var x0 = 90, u = 85, i, lim = x0 + d.oldT * u * ease(t), cum = 0;
					T(s, 40, 40, 'channel (frequency)', 'j-t--s'); T(s, 40, 374, 'time →', 'j-t--s'); J.line(s, x0, 340, 940, 340, 'j-axis'); J.line(s, x0, 56, x0, 340, 'j-axis');
					for (i = 0; i < d.n; i++) {
						var xo = x0 + cum * u, xd = xo + OVER * u, w1 = Math.max(0, Math.min(lim, xd) - xo), w2 = Math.max(0, Math.min(lim, xd + DATA_OLD * u) - xd);
						if (w1 > 0) { J.rect(s, xo, 70, w1, 270, 'j-wait', 0); if (w1 > 100) { T(s, xo + OVER * u / 2, 210, 'wait + start', 'j-t--s', 'middle'); } }
						if (w2 > 0) { J.rect(s, xd, 70, w2, 270, 'j-box j-dev j-dev--' + i, 0); }
						if (lim > xd + 6) { T(s, xd + DATA_OLD * u / 2, 360, DEVICES[i][0], 'j-t--s', 'middle'); }
						cum += OVER + DATA_OLD;
					}
					if (t > 0.9) { T(s, 940, 60, 'the channel is mostly empty', 'j-t--b j-t--bad', 'end'); }
				} },
			{ title: 'Slice the channel', say: function (d) { return 'OFDMA cuts the channel into **slices**, called resource units. The access point hands each device its own slices' + (d.spare ? ' and keeps ' + d.spare + ' spare' : '') + ', so devices can talk at the very same time, each in its own slice.'; },
				pro: 'In 802.11ax a 20 MHz channel holds up to nine 26-tone resource units. Bigger units of 52, 106, 242, 484 and 996 tones exist for bigger loads and wider channels (IEEE 802.11ax-2021, an amendment that is not in the 2020 base edition).',
				draw: function (s, d, t) {
					var y0 = 60, rh = 30, i, dev;
					T(s, 40, 40, 'a 20 MHz channel cut into 9 slices', 'j-t--s');
					for (i = 0; i < 9; i++) {
						dev = Math.floor(i / d.per); var mine = dev < d.n && i < d.per * d.n, a = prog(t, i / 12, i / 12 + 0.3);
						if (a > 0) { J.rect(s, 150, y0 + i * (rh + 4), 520 * a, rh, mine ? 'j-box j-dev j-dev--' + dev : 'j-box j-spare', 6); }
					}
					for (i = 0; i < d.n; i++) { var yc = y0 + (i * d.per + d.per / 2) * (rh + 4) - 4; T(s, 700, yc + 6, DEVICES[i][0] + ': ' + d.per + ' slices', 'j-t--b j-t--dev' + i); }
					if (d.spare) { T(s, 700, y0 + 9 * (rh + 4) - 34, d.spare + ' spare', 'j-t--s'); }
				} },
			{ title: 'One call to everyone', say: 'The access point waits once, then sends a short **call-out** called a trigger: “you use these slices, you use those”. Everybody answers together, side by side, and one acknowledgement covers them all.',
				pro: 'The trigger frame carries the resource unit assignment for each station. The replies follow a short inter-frame space (SIFS) later, and a multi-station Block Ack confirms them.',
				draw: function (s, d, t) {
					var x0 = 90, u = 180, segs = [['wait', OVER, 'j-wait'], ['trigger', TRIG, 'j-box j-trig'], ['all reply', DATA_NEW, 'j-box j-reply'], ['ack', ACK, 'j-box j-ackb']], x = x0, lim = x0 + d.newT * u * ease(t), i;
					T(s, 40, 40, 'channel (frequency)', 'j-t--s'); T(s, 40, 374, 'time →', 'j-t--s'); J.line(s, x0, 340, 940, 340, 'j-axis'); J.line(s, x0, 56, x0, 340, 'j-axis');
					segs.forEach(function (sg) {
						var w = Math.max(0, Math.min(lim, x + sg[1] * u) - x);
						if (w > 0) {
							if (sg[0] === 'all reply') { var rh = 270 / 9; for (i = 0; i < 9; i++) { var dev = Math.floor(i / d.per), mine = dev < d.n && i < d.per * d.n; J.rect(s, x, 70 + i * rh, w, rh - 2, mine ? 'j-box j-dev j-dev--' + dev : 'j-box j-spare', 0); } }
							else { J.rect(s, x, 70, w, 270, sg[2], 0); }
							if (w > sg[1] * u - 4) { T(s, x + sg[1] * u / 2, 362, sg[0], 'j-t--s', 'middle'); }
						}
						x += sg[1] * u;
					});
					if (t > 0.9) { T(s, 940, 60, 'total: ' + d.newT + ' time units', 'j-t--b j-t--good', 'end'); }
				} },
			{ title: 'The access point sorts them', say: 'The access point hears everything at once, as one mixed wave. The same **FFT** trick that splits the lanes in ordinary OFDM splits this wave back into slices, and every slice belongs to one device.',
				pro: 'Each device transmits only on its own subcarriers, so the receiver separates them with an FFT. The trigger frame also helps devices match the access point’s timing and frequency closely enough for this to work.',
				draw: function (s, d, t) {
					var x0 = 60, x1 = 940, pts = [], k, n = 200, i;
					for (k = 0; k < n; k++) { var u = k / (n - 1), v = 0; for (i = 0; i < d.n; i++) { v += Math.sin(2 * Math.PI * (6 + 5 * i) * u + i); } pts.push(v * 9); }
					T(s, 40, 36, 'what the access point hears', 'j-t--s'); J.path(s, J.linepath(pts, x0, x1, 90, 1, ease(t)), 'j-line--a');
					T(s, 500, 168, 'FFT splits it into slices', 'j-t--b j-t--a', 'middle'); J.arrow(s, 500, 178, 500, 214, 'j-axis j-axis--b');
					for (i = 0; i < d.n; i++) { var a = prog(t, 0.45 + i * 0.1, 0.7 + i * 0.1), w = 840 / d.n, x = 80 + i * w; if (a > 0) { J.rect(s, x, 230, w - 14, 100, 'j-box j-dev j-dev--' + i, 12).setAttribute('opacity', a); T(s, x + (w - 14) / 2, 272, DEVICES[i][0], 'j-t--b j-t--onc', 'middle'); T(s, x + (w - 14) / 2, 306, 'message received', 'j-t--s j-t--onc', 'middle'); } }
				} },
			{ title: 'Add up the waiting', say: function (d) { return 'Add up the waiting. The old way took ' + d.oldT + ' time units; the new way takes ' + d.newT + '. ' + (d.ratio < 1.3 ? 'With only two devices it hardly matters, but with more devices the saving grows.' : 'That is about **' + d.ratio.toFixed(1) + ' times less waiting**, and it grows with every extra device.') + ' That is why Wi-Fi 6 shines in crowded homes, offices and stadiums.'; },
				pro: 'OFDMA improves efficiency and delay for many small transmissions. It does not make one big download faster by itself. Both times are illustrative units, not measurements.',
				draw: function (s, d, t) {
					var u = 80, f = ease(t);
					T(s, 40, 70, 'The old way: one at a time', 'j-t--s'); J.rect(s, 40, 86, d.oldT * u * f, 56, 'j-box j-bar j-bar--off', 8); if (t > 0.5) { T(s, 52 + d.oldT * u * f, 124, d.oldT + ' units', 'j-t--b'); }
					T(s, 40, 210, 'OFDMA: everybody together', 'j-t--s'); J.rect(s, 40, 226, d.newT * u * f, 56, 'j-box j-bar j-bar--on', 8); if (t > 0.5) { T(s, 52 + d.newT * u * f, 264, d.newT + ' units', 'j-t--b j-t--a'); }
					if (t > 0.9) { T(s, 500, 350, d.ratio < 1.3 ? 'Almost no gain with 2 devices' : 'About ' + d.ratio.toFixed(1) + ' times less waiting', 'j-t--b j-t--good', 'middle'); }
				} }
		]
	};
	window.WifiLabModels.journeyofdma = J.player(OFDMA_STORY);

	/* =====================================================================
	 * MIMO: two streams on the same channel, mixed by the air, solved by the receiver
	 * ===================================================================== */
	var HR = [[1.0, 0.45], [-0.35, 0.9]], HF = [[1.0, 0.9], [1.0, 0.9]];
	function mixH(rho) { return [[(1 - rho) * HR[0][0] + rho * HF[0][0], (1 - rho) * HR[0][1] + rho * HF[0][1]], [(1 - rho) * HR[1][0] + rho * HF[1][0], (1 - rho) * HR[1][1] + rho * HF[1][1]]]; }
	function inv2(H) { var det = H[0][0] * H[1][1] - H[0][1] * H[1][0]; return { det: det, M: [[H[1][1] / det, -H[0][1] / det], [-H[1][0] / det, H[0][0] / det]] }; }
	function amp(H) { var v = inv2(H).M; return Math.sqrt(v[0][0] * v[0][0] + v[0][1] * v[0][1] + v[1][0] * v[1][0] + v[1][1] * v[1][1]); }
	function mimoCompute(ctx) {
		var H = mixH(ctx.p.sim / 100), iv = inv2(H), a = ctx.bits[0] ? 1 : -1, b = ctx.bits[1] ? 1 : -1, sg = ctx.p.noise / 100, r = J.rng(ctx.seed);
		var clean = [H[0][0] * a + H[0][1] * b, H[1][0] * a + H[1][1] * b], heard = [clean[0] + sg * J.gauss(r), clean[1] + sg * J.gauss(r)];
		var sol = [iv.M[0][0] * heard[0] + iv.M[0][1] * heard[1], iv.M[1][0] * heard[0] + iv.M[1][1] * heard[1]];
		var panels = [5, 50, 95].map(function (p) {
			var h = mixH(p / 100), v = inv2(h).M, rr = J.rng(31 + p), pts = [], k;
			for (k = 0; k < 50; k++) { var n1 = 0.25 * J.gauss(rr), n2 = 0.25 * J.gauss(rr); pts.push([1 + v[0][0] * n1 + v[0][1] * n2, 1 + v[1][0] * n1 + v[1][1] * n2]); }
			return { p: p, amp: amp(h), pts: pts };
		});
		return { H: H, a: a, b: b, clean: clean, heard: heard, sol: sol, rec: [sol[0] > 0 ? 1 : 0, sol[1] > 0 ? 1 : 0], amp: amp(H), panels: panels, sg: sg };
	}
	function antenna(s, x, y, cls, label) { J.line(s, x, y, x, y + 56, 'j-axis j-axis--b ' + (cls || '')); J.circle(s, x, y, 9, 'j-dot j-dot--ant'); T(s, x, y + 82, label, 'j-t--s', 'middle'); }
	var MIMO_STORY = {
		title: 'Follow two messages that share the same channel at the same time',
		bits: [1, 0], reseed: true,
		sliders: [{ key: 'noise', label: 'Noise on the air', min: 0, max: 100, step: 5, val: 20, unit: '%' }, { key: 'sim', label: 'How alike the paths are', min: 0, max: 95, step: 5, val: 20, unit: '%' }],
		compute: mimoCompute,
		scenes: [
			{ title: 'Two messages', say: 'Two friends, **A and B**, each have a one-word message: **yes (1)** or **no (0)**. Everything a computer sends is a line of these yes/no answers, called bits. A and B want to send at the **same time**, on the **same channel**. Tap a bit above to change it.',
				pro: 'This is spatial multiplexing: independent data streams sent at the same time on the same frequencies, one from each transmit antenna.',
				draw: function (s, d, t, c) { T(s, 300, 80, 'A says', 'j-t--b j-t--brand', 'middle'); J.bitBoxes(s, [c.bits[0]], 300, 110, 130, 0, t * 1.6, null); T(s, 700, 80, 'B says', 'j-t--b j-t--a', 'middle'); J.bitBoxes(s, [c.bits[1]], 700, 110, 130, 0, t * 1.6 - 0.4, null); T(s, 500, 330, 'two messages, one channel, same moment', 'j-t--b', 'middle'); } },
			{ title: 'Two mouths, two ears', say: 'Each friend has a **mouth** (a sending antenna) and the listener has two **ears** (receiving antennas). Every ear can hear both friends, along four different routes through the room. Thick lines are loud routes, thin lines are quiet ones.',
				pro: 'The four path gains form the channel matrix H. Walls and furniture make the paths different from each other. Real paths are complex numbers (strength and delay); here they are shown as simple strengths.',
				draw: function (s, d, t) {
					var tx = [[180, 80], [180, 220]], rx = [[820, 80], [820, 220]], f = ease(t);
					for (var i = 0; i < 2; i++) { for (var j = 0; j < 2; j++) {
						var h = Math.abs(d.H[j][i]), p0 = tx[i], p1 = rx[j];
						J.line(s, p0[0], p0[1] + 4, p0[0] + (p1[0] - p0[0]) * f, p0[1] + 4 + (p1[1] - p0[1]) * f, 'j-path ' + (i ? 'j-path--b' : 'j-path--a')).setAttribute('style', 'stroke-width:' + (1.5 + h * 7) + 'px');
					} }
					antenna(s, 180, 80, '', 'A'); antenna(s, 180, 220, '', 'B'); antenna(s, 820, 80, '', 'ear 1'); antenna(s, 820, 220, '', 'ear 2');
					T(s, 180, 360, 'two transmit antennas', 'j-t--s', 'middle'); T(s, 820, 360, 'two receive antennas', 'j-t--s', 'middle');
				} },
			{ title: 'The air mixes them', say: 'The two voices **blend together** in the air, like two people talking at once. Each ear hears a different mix of A and B, plus a little background noise.',
				pro: function (d) { return 'The receiver measures r = H x + noise. With the current paths the matrix H is [[' + d.H[0][0].toFixed(2) + ', ' + d.H[0][1].toFixed(2) + '], [' + d.H[1][0].toFixed(2) + ', ' + d.H[1][1].toFixed(2) + ']], A = ' + d.a + ' and B = ' + d.b + ' (a 1 is plus one, a 0 is minus one).'; },
				draw: function (s, d, t, c) {
					[0, 1].forEach(function (e) {
						var y = 60 + e * 150, a = prog(t, e * 0.25, e * 0.25 + 0.6);
						T(s, 40, y + 22, 'Ear ' + (e + 1) + ' hears', 'j-t--b');
						T(s, 40, y + 62, Math.abs(d.H[e][0]).toFixed(2) + (d.H[e][0] < 0 ? ' (flipped)' : '') + ' × A  +  ' + Math.abs(d.H[e][1]).toFixed(2) + (d.H[e][1] < 0 ? ' (flipped)' : '') + ' × B  +  noise', 'j-t--s');
						var v = Math.max(-2.5, Math.min(2.5, d.heard[e])) * 90 * a;
						J.line(s, 700, y + 10, 700, y + 80, 'j-axis');
						J.rect(s, v >= 0 ? 700 : 700 + v, y + 28, Math.abs(v), 26, 'j-box j-bar j-bar--on', 4); T(s, 700 + (v >= 0 ? v + 12 : v - 12), y + 48, d.heard[e].toFixed(2), 'j-t--b', v >= 0 ? 'start' : 'end');
					});
					T(s, 500, 350, 'two mixed numbers: neither one is A or B on its own', 'j-t--b j-t--a', 'middle');
				} },
			{ title: 'Solve the puzzle', say: 'Now the clever part. The listener knows how this room blends voices, because every Wi-Fi packet starts with a short **practice message** that is already known. So the listener can **un-blend** what the two ears heard and pull A and B apart again.',
				pro: 'This is zero-forcing detection: multiply by the inverse of H. Real receivers usually do better than this (MMSE and other methods). The training fields are the HT-LTF, VHT-LTF and HE-LTF, one per stream.',
				draw: function (s, d, t) {
					var f = ease(t);
					[['A', d.sol[0], d.a, 'j-t--brand', 120], ['B', d.sol[1], d.b, 'j-t--a', 250]].forEach(function (r, i) {
						var y = 100 + i * 120, v = Math.max(-2.5, Math.min(2.5, r[1])) * 110 * f;
						T(s, 40, y + 20, 'Answer for ' + r[0], 'j-t--b ' + r[3]); J.line(s, 600, y - 10, 600, y + 60, 'j-axis');
						J.line(s, 600 + r[2] * 110, y - 6, 600 + r[2] * 110, y + 56, 'j-axis j-axis--b');
						J.rect(s, v >= 0 ? 600 : 600 + v, y + 10, Math.abs(v), 30, 'j-box j-bar j-bar--on', 4);
						T(s, 600 + (v >= 0 ? v + 12 : v - 12), y + 34, r[1].toFixed(2), 'j-t--b', v >= 0 ? 'start' : 'end');
						T(s, 600 + r[2] * 110, y - 14, 'true value', 'j-t--s', 'middle');
					});
					T(s, 40, 350, 'noise multiplied by about ' + d.amp.toFixed(1) + ' in this step', 'j-t--s');
				} },
			{ title: 'Your bits back', say: 'An answer above zero means **yes (1)** and below zero means **no (0)**. Both messages arrive, **at the same time**, on the same channel.',
				pro: 'If the noise is large, or the paths are too alike, the answers can land on the wrong side of zero and a bit flips. Try it with the sliders.',
				draw: function (s, d, t, c) {
					var okA = d.rec[0] === c.bits[0], okB = d.rec[1] === c.bits[1];
					T(s, 300, 70, 'A: received', 'j-t--b j-t--brand', 'middle'); J.bitBoxes(s, [d.rec[0]], 300, 100, 120, 0, t * 1.6, [okA]); T(s, 300, 270, okA ? 'correct' : 'wrong', 'j-t--b ' + (okA ? 'j-t--good' : 'j-t--bad'), 'middle');
					T(s, 700, 70, 'B: received', 'j-t--b j-t--a', 'middle'); J.bitBoxes(s, [d.rec[1]], 700, 100, 120, 0, t * 1.6 - 0.4, [okB]); T(s, 700, 270, okB ? 'correct' : 'wrong', 'j-t--b ' + (okB ? 'j-t--good' : 'j-t--bad'), 'middle');
					if (t > 0.8) { T(s, 500, 350, okA && okB ? 'Two messages in the time of one!' : 'Noise or look-alike paths won. Change the sliders.', 'j-t--b ' + (okA && okB ? 'j-t--good' : 'j-t--bad'), 'middle'); }
				} },
			{ title: 'Why walls help', say: 'Why do walls help? If all the routes sounded exactly alike, both ears would hear the same blend and the listener could not tell A from B. Walls and furniture bounce the signal around so that each route sounds **different**. That is why this works well indoors, and badly in an open field with one straight route.',
				pro: 'Each box shows 50 attempts at the same two messages with the same noise. The number is how much the solving step multiplies noise (the size of the inverse of H). Nearly identical paths make H almost impossible to invert.',
				draw: function (s, d, t) {
					var names = ['Lots of reflections', 'Some reflections', 'Paths almost the same'];
					d.panels.forEach(function (p, i) {
						var px = 30 + i * 320, py = 70, sz = 270, cx = px + sz / 2 + 0, cy = py + sz / 2 + 10, a = prog(t, i * 0.2, i * 0.2 + 0.5), k = 55;
						s.append(svg('rect', { x: px, y: py - 10, width: sz, height: sz, rx: 10, class: 'j-box j-box--card', opacity: a }));
						J.line(s, px + 10, cy, px + sz - 10, cy, 'j-axis'); J.line(s, cx, py, cx, py + sz - 20, 'j-axis');
						[[1, 1]].forEach(function (q) { J.circle(s, cx + q[0] * k, cy - q[1] * k, 11, 'j-dot j-dot--ring').setAttribute('opacity', a); });
						p.pts.forEach(function (q, n) { if (a * 50 > n) { var x = Math.max(px + 8, Math.min(px + sz - 8, cx + q[0] * k)), y = Math.max(py - 2, Math.min(py + sz - 24, cy - q[1] * k)); J.circle(s, x, y, 4, 'j-dot j-dot--cloud'); } });
						T(s, px + sz / 2, 54, names[i], 'j-t--s', 'middle'); T(s, px + sz / 2, 362, 'noise × ' + p.amp.toFixed(1), 'j-t--b ' + (p.amp < 2 ? 'j-t--good' : p.amp < 6 ? 'j-t--a' : 'j-t--bad'), 'middle');
					});
				} },
			{ title: 'Faster, with more streams',
				say: 'Two mouths sending two different messages at once give **double the speed**. Four streams give four times. Wi-Fi 6 and 7 allow up to eight streams, though most phones manage two and most routers four.',
				pro: 'Speed grows with the number of spatial streams, up to the smaller of the transmit and receive antenna counts. Real gains depend on how different the paths are. Rates here are relative to one stream, not measured.',
				draw: function (s, d, t) {
					[1, 2, 4, 8].forEach(function (n, i) {
						var a = prog(t, i * 0.15, i * 0.15 + 0.5), y = 70 + i * 66, len = 100 * n * ease(a);
						J.rect(s, 40, y, len, 44, 'j-box j-bar ' + (n === 2 ? 'j-bar--on' : 'j-bar--off'), 8); T(s, 52, y + 30, n + (n === 1 ? ' stream' : ' streams'), 'j-t--bar' + (n === 2 ? ' is-on' : ''));
						if (a > 0.6) { T(s, 40 + len + 14, y + 32, n + ' × the speed', n === 2 ? 'j-t--a' : 'j-t--s'); }
					});
				} }
		]
	};
	window.WifiLabModels.journeymimo = J.player(MIMO_STORY);
	/* =====================================================================
	 * QoS / WMM: four waiting lines, and the VIP line waits least
	 * Values: EDCA defaults for OFDM PHYs (IEEE Std 802.11-2020, Table 9-155): AIFSN 2/2/3/7, CWmin 3/7/15/15; SIFS 16 us, slot 9 us.
	 * UP-to-AC mapping: 6,7 voice; 4,5 video; 0,3 best effort; 1,2 background (the same table Wireshark labels).
	 * ===================================================================== */
	var ACS = [
		{ name: 'Calls', ac: 'Voice (AC_VO)', aifsn: 2, cw: 3, up: 6, need: 'cannot wait', ex: 'a video call' },
		{ name: 'Video', ac: 'Video (AC_VI)', aifsn: 2, cw: 7, up: 5, need: 'can wait a little', ex: 'a film' },
		{ name: 'Normal', ac: 'Best effort (AC_BE)', aifsn: 3, cw: 15, up: 0, need: 'can wait', ex: 'web pages' },
		{ name: 'Background', ac: 'Background (AC_BK)', aifsn: 7, cw: 15, up: 1, need: 'happy to wait', ex: 'a backup' }
	];
	var SIFS = 16, SLOT = 9;
	function qosCompute(ctx) {
		var r = J.rng(ctx.seed + 11), me = ctx.p.kind, rows = ACS.map(function (a, i) {
			var back = Math.floor(r() * (a.cw + 1));
			return { i: i, a: a, back: back, total: a.aifsn + back, avg: SIFS + a.aifsn * SLOT + (a.cw / 2) * SLOT };
		}), win = 0, k;
		for (k = 1; k < 4; k++) { if (rows[k].total < rows[win].total) { win = k; } }
		return { me: me, rows: rows, win: win };
	}
	var QOS_STORY = {
		title: 'Follow four kinds of traffic racing for the same Wi-Fi turn',
		reseed: true, reseedLabel: 'Run another race',
		segs: [{ key: 'kind', label: 'What are you doing?', options: [[0, 'Video call'], [1, 'Watching a film'], [2, 'Browsing'], [3, 'Backing up photos']], val: 0 }],
		compute: qosCompute,
		scenes: [
			{ title: 'Not all traffic is equal', say: 'Your Wi-Fi carries many things at once: a **video call**, a **film**, a web page and a photo **backup**. They all want the air at the same moment. But a call that stutters is ruined, while a backup that waits one second is fine.',
				pro: 'Voice and interactive video are sensitive to delay and delay variation. Bulk transfers are not. Quality of service (QoS) in 802.11 lets the network treat them differently.',
				draw: function (s, d, t) { ACS.forEach(function (a, i) { var x = 40 + i * 235, al = prog(t, i * 0.15, i * 0.15 + 0.35); if (al > 0) { J.rect(s, x, 80, 215, 190, 'j-box j-dev j-dev--' + i, 16).setAttribute('opacity', al); T(s, x + 107, 130, a.ex, 'j-t--b j-t--onc', 'middle'); T(s, x + 107, 190, a.need, 'j-t--onc', 'middle'); } }); T(s, 500, 330, 'same air, very different needs', 'j-t--b', 'middle'); } },
			{ title: 'A sticker on every packet', say: function (d) { var a = ACS[d.me]; return 'Before your device sends, it sticks a **priority label** on each packet, a number from 0 to 7. For ' + a.ex + ' the label is **' + a.up + '**. The label decides which of four waiting lines the packet joins.'; },
				pro: 'The label is the user priority (UP, 0 to 7), carried in the QoS Control field of the MAC header (its TID bits). Priorities 6 and 7 map to voice, 4 and 5 to video, 0 and 3 to best effort, and 1 and 2 to background. Apps and routers usually set it from the IP DSCP value.',
				draw: function (s, d, t) {
					var lane = [[6, 7], [4, 5], [0, 3], [1, 2]], f = ease(t);
					T(s, 40, 40, 'packet label', 'j-t--s'); T(s, 330, 40, 'waiting line', 'j-t--s');
					ACS.forEach(function (a, i) {
						var y = 60 + i * 74, on = i === d.me;
						J.rect(s, 330, y, 630, 56, on ? 'j-box j-dev j-dev--' + i : 'j-box j-box--card', 12);
						T(s, 350, y + 36, a.name + ' line', 'j-t--b' + (on ? ' j-t--onc' : ''));
						T(s, 940, y + 36, 'labels ' + lane[i].join(' or '), 'j-t' + (on ? ' j-t--onc' : ' j-t--s'), 'end');
					});
					var y0 = 88 + d.me * 74;
					var sx = 40 + 150 * f, sy = 150 + (y0 - 28 - 150) * f;
					J.rect(s, sx, sy, 130, 56, 'j-box j-dev j-dev--' + d.me, 12);
					T(s, sx + 65, sy + 37, 'label ' + ACS[d.me].up, 'j-t--b j-t--onc', 'middle');
				} },
			{ title: 'The race for the turn', say: function (d) { var w = d.rows[d.win].a; return 'Every line waits a short fixed time, then counts down a **random number**. The VIP lines wait less and count from smaller numbers, so they usually win. This time the **' + w.name.toLowerCase() + ' line goes first**' + (d.win === d.me ? ': that is yours.' : '; yours (' + ACS[d.me].name.toLowerCase() + ') has to wait.'); },
				pro: function (d) { return 'Each access category waits AIFS = SIFS + AIFSN × slot, then counts down a random backoff drawn from 0 to CWmin (OFDM defaults: voice 2 and 3, video 2 and 7, best effort 3 and 15, background 7 and 15). Totals in slots this time: ' + d.rows.map(function (r) { return r.a.name + ' ' + r.total; }).join(', ') + '. Press the button to run another race.'; },
				draw: function (s, d, t) {
					var u = 28, x0 = 200, f = ease(t);
					T(s, 40, 36, 'waiting time →', 'j-t--s');
					d.rows.forEach(function (r, i) {
						var y = 56 + i * 74, w1 = Math.min(r.a.aifsn, r.total * f) * u, w2 = Math.max(0, Math.min(r.back, r.total * f - r.a.aifsn)) * u, fin = f > 0.98, win = fin && i === d.win;
						T(s, 40, y + 34, r.a.name, 'j-t--b' + (i === d.me ? ' j-t--dev' + i : ''));
						J.rect(s, x0, y + 4, Math.max(0, w1), 44, 'j-wait', 6);
						if (w2 > 0) { J.rect(s, x0 + r.a.aifsn * u, y + 4, w2, 44, 'j-box j-dev j-dev--' + i, 6); }
						if (fin) { T(s, x0 + r.total * u + 12, y + 36, win ? '✔ goes first' : 'waits', 'j-t--b' + (win ? ' j-t--good' : ' j-t--s')); }
					});
					T(s, x0, 366, 'grey = fixed wait   coloured = random countdown', 'j-t--s');
				} },
			{ title: 'On average', say: 'Run the race many times and the pattern is clear: the call line waits the **least**, the backup line the **most**. The gaps are tiny, millionths of a second, but when many devices compete they decide who gets each turn.',
				pro: 'Average wait = SIFS + AIFSN × slot + (CWmin ÷ 2) × slot, with SIFS 16 µs and slot 9 µs for OFDM at 20 MHz. Voice 47.5 µs, video 65.5 µs, best effort 110.5 µs, background 146.5 µs. These are the default values (IEEE Std 802.11-2020, Table 9-155); an access point can announce different ones.',
				draw: function (s, d, t) {
					var u = 3.6, f = ease(t);
					T(s, 40, 36, 'average wait before sending (microseconds)', 'j-t--s');
					d.rows.forEach(function (r, i) {
						var y = 56 + i * 74, w = r.avg * u * f;
						T(s, 40, y + 34, r.a.name, 'j-t--b' + (i === d.me ? ' j-t--dev' + i : ''));
						J.rect(s, 200, y + 4, w, 44, 'j-box j-dev j-dev--' + i, 6);
						if (f > 0.7) { T(s, 200 + w + 12, y + 36, r.avg.toFixed(1) + ' µs', 'j-t--b'); }
					});
				} },
			{ title: 'It only matters when busy', say: 'On a quiet network everybody gets a turn at once, so the labels change **nothing**. They only help when the air is **crowded**: then the call jumps the queue and the backup lets others go first. It does not make Wi-Fi faster, it decides **who goes first**.',
				pro: 'EDCA is a statistical priority, not a guarantee. A lower-priority frame can still win a given race, and a very busy channel still delays everything. Strict guarantees need admission control (the ACM bit) or scheduled access, which are rarely used.',
				draw: function (s, d, t) {
					var f = ease(t), i;
					[['Quiet network', 60, false], ['Crowded network', 520, true]].forEach(function (pn) {
						J.rect(s, pn[1], 50, 420, 270, 'j-box j-box--card', 14); T(s, pn[1] + 210, 90, pn[0], 'j-t--b', 'middle');
						for (i = 0; i < 4; i++) { var n = pn[2] ? [2, 3, 5, 6][i] : 1, k; for (k = 0; k < n * f; k++) { J.rect(s, pn[1] + 30 + k * 36, 120 + i * 44, 28, 28, 'j-box j-dev j-dev--' + i, 6); } }
					});
					T(s, 270, 345, 'no queue: labels do nothing', 'j-t--s', 'middle'); T(s, 730, 345, 'queue: calls first, backups last', 'j-t--b j-t--a', 'middle');
				} },
			{ title: 'The sticker must be honest', say: 'The labels only work if **someone puts them on**. Many apps never do, so everything lands in the normal line and the VIP line stays empty. Some routers also wipe the label on the way. Check your router’s **WMM** setting is on.',
				pro: 'WMM is the Wi-Fi Alliance name for this feature set (802.11e EDCA). The mapping from IP DSCP to the Wi-Fi priority varies: the default of using the top three DSCP bits sends EF (46) to priority 5, video, instead of voice, which is why RFC 8325 recommends a different mapping.',
				draw: function (s, d, t) {
					var f = ease(t), x = ['app', 'router', 'Wi-Fi'], i;
					for (i = 0; i < 3; i++) { J.rect(s, 60 + i * 330, 100, 220, 110, 'j-box j-box--card', 14); T(s, 170 + i * 330, 163, x[i], 'j-t--b', 'middle'); }
					J.arrow(s, 285, 155, 385, 155, 'j-axis j-axis--b'); J.arrow(s, 615, 155, 715, 155, 'j-axis j-axis--b');
					J.rect(s, 90, 62, 100 * Math.min(1, f * 1.5), 34, 'j-box j-dev j-dev--0', 8); if (f > 0.4) { T(s, 140, 86, 'label 6', 'j-t--s j-t--onc', 'middle'); }
					J.rect(s, 780, 62, 100, 34, f > 0.6 ? 'j-box j-box--badline' : 'j-box j-dev j-dev--2', 8); T(s, 830, 86, f > 0.6 ? 'no label' : '…', 'j-t--s', 'middle');
					T(s, 500, 300, f > 0.6 ? 'label lost on the way: the packet is treated as normal' : 'the app stuck a label on', 'j-t--b j-t--a', 'middle');
				} }
		]
	};
	window.WifiLabModels.journeyqos = J.player(QOS_STORY);
	/* =====================================================================
	 * BSS colouring and spatial reuse (802.11ax)
	 * Facts: a 6-bit BSS colour (1 to 63) is carried in HE-SIG-A; a receiver may ignore a frame from another colour that is weaker than
	 * the OBSS PD threshold (default -82 dBm, adjustable up to -62 dBm) if it lowers its own transmit power by the same number of dB.
	 * The threshold used on screen (-72 dBm) is an illustration; a real device picks its own value in that range.
	 * ===================================================================== */
	var OBSS_TH = -72, OBSS_MIN = -82;
	function bssCompute(ctx) {
		var sig = ctx.p.sig, same = ctx.p.same === 1, dec, why, cut = OBSS_TH - OBSS_MIN;
		if (same) { dec = 'wait'; why = 'the same colour: this is my own network, so I wait my turn'; }
		else if (sig < OBSS_MIN) { dec = 'talk'; why = 'a different colour and very faint: ignored even by the old rule'; }
		else if (sig < OBSS_TH) { dec = 'talk-low'; why = 'a different colour and fairly faint: Wi-Fi 6 lets me talk too, at lower power'; }
		else { dec = 'wait'; why = 'a different colour but too loud: talking now would spoil both messages, so I wait'; }
		return { sig: sig, same: same, dec: dec, why: why, cut: cut, gain: dec === 'talk-low' };
	}
	var BSS_STORY = {
		title: 'Follow two neighbours who share one Wi-Fi channel',
		sliders: [{ key: 'sig', label: 'How loud the neighbour sounds at my router', min: -90, max: -50, step: 2, val: -76, unit: ' dBm' }],
		segs: [{ key: 'same', label: 'The neighbour’s colour is', options: [[0, 'different'], [1, 'the same as mine']], val: 0 }],
		compute: bssCompute,
		scenes: [
			{ title: 'Two neighbours, one channel', say: 'Two flats next door to each other. Each has its own Wi-Fi router, and both routers use the **same channel**. A wall separates them, but the wall does not stop Wi-Fi completely: each router can faintly hear the other.',
				pro: 'In a block of flats many access points end up on the same channel. Frames from another network on the same channel are called OBSS (overlapping basic service set) frames.',
				draw: function (s, d, t) {
					var f = ease(t);
					J.rect(s, 60, 60, 380, 250, 'j-box j-box--card', 14); J.rect(s, 560, 60, 380, 250, 'j-box j-box--card', 14);
					T(s, 250, 100, 'Flat A', 'j-t--b j-t--brand', 'middle'); T(s, 750, 100, 'Flat B', 'j-t--b j-t--a', 'middle');
					J.rect(s, 150, 160, 100, 60, 'j-box j-dev j-dev--0', 12); T(s, 200, 198, 'router', 'j-t--onc', 'middle');
					J.rect(s, 650, 160, 100, 60, 'j-box j-dev j-dev--1', 12); T(s, 700, 198, 'router', 'j-t--onc', 'middle');
					J.circle(s, 100, 270, 14, 'j-dot j-dot--mine'); J.circle(s, 900, 270, 14, 'j-dot j-dot--mine');
					J.rect(s, 485, 50, 30, 270, 'j-wait', 0); T(s, 500, 345, 'wall', 'j-t--s', 'middle');
					J.arrow(s, 255, 190, 255 + 300 * f, 190, 'j-axis j-axis--b'); T(s, 500, 150, 'faint signal', 'j-t--s', 'middle');
				} },
			{ title: 'The old rule: everyone waits', say: 'The old rule is very polite and very cautious: **if you hear any Wi-Fi at all, wait**. So when flat A is sending, flat B’s router also waits, even though A is far away and B could have talked without any trouble.',
				pro: 'Before Wi-Fi 6 a station treats the channel as busy whenever it detects a Wi-Fi preamble above about −82 dBm, whichever network sent it.',
				draw: function (s, d, t) {
					var u = 380, f = ease(t);
					T(s, 40, 40, 'time →', 'j-t--s');
					T(s, 40, 130, 'Flat A', 'j-t--b j-t--brand'); J.rect(s, 200, 100, u * f, 50, 'j-box j-dev j-dev--0', 6); if (f > 0.5) { T(s, 210, 134, 'sending', 'j-t--onc'); }
					T(s, 40, 250, 'Flat B', 'j-t--b j-t--a'); J.rect(s, 200, 220, u * f, 50, 'j-wait', 6); if (f > 0.5) { T(s, 210, 254, 'waiting for nothing', 'j-t--s'); }
					if (t > 0.8) { T(s, 500, 340, 'B’s own phone was never in danger', 'j-t--b j-t--bad', 'middle'); }
				} },
			{ title: 'A colour on every packet', say: 'Wi-Fi 6 adds a trick: every network gets a **colour**, a number from 1 to 63, and every packet carries it in its first moments. Flat A sends “**colour 12**”, flat B sends “**colour 37**”. Now a router can tell **my** network from the neighbour’s.',
				pro: 'The BSS colour is a 6-bit field in the HE-SIG-A part of the PHY header of Wi-Fi 6 packets (IEEE 802.11ax-2021, an amendment that is not in the 2020 base edition). The access point announces its colour in the HE Operation element of its beacons.',
				draw: function (s, d, t) {
					[[0, 12, 130], [1, 37, 250]].forEach(function (c, k) {
						var a = prog(t, k * 0.3, k * 0.3 + 0.4), x = 120 + (1 - a) * 80;
						T(s, 60, c[2] - 12, k ? 'Flat B' : 'Flat A', 'j-t--b ' + (k ? 'j-t--a' : 'j-t--brand'));
						J.rect(s, x + 120, c[2] - 40, 420, 70, 'j-box j-box--card', 10).setAttribute('opacity', a);
						J.rect(s, x + 130, c[2] - 30, 130, 50, 'j-box j-dev j-dev--' + c[0], 8).setAttribute('opacity', a);
						T(s, x + 195, c[2] + 5, 'colour ' + c[1], 'j-t--b j-t--onc', 'middle').setAttribute('opacity', a);
						T(s, x + 290, c[2] + 4, 'the message itself …', 'j-t--s').setAttribute('opacity', a);
					});
					T(s, 500, 340, 'a colour tag on every packet', 'j-t--b', 'middle');
				} },
			{ title: 'Mine or the neighbour’s?', say: function (d) { return 'Flat B’s router now hears a packet and reads its colour. ' + (d.same ? 'It is the **same colour**, so it is my own network: wait my turn.' : 'It is a **different colour**, so it is a neighbour. Now it only asks one thing: how **loud** is it?') + ' Move the sliders and see the decision change. Right now: **' + (d.dec === 'wait' ? 'wait' : d.dec === 'talk' ? 'go ahead' : 'go ahead at lower power') + '**.'; },
				pro: function (d) { return 'Decision this time: ' + d.why + '. The threshold on screen is ' + OBSS_TH + ' dBm, an illustration. The standard’s default OBSS PD level is −82 dBm and a device may raise it as far as −62 dBm. This page assumes a neighbour packet at ' + d.sig + ' dBm.'; },
				draw: function (s, d, t) {
					var x0 = 80, x1 = 920, f = function (v) { return x0 + (v + 90) / 40 * (x1 - x0); }, y = 160;
					T(s, 40, 40, 'neighbour’s signal at my router', 'j-t--s');
					if (d.same) { J.rect(s, x0, y, x1 - x0, 60, 'j-box j-box--bad', 8); T(s, 500, y + 40, 'my own network: always wait my turn', 'j-t--b j-t--onc', 'middle'); }
					else {
						J.rect(s, x0, y, f(OBSS_MIN) - x0, 60, 'j-wait', 0); T(s, (x0 + f(OBSS_MIN)) / 2, y + 40, 'faint', 'j-t--s', 'middle');
						J.rect(s, f(OBSS_MIN), y, f(OBSS_TH) - f(OBSS_MIN), 60, 'j-box j-box--good', 0); T(s, (f(OBSS_MIN) + f(OBSS_TH)) / 2, y + 40, 'may talk too', 'j-t--b j-t--onc', 'middle');
						J.rect(s, f(OBSS_TH), y, x1 - f(OBSS_TH), 60, 'j-box j-box--bad', 0); T(s, (f(OBSS_TH) + x1) / 2, y + 40, 'too loud: wait', 'j-t--b j-t--onc', 'middle');
						T(s, f(OBSS_MIN), y + 90, '−82', 'j-t--s', 'middle'); T(s, f(OBSS_TH), y + 90, String(OBSS_TH).replace('-', '−'), 'j-t--s', 'middle');
					}
					var mx = f(d.sig); J.arrow(s, mx, y - 50, mx, y - 4, 'j-axis j-axis--b'); T(s, mx, y - 58, String(d.sig).replace('-', '−') + ' dBm', 'j-t--b', 'middle');
					T(s, 500, 330, d.dec === 'wait' ? 'decision: wait' : d.dec === 'talk' ? 'decision: go ahead' : 'decision: go ahead at lower power', 'j-t--b ' + (d.dec === 'wait' ? 'j-t--bad' : 'j-t--good'), 'middle');
				} },
			{ title: 'Talking at the same time', say: function (d) { return d.gain ? 'Both flats now talk **at the same time**. Flat B turns its own volume down a little (by about ' + d.cut + ' dB) so it does not shout over the neighbour. Two conversations fit where there was room for one.' : (d.same ? 'With the **same colour** there is no trick: the two routers behave like one network and take turns.' : d.dec === 'talk' ? 'The neighbour was so faint that B can talk at once at normal power, even with the old rule.' : 'The neighbour is **too loud** for this trick, so B still waits its turn. Move the slider down to a quieter neighbour to see the gain.'); },
				pro: 'When a device ignores a frame this way it must lower its transmit power by the number of dB by which its threshold exceeds −82 dBm (OBSS PD-based spatial reuse). Here: ' + (OBSS_TH - OBSS_MIN) + ' dB. The device also keeps separate timers for its own network and for neighbours (the intra-BSS and basic NAV).',
				draw: function (s, d, t) {
					var u = 300, f = ease(t), ok = d.dec !== 'wait';
					T(s, 40, 40, 'time →', 'j-t--s');
					T(s, 40, 130, 'Flat A', 'j-t--b j-t--brand'); J.rect(s, 200, 100, u * f, 50, 'j-box j-dev j-dev--0', 6);
					T(s, 40, 250, 'Flat B', 'j-t--b j-t--a');
					if (ok) { J.rect(s, 200, 220, u * f, 50, 'j-box j-dev j-dev--1', 6).setAttribute('opacity', 0.75); T(s, 210, 254, d.gain ? 'sending, a bit quieter' : 'sending', 'j-t--onc'); }
					else { J.rect(s, 200, 220, u * f, 50, 'j-wait', 6); J.rect(s, 200 + u, 220, u * f, 50, 'j-box j-dev j-dev--1', 6); T(s, 200 + u + 10, 254, 'then B sends', 'j-t--onc'); }
					if (t > 0.85) { T(s, 500, 340, ok ? 'both finished in one turn' : 'two turns: no saving', 'j-t--b ' + (ok ? 'j-t--good' : 'j-t--bad'), 'middle'); }
				} },
			{ title: 'When two neighbours pick the same colour', say: 'Colours are chosen by the routers themselves, so two neighbours can **pick the same one**. Then they think the other’s packets are their own, and go back to waiting for each other. The fix: a router **announces** “I am switching to colour 37” and moves.',
				pro: 'The access point sends a BSS Color Change Announcement element with a countdown of beacons, then switches. While the colour is in doubt it can set the BSS Color Disabled bit in the HE Operation element.',
				draw: function (s, d, t) {
					var sw = t > 0.55;
					[['Flat A', 12, 0, 70], ['Flat B', sw ? 37 : 12, 1, 640]].forEach(function (r) {
						J.rect(s, r[3], 80, 290, 150, 'j-box j-box--card', 14); T(s, r[3] + 145, 120, r[0], 'j-t--b ' + (r[2] ? 'j-t--a' : 'j-t--brand'), 'middle');
						J.rect(s, r[3] + 70, 145, 150, 56, 'j-box j-dev j-dev--' + (r[2] && sw ? 2 : r[2] ? 1 : 0), 10); T(s, r[3] + 145, 182, 'colour ' + r[1], 'j-t--b j-t--onc', 'middle');
					});
					T(s, 500, 160, sw ? '✔' : '=', 'j-t--b ' + (sw ? 'j-t--good' : 'j-t--bad'), 'middle');
					T(s, 500, 310, sw ? 'B announced the change and moved to colour 37' : 'same colour: they treat each other as one network', 'j-t--b', 'middle');
				} }
		]
	};
	window.WifiLabModels.journeybss = J.player(BSS_STORY);
})();
