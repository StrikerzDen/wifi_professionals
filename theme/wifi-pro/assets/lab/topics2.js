/* Wi-Fi Pro Lab: MAC, generations, connection, coexistence, measurement and engineering models.
 * Numbers checked against IEEE Std 802.11-2020: aSIFSTime, aSlotTime, aCWmin and aCWmax (Tables 16-?, 17-21 and 18-5),
 * the receiver minimum sensitivity (Table 17-18 for OFDM, Table 21-25 for VHT; a noise figure of 10 dB and 5 dB
 * implementation margin are assumed), CCA at -82 dBm and energy detect at -62 dBm (17.3.10.6), and the reason codes (Table 9-49).
 * Simulations are simplified teaching models, not bit-exact: they say so on the page.
 * Helpers come from lab.js (window.WifiLab); models register themselves in window.WifiLabModels.
 */
(function () {
	'use strict';
	var L = window.WifiLab;
	if (!L) { return; }
	var el = L.el, svg = L.svg, seg = L.seg, readout = L.readout, fmt = L.fmt, RM = L.RM;
	window.WifiLabModels = window.WifiLabModels || {};

	function text(parent, x, y, str, cls, anchor) { var t = svg('text', { x: x, y: y, class: cls || 'lab-tick', 'text-anchor': anchor || 'start' }); t.textContent = str; parent.append(t); return t; }
	function slider(label, min, max, step, val, fmtv, onInput) {
		var out = el('output', { text: fmtv(val) });
		var inp = el('input', { type: 'range', min: min, max: max, step: step, value: val, 'aria-label': label });
		inp.addEventListener('input', function () { out.textContent = fmtv(Number(inp.value)); onInput(Number(inp.value)); });
		var w = el('label', { class: 'lab-ctl lab-ctl--range' }, [el('span', { class: 'lab-ctl__t' }, [document.createTextNode(label + ': '), out]), inp]);
		w.set = function (v) { inp.value = v; out.textContent = fmtv(Number(v)); };
		return w;
	}
	function ctl(title, node) { return el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: title }), node]); }
	function rng(seed) { var a = seed >>> 0; return function () { a += 0x6D2B79F5; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
	function table(head, rows) {
		return el('div', { class: 'lab-tablewrap' }, [el('table', { class: 'lab-table' }, [el('thead', {}, [el('tr', {}, head.map(function (h) { return el('th', { scope: 'col', text: h }); }))]), el('tbody', {}, rows.map(function (r) { return el('tr', {}, r.map(function (c, i) { return i === 0 ? el('th', { scope: 'row', text: c }) : el('td', { text: c }); })); }))])]);
	}

	/* =====================================================================
	 * DCF: contention, backoff and collisions
	 * ===================================================================== */
	function simDCF(N, cwmin, Lslots, slots, seed) {
		var r = rng(seed), cwmax = 1023, cw = [], bo = [], succ = [], t = 0, idle = 0, busyOk = 0, busyCol = 0, nOk = 0, nCol = 0, ev = [], i;
		for (i = 0; i < N; i++) { cw[i] = cwmin; bo[i] = Math.floor(r() * (cwmin + 1)); succ[i] = 0; }
		while (t < slots) {
			var m = Math.min.apply(null, bo);
			if (m > 0) { for (i = 0; i < N; i++) { bo[i] -= m; } t += m; idle += m; if (ev.length < 60) { ev.push({ k: 'idle', n: m }); } continue; }
			var tx = []; for (i = 0; i < N; i++) { if (bo[i] === 0) { tx.push(i); } }
			if (tx.length === 1) { i = tx[0]; succ[i]++; nOk++; busyOk += Lslots; cw[i] = cwmin; bo[i] = Math.floor(r() * (cwmin + 1)); if (ev.length < 60) { ev.push({ k: 'ok', s: i }); } }
			else { nCol++; busyCol += Lslots; tx.forEach(function (j) { cw[j] = Math.min(2 * cw[j] + 1, cwmax); bo[j] = Math.floor(r() * (cw[j] + 1)); }); if (ev.length < 60) { ev.push({ k: 'col', s: tx }); } }
			t += Lslots;
		}
		return { succ: succ, nOk: nOk, nCol: nCol, idle: idle, busyOk: busyOk, busyCol: busyCol, t: t, ev: ev };
	}
	window.WifiLabModels.csma = function (root) {
		var st = { n: 5, cw: 15, len: 30, seed: 1 };
		var controls = el('div', { class: 'lab-controls' }, [
			slider('Stations all wanting to send', 2, 30, 1, st.n, function (v) { return String(v); }, function (v) { st.n = v; draw(); }),
			ctl('Smallest contention window (aCWmin)', seg('aCWmin', [[15, '15 (OFDM)'], [31, '31 (DSSS / CCK)']], 15, function (v) { st.cw = Number(v); draw(); })),
			slider('Frame length', 10, 100, 5, st.len, function (v) { return v + ' slots'; }, function (v) { st.len = v; draw(); }),
			el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Random draw' }), (function () { var b = el('button', { type: 'button', class: 'lab-net__b', text: 'Run again' }); b.addEventListener('click', function () { st.seed++; draw(); }); return b; })()])]);
		var stripBox = el('div', { class: 'lab-stage' }), chartBox = el('div', { class: 'lab-stage' });
		var roC = readout('', 'transmissions that collided'), roL = readout('', 'of the channel time lost to collisions'), roI = readout('', 'of the time idle (counting down)'), roF = readout('', 'busiest station vs quietest');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stripBox, el('div', { class: 'lab-reads' }, [roC, roL, roI, roF]), chartBox, note);
		function draw() {
			var r = simDCF(st.n, st.cw, st.len, 60000, st.seed * 7919), tot = r.nOk + r.nCol;
			var W = 1000, H = 120, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'The first events on the channel: idle slots, successful frames and collisions' });
			var x = 10, cell = 960 / Math.min(r.ev.length, 40);
			r.ev.slice(0, 40).forEach(function (e) {
				var cls = e.k === 'ok' ? 'is-good' : (e.k === 'col' ? 'is-bad' : 'is-warn'), op = e.k === 'idle' ? 0.25 : 0.85;
				s.append(svg('rect', { x: x, y: 20, width: cell - 3, height: 56, rx: 4, class: 'lab-bar ' + cls, style: 'opacity:' + op }));
				var lab = e.k === 'ok' ? 'S' + (e.s + 1) : (e.k === 'col' ? 'x' + e.s.length : e.n);
				if (cell > 18) { text(s, x + (cell - 3) / 2, 53, String(lab), 'lab-tick lab-tick--f', 'middle'); }
				x += cell;
			});
			text(s, 10, 104, 'First 40 events: pale = idle slots counted down, green = one station sent (S and its number), red = several sent at once (x and how many)', 'lab-tick');
			stripBox.replaceChildren(s);
			var colShare = r.busyCol / r.t * 100, idleShare = r.idle / r.t * 100, mx = Math.max.apply(null, r.succ), mn = Math.min.apply(null, r.succ);
			roC.set(fmt(r.nCol / tot * 100, 1) + '%', r.nCol / tot > 0.25 ? 'bad' : (r.nCol / tot > 0.1 ? 'warn' : 'good')); roL.set(fmt(colShare, 1) + '%', colShare > 15 ? 'bad' : 'warn'); roI.set(fmt(idleShare, 1) + '%'); roF.set(mx + ' : ' + mn + ' frames');
			// collision rate against number of stations
			var W2 = 1000, H2 = 240, x0 = 60, x1 = 960, yT = 20, yB = 190, s2 = svg('svg', { viewBox: '0 0 ' + W2 + ' ' + H2, class: 'lab-svg', role: 'img', 'aria-label': 'Share of transmissions that collide, against number of stations' });
			var pts = [], maxv = 0;
			for (var n = 2; n <= 30; n++) { var q = simDCF(n, st.cw, st.len, 40000, 11 + n); var v = q.nCol / (q.nCol + q.nOk) * 100; pts.push([n, v]); maxv = Math.max(maxv, v); }
			maxv = Math.max(10, Math.ceil(maxv / 10) * 10);
			function X(n) { return x0 + (n - 2) / 28 * (x1 - x0); } function Y(v) { return yB - v / maxv * (yB - yT); }
			for (var g = 0; g <= maxv; g += maxv / 4) { s2.append(svg('line', { x1: x0, y1: Y(g), x2: x1, y2: Y(g), class: 'lab-axis', opacity: .5 })); text(s2, x0 - 8, Y(g) + 4, fmt(g, 0) + '%', 'lab-tick', 'end'); }
			[2, 5, 10, 15, 20, 25, 30].forEach(function (n) { text(s2, X(n), yB + 20, String(n), 'lab-tick', 'middle'); });
			text(s2, (x0 + x1) / 2, yB + 42, 'stations contending', 'lab-tick', 'middle');
			s2.append(svg('path', { d: pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(''), class: 'lab-wave is-on' }));
			s2.append(svg('circle', { cx: X(st.n), cy: Y(pts[st.n - 2][1]), r: 7, fill: 'var(--wp--preset--color--accent)' }));
			chartBox.replaceChildren(s2);
			note.textContent = 'Every station waits a random number of idle slots (its backoff, drawn from 0 to the contention window) and the counter freezes while the channel is busy. When it reaches zero the station sends. If two stations reach zero in the same slot they collide, nobody gets an acknowledgement, and each doubles its window (15, 31, 63 ... up to 1023) before trying again; after a success the window goes back to aCWmin. This simulation keeps every station saturated and ignores the interframe spaces, acknowledgements and the capture effect, so it shows the trend rather than exact numbers. The curve shows why a busy channel with many stations loses a growing share of its time to collisions and idle backoff.';
		}
		draw();
	};

	/* =====================================================================
	 * Airtime: why 54 Mbit/s is not 54 Mbit/s
	 * ===================================================================== */
	var OFDM_R = { 6: 24, 9: 36, 12: 48, 18: 72, 24: 96, 36: 144, 48: 192, 54: 216 };
	window.WifiLabModels.airtime = function (root) {
		var RATES = [['1 Mbit/s (DSSS)', 'd1'], ['2 Mbit/s (DSSS)', 'd2'], ['5.5 Mbit/s (CCK)', 'd5.5'], ['11 Mbit/s (CCK)', 'd11'], ['6 Mbit/s (OFDM)', 'o6'], ['12 Mbit/s (OFDM)', 'o12'], ['24 Mbit/s (OFDM)', 'o24'], ['36 Mbit/s (OFDM)', 'o36'], ['54 Mbit/s (OFDM)', 'o54']];
		var st = { r: 'o54', pay: 1500 };
		var sel = el('select', { 'aria-label': 'Data rate' }); RATES.forEach(function (r) { sel.append(el('option', { value: r[1], text: r[0] })); }); sel.value = st.r; sel.addEventListener('change', function () { st.r = sel.value; draw(); });
		var controls = el('div', { class: 'lab-controls' }, [ctl('Data rate of the frame', sel), slider('Payload', 100, 1500, 100, st.pay, function (v) { return v + ' bytes'; }, function (v) { st.pay = v; draw(); })]);
		var stage = el('div', { class: 'lab-stage' });
		var roT = readout('', 'real throughput of this one station', 'good'), roE = readout('', 'of the data rate actually delivered'), roD = readout('', 'airtime for each frame');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roT, roE, roD]), note);
		function calc() {
			var kind = st.r[0], rate = Number(st.r.slice(1)), Lb = st.pay + 28, o = {};
			if (kind === 'o') {
				var ndbps = OFDM_R[rate], ackRate = rate >= 24 ? 24 : (rate >= 12 ? 12 : 6), ackN = OFDM_R[ackRate];
				o.difs = 34; o.bo = 7.5 * 9; o.pre = 20; o.data = 4 * Math.ceil((16 + 8 * Lb + 6) / ndbps); o.sifs = 16; o.ack = 20 + 4 * Math.ceil((16 + 8 * 14 + 6) / ackN);
				o.ackNote = 'acknowledgement sent at ' + ackRate + ' Mbit/s';
			} else {
				var ackR = rate >= 2 ? 2 : 1;
				o.difs = 50; o.bo = 15.5 * 20; o.pre = 192; o.data = Math.ceil(8 * Lb / rate); o.sifs = 10; o.ack = 192 + Math.ceil(8 * 14 / ackR);
				o.ackNote = 'long preamble, acknowledgement sent at ' + ackR + ' Mbit/s';
			}
			o.total = o.difs + o.bo + o.pre + o.data + o.sifs + o.ack; o.rate = rate; return o;
		}
		function draw() {
			var o = calc(), W = 1000, H = 150, x0 = 20, sc = 960 / o.total, x = x0, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Time spent on one frame: waiting, preamble, data, interframe space and acknowledgement' });
			var parts = [['DIFS', o.difs, 'is-warn'], ['Backoff (average)', o.bo, 'is-warn'], ['Preamble', o.pre, 'is-bad'], ['Data', o.data, 'is-good'], ['SIFS', o.sifs, 'is-warn'], ['Ack', o.ack, 'is-bad']];
			parts.forEach(function (p, i) {
				var w = p[1] * sc; s.append(svg('rect', { x: x, y: 20, width: Math.max(1, w - 2), height: 56, rx: 3, class: 'lab-bar ' + p[2], style: 'opacity:.8' }));
				if (w > 40) { text(s, x + w / 2 - 1, 44, p[0], 'lab-tick lab-tick--f', 'middle'); text(s, x + w / 2 - 1, 62, fmt(p[1], 0) + ' µs', 'lab-tick', 'middle'); }
				else { text(s, x + w / 2, 94 + (i % 3) * 16, p[0] + ' ' + fmt(p[1], 0), 'lab-tick', 'middle'); }
				x += w;
			});
			text(s, x0, 142, 'One frame, start to finish: ' + fmt(o.total, 0) + ' µs. Green is the only part that carries your data.', 'lab-tick');
			stage.replaceChildren(s);
			var tp = 8 * st.pay / o.total; roT.set(fmt(tp, 1) + ' Mbit/s'); roE.set(fmt(tp / o.rate * 100, 0) + '%', tp / o.rate < 0.4 ? 'bad' : 'warn'); roD.set(fmt(o.total, 0) + ' µs');
			note.textContent = 'For every frame the station waits a DIFS (SIFS + 2 slots) and an average backoff, sends a preamble that always uses the slow base rate, sends the data, waits a SIFS and receives an acknowledgement (' + o.ackNote + '). A MAC header and FCS add 28 bytes to the payload. Interframe spaces and slot times come from the PHY: DSSS / CCK has SIFS 10 µs, slot 20 µs and aCWmin 31; OFDM at 20 MHz has SIFS 16 µs, slot 9 µs and aCWmin 15. Fixed overheads stay the same while the data part shrinks as the rate rises, which is why faster rates deliver a smaller share of their headline speed and why small packets are the most wasteful. This ignores retries, RTS/CTS and frame aggregation (introduced to fight exactly this overhead).';
		}
		draw();
	};

	/* =====================================================================
	 * Generations explorer
	 * ===================================================================== */
	var GENS = [
		{ id: 'b', name: '802.11b', brand: '', year: 1999, bands: '2.4 GHz', wf: 'DSSS / CCK', width: '22 MHz', mod: 'DBPSK, DQPSK, CCK', ss: 1, rate: 11, calc: 'Specified: 1, 2, 5.5 and 11 Mbit/s', feats: ['CCK'] },
		{ id: 'a', name: '802.11a', brand: '', year: 1999, bands: '5 GHz', wf: 'OFDM', width: '20 MHz', mod: 'BPSK to 64-QAM', ss: 1, rate: 54, calc: '48 x 6 bits x 3/4 / 4 µs', feats: ['OFDM'] },
		{ id: 'g', name: '802.11g', brand: '', year: 2003, bands: '2.4 GHz', wf: 'ERP-OFDM (and DSSS / CCK)', width: '20 MHz', mod: 'BPSK to 64-QAM', ss: 1, rate: 54, calc: '48 x 6 bits x 3/4 / 4 µs', feats: ['OFDM'] },
		{ id: 'n', name: '802.11n', brand: 'Wi-Fi 4', year: 2009, bands: '2.4 and 5 GHz', wf: 'HT: OFDM with MIMO', width: '20 and 40 MHz', mod: 'up to 64-QAM', ss: 4, rate: 600, calc: '108 x 6 bits x 5/6 x 4 streams / 3.6 µs (40 MHz, short guard interval)', feats: ['OFDM', 'MIMO', 'Frame aggregation'] },
		{ id: 'ac', name: '802.11ac', brand: 'Wi-Fi 5', year: 2013, bands: '5 GHz', wf: 'VHT: OFDM', width: '20 to 160 MHz', mod: 'up to 256-QAM', ss: 8, rate: 6933.3, calc: '468 x 8 bits x 5/6 x 8 streams / 3.6 µs (160 MHz, short guard interval)', feats: ['OFDM', 'MIMO', 'Wider than 40 MHz', 'Multi-user MIMO'] },
		{ id: 'ax', name: '802.11ax', brand: 'Wi-Fi 6 and 6E', year: 2021, bands: '2.4, 5 and 6 GHz', wf: 'HE: OFDM and OFDMA', width: '20 to 160 MHz', mod: 'up to 1024-QAM', ss: 8, rate: 9607.8, calc: '1960 x 10 bits x 5/6 x 8 streams / 13.6 µs (160 MHz)', feats: ['OFDM', 'MIMO', 'Wider than 40 MHz', 'Multi-user MIMO', 'OFDMA', '6 GHz'] },
		{ id: 'be', name: '802.11be', brand: 'Wi-Fi 7', year: 2024, bands: '2.4, 5 and 6 GHz', wf: 'EHT: OFDM and OFDMA', width: '20 to 320 MHz', mod: 'up to 4096-QAM', ss: 16, rate: 46117.6, calc: '3920 x 12 bits x 5/6 x 16 streams / 13.6 µs (320 MHz)', feats: ['OFDM', 'MIMO', 'Wider than 40 MHz', 'Multi-user MIMO', 'OFDMA', '6 GHz', 'Multi-Link Operation'] }
	];
	var GEN_NOTES = {
		b: 'Raised DSSS speeds to 11 Mbit/s with CCK in the same 22 MHz channel. The first mass-market Wi-Fi.',
		a: 'The first OFDM Wi-Fi, in 5 GHz. Little used at first because 5 GHz radios were expensive.',
		g: 'Brought OFDM to 2.4 GHz while staying compatible with 802.11b, which costs airtime through protection mechanisms.',
		n: 'Added MIMO (up to 4 streams), 40 MHz channels and frame aggregation, and the first dual-band products.',
		ac: 'A 5 GHz generation: wider channels, 256-QAM and downlink multi-user MIMO. Run on the same OFDM design as 802.11n.',
		ax: 'Designed for crowded places: OFDMA shares a transmission between clients, longer symbols, BSS colouring and target wake time. 6 GHz arrived as Wi-Fi 6E.',
		be: 'More of everything: 320 MHz channels in 6 GHz, 4096-QAM, 16 streams, multi-RU and puncturing around interference, and multi-link operation across bands.'
	};
	window.WifiLabModels.generations = function (root) {
		var FEATS = ['OFDM', 'MIMO', 'Wider than 40 MHz', 'Multi-user MIMO', 'OFDMA', '6 GHz', 'Multi-Link Operation'];
		var st = { g: 'ax', f: '' };
		var chips = el('div', { class: 'lab-seg', role: 'group', 'aria-label': 'Show the generations that have' });
		FEATS.forEach(function (f) { var b = el('button', { type: 'button', 'aria-pressed': 'false', text: f }); b.addEventListener('click', function () { st.f = st.f === f ? '' : f; draw(); }); chips.append(b); });
		var controls = el('div', { class: 'lab-controls' }, [ctl('Which generations have...', chips)]);
		var list = el('div', { class: 'lab-gens' }), card = el('div', { class: 'lab-panel' }), stage = el('div', { class: 'lab-stage' });
		var note = el('p', { class: 'lab-note' });
		root.append(controls, list, card, stage, note);
		function draw() {
			Array.prototype.forEach.call(chips.children, function (b) { b.setAttribute('aria-pressed', String(b.textContent === st.f)); });
			list.replaceChildren.apply(list, GENS.map(function (g) {
				var has = !st.f || g.feats.indexOf(st.f) >= 0;
				var b = el('button', { type: 'button', class: 'lab-gen' + (g.id === st.g ? ' is-on' : '') + (has ? '' : ' is-dim'), 'aria-pressed': String(g.id === st.g) }, [el('b', { text: g.name }), el('span', { text: g.brand || String(g.year) })]);
				b.addEventListener('click', function () { st.g = g.id; draw(); }); return b;
			}));
			var g = GENS.filter(function (x) { return x.id === st.g; })[0];
			card.replaceChildren(el('h3', { class: 'lab-rules__t', text: g.name + (g.brand ? ' (' + g.brand + ')' : '') + ', approved ' + g.year }), el('p', { text: GEN_NOTES[g.id] }),
				table(['Property', 'Value'], [['Bands', g.bands], ['Waveform', g.wf], ['Channel widths', g.width], ['Modulation', g.mod], ['Most spatial streams', String(g.ss)], ['Highest data rate', (g.rate >= 1000 ? fmt(g.rate / 1000, 1) + ' Gbit/s' : fmt(g.rate, 0) + ' Mbit/s') + ' (' + g.calc + ')']]));
			var W = 1000, H = 240, x0 = 120, x1 = 940, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Highest data rate of each generation on a logarithmic scale' });
			var lmin = Math.log10(5), lmax = Math.log10(60000);
			GENS.forEach(function (x, i) {
				var y = 10 + i * 31, w = (Math.log10(x.rate) - lmin) / (lmax - lmin) * (x1 - x0), on = x.id === st.g, has = !st.f || x.feats.indexOf(st.f) >= 0;
				text(s, x0 - 8, y + 18, x.name, on ? 'lab-tick lab-tick--f' : 'lab-tick', 'end');
				s.append(svg('rect', { x: x0, y: y, width: w, height: 24, rx: 4, class: 'lab-bar ' + (on ? 'is-good' : 'is-warn'), style: 'opacity:' + (has ? (on ? .9 : .5) : .12) }));
				text(s, x0 + w + 8, y + 18, x.rate >= 1000 ? fmt(x.rate / 1000, 1) + ' Gbit/s' : fmt(x.rate, 0) + ' Mbit/s', 'lab-tick lab-tick--f');
			});
			stage.replaceChildren(s);
			note.textContent = 'Highest data rate = data subcarriers x bits per subcarrier x coding rate x streams / symbol time, with the widest channel, the highest modulation and the most streams the generation allows. These are theoretical link rates at the physical layer; real throughput is a fraction of them (see the airtime model above) and almost no client has the maximum number of antennas. The bars use a logarithmic scale because the rates span four orders of magnitude. Wi-Fi 4, 5, 6 and 7 are Wi-Fi Alliance names; the older generations have no official brand.';
		}
		draw();
	};

	/* =====================================================================
	 * Association and security: the connection sequence
	 * ===================================================================== */
	window.WifiLabModels.assoc = function (root) {
		var MODES = { wpa2: 'WPA2-Personal', wpa3: 'WPA3-Personal', ent: 'WPA2/WPA3-Enterprise', open: 'Open (no encryption)' };
		var st = { mode: 'wpa2', step: 0 };
		function steps() {
			var s = [
				{ t: 'Discover the network', f: [['Beacon', 'AP', 'all'], ['Probe Request', 'STA', 'all'], ['Probe Response', 'AP', 'STA']], d: 'The access point announces itself in Beacon frames (every 100 time units, 102.4 ms, by default). A client can also ask with a Probe Request. These carry the SSID, supported rates, capabilities and, for secured networks, the security settings (the RSN element).', w: 'wlan.fc.type_subtype == 0x0008 (Beacon), 0x0004 (Probe Request), 0x0005 (Probe Response)', x: 'The client never sees the SSID: check the channel the client is scanning, hidden SSIDs, and whether the AP supports the client’s band.' },
				{ t: st.mode === 'wpa3' ? 'Authenticate with SAE' : 'Authenticate (open system)', f: st.mode === 'wpa3' ? [['Authentication (SAE commit)', 'STA', 'AP'], ['Authentication (SAE commit)', 'AP', 'STA'], ['Authentication (SAE confirm)', 'STA', 'AP'], ['Authentication (SAE confirm)', 'AP', 'STA']] : [['Authentication', 'STA', 'AP'], ['Authentication', 'AP', 'STA']], d: st.mode === 'wpa3' ? 'In WPA3-Personal the password is proved with Simultaneous Authentication of Equals (SAE), carried in Authentication frames. Both sides end up with the same pairwise master key without the password or a hash of it crossing the air, so a captured exchange cannot be attacked offline.' : '"Open system" authentication in 802.11 is only a formality: two frames that say hello. It does not prove who you are. The real security comes later.', w: 'wlan.fc.type_subtype == 0x000b', x: 'An Authentication response with a non-zero status code means the AP refused the client before any security is attempted.' },
				{ t: 'Associate', f: [['Association Request', 'STA', 'AP'], ['Association Response', 'AP', 'STA']], d: 'The client says which rates and features it supports (HT, VHT, HE, EHT capabilities, the security it will use). The AP replies with a status code (0 is success) and an association ID. A client moving to another access point sends a Reassociation Request instead.', w: 'wlan.fc.type_subtype == 0x0000 (Association Request), 0x0001 (Association Response), 0x0002 and 0x0003 for reassociation', x: 'A non-zero status code in the response says why the AP said no, for example because of mismatched capabilities or security settings.' }
			];
			if (st.mode === 'ent') { s.push({ t: 'Authenticate the user (802.1X / EAP)', f: [['EAP Request (identity)', 'AP', 'STA'], ['EAP Response + TLS messages', 'STA', 'AP'], ['EAP Success', 'AP', 'STA']], d: 'In an enterprise network the AP passes EAP messages between the client and a RADIUS server, which checks the user’s credentials or certificate. When it succeeds, the server hands the AP the master key for this client. Failures here are usually certificate or server-name problems on the client.', w: 'eap or eapol', x: 'An EAP Failure, or the exchange stopping half way, points at the server, the certificate or the credentials rather than at Wi-Fi.' }); }
			if (st.mode !== 'open') { s.push({ t: 'Four-way handshake', f: [['EAPOL message 1 (AP nonce)', 'AP', 'STA'], ['EAPOL message 2 (client nonce + MIC)', 'STA', 'AP'], ['EAPOL message 3 (group key + MIC)', 'AP', 'STA'], ['EAPOL message 4 (confirm)', 'STA', 'AP']], d: 'Both sides know the pairwise master key. Each adds a random number (a nonce), and both compute the same pairwise transient key from the master key, the two nonces and both MAC addresses, so the key itself is never sent. The message integrity code (MIC) in messages 2 to 4 proves each side holds the right key; message 3 delivers the group key for broadcast traffic.', w: 'eapol', x: 'A wrong password shows up here: the AP repeats message 1 or 3, then deauthenticates the client. Reason code 15 (4-way handshake timeout) is the classic sign.' }); }
			s.push({ t: 'Data', f: [['Encrypted data frames', 'STA', 'AP']], d: st.mode === 'open' ? 'The client is connected but nothing is encrypted: anyone nearby can read the traffic. (Enhanced Open, or OWE, adds encryption to open networks.)' : 'Data frames are now encrypted with the keys from the handshake (AES in CCMP mode for WPA2; GCMP is also used by newer standards). The 6 GHz band requires WPA3 or Enhanced Open and protected management frames.', w: 'wlan.fc.protected == 1', x: 'Frames that stop here, or a Deauthentication (type/subtype 0x000c) or Disassociation (0x000a) with a reason code, show where and why the connection ended. Reason 3 means the sender is leaving, 4 inactivity, 2 previous authentication no longer valid.' });
			return s;
		}
		var controls = el('div', { class: 'lab-controls' }, [ctl('Network security', seg('Network security', Object.keys(MODES).map(function (k) { return [k, MODES[k]]; }), st.mode, function (v) { st.mode = v; st.step = 0; draw(); }))]);
		var stage = el('div', { class: 'lab-stage' }), card = el('div', { class: 'lab-panel' }), nav = el('div', { class: 'lab-ctl' });
		root.append(controls, nav, stage, card);
		function draw() {
			var S = steps(); if (st.step >= S.length) { st.step = 0; }
			nav.replaceChildren(el('span', { class: 'lab-ctl__t', text: 'Step through the connection' }), seg('Step', S.map(function (x, i) { return [i, (i + 1) + '. ' + x.t]; }), st.step, function (v) { st.step = Number(v); draw(); }));
			var W = 1000, rowH = 34, cur = S[st.step], H = 70 + Math.max(cur.f.length, 1) * rowH, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Frames exchanged in step ' + (st.step + 1) + ': ' + cur.t });
			[200, 800].forEach(function (x, i) { s.append(svg('line', { x1: x, y1: 36, x2: x, y2: H - 6, class: 'lab-axis', 'stroke-dasharray': '4 4' })); text(s, x, 22, i ? 'Access point' : 'Client (STA)', 'lab-tick lab-tick--f', 'middle'); });
			cur.f.forEach(function (fr, i) {
				var y = 62 + i * rowH, fromSTA = fr[1] === 'STA' || (fr[1] === 'all'), x1 = fromSTA ? 200 : 800, x2 = fromSTA ? 800 : 200;
				if (fr[1] === 'AP' && fr[2] === 'all') { x1 = 800; x2 = 200; }
				s.append(svg('line', { x1: x1, y1: y, x2: x2 + (x2 > x1 ? -8 : 8), y2: y, stroke: 'var(--wp--preset--color--brand)', 'stroke-width': 3 }));
				s.append(svg('path', { d: 'M' + x2 + ' ' + y + ' L' + (x2 + (x2 > x1 ? -12 : 12)) + ' ' + (y - 6) + ' L' + (x2 + (x2 > x1 ? -12 : 12)) + ' ' + (y + 6) + ' Z', fill: 'var(--wp--preset--color--brand)' }));
				text(s, 500, y - 7, fr[0], 'lab-tick lab-tick--f', 'middle');
			});
			stage.replaceChildren(s);
			card.replaceChildren(el('h3', { class: 'lab-rules__t', text: (st.step + 1) + '. ' + cur.t }), el('p', { text: cur.d }), el('p', {}, [el('strong', { text: 'Wireshark filter: ' }), el('code', { text: cur.w })]), el('p', {}, [el('strong', { text: 'When it fails: ' }), document.createTextNode(cur.x)]));
		}
		draw();
	};

	/* =====================================================================
	 * Roaming and sticky clients
	 * ===================================================================== */
	window.WifiLabModels.roaming = function (root) {
		var st = { D: 40, thr: -70, hyst: 8, x: 5, n: 3 };
		var timer = null;
		var play = el('button', { type: 'button', class: 'lab-net__b', text: 'Walk the corridor' });
		var controls = el('div', { class: 'lab-controls' }, [
			slider('Distance between the two access points', 20, 80, 5, st.D, function (v) { return v + ' m'; }, function (v) { st.D = v; if (st.x > v) { st.x = v; } draw(); }),
			slider('Client roams when its signal falls below', -85, -60, 1, st.thr, function (v) { return v + ' dBm'; }, function (v) { st.thr = v; draw(); }),
			slider('and the other access point is stronger by', 3, 15, 1, st.hyst, function (v) { return v + ' dB'; }, function (v) { st.hyst = v; draw(); }),
			(function () { var sl = slider('Client position', 0, 80, 1, st.x, function (v) { return v + ' m'; }, function (v) { st.x = Math.min(v, st.D); draw(); }); sl.setAttribute('data-pos', '1'); return sl; })(), el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Animate' }), play])]);
		var stage = el('div', { class: 'lab-stage' });
		var roA = readout('', 'client is on'), roR = readout('', 'client roams at'), roS = readout('', 'beyond the halfway point (stuck on the farther AP)');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roA, roR, roS]), note);
		function rssi(d) { return 20 - (20 * Math.log10(5500) - 27.55 + 30 * Math.log10(Math.max(d, 1))); } // 20 dBm EIRP, 5 GHz, n = 3, no walls
		function s1(x) { return rssi(x); } function s2(x) { return rssi(st.D - x); }
		function assocAt(x, prev) { // walking left to right: stay until below threshold and the other AP is stronger by the margin
			var cur = prev; if (cur === 1 && s1(x) < st.thr && s2(x) > s1(x) + st.hyst) { cur = 2; } return cur;
		}
		function roamPoint() { var cur = 1; for (var x = 0; x <= st.D; x += 0.25) { var n = assocAt(x, cur); if (n !== cur) { return x; } cur = n; } return null; }
		function draw() {
			var rp = roamPoint(), cur = 1; for (var x = 0; x <= st.x; x += 0.25) { cur = assocAt(x, cur); }
			var W = 1000, H = 300, x0 = 70, x1 = 930, yT = 20, yB = 240, lo = -100, hi = -20;
			function X(v) { return x0 + v / st.D * (x1 - x0); } function Y(v) { return yT + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (yB - yT); }
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Signal from two access points along a corridor' });
			for (var v = lo; v <= hi; v += 20) { s.append(svg('line', { x1: x0, y1: Y(v), x2: x1, y2: Y(v), class: 'lab-axis', opacity: .45 })); text(s, x0 - 8, Y(v) + 4, String(v), 'lab-tick', 'end'); }
			text(s, x0 - 8, yT - 6, 'dBm', 'lab-tick', 'end');
			[[s1, 'AP 1', 'is-on'], [s2, 'AP 2', '']].forEach(function (c, i) { var d = ''; for (var k = 0; k <= 120; k++) { var xx = k / 120 * st.D; d += (k ? 'L' : 'M') + X(xx).toFixed(1) + ' ' + Y(c[0](xx)).toFixed(1); } s.append(svg('path', { d: d, class: 'lab-wave ' + c[2], style: i ? 'stroke:var(--wp--preset--color--accent);opacity:.9;stroke-width:3' : '' })); });
			text(s, x0 + 6, Y(s1(0.5)) + 16, 'AP 1', 'lab-tick lab-tick--f'); text(s, x1 - 6, Y(s2(st.D - 0.5)) + 16, 'AP 2', 'lab-tick lab-tick--f', 'end');
			s.append(svg('line', { x1: x0, y1: Y(st.thr), x2: x1, y2: Y(st.thr), class: 'lab-ov-edge' })); text(s, x1, Y(st.thr) - 6, 'roaming threshold ' + st.thr + ' dBm', 'lab-tick', 'end');
			s.append(svg('line', { x1: X(st.D / 2), y1: yT, x2: X(st.D / 2), y2: yB, class: 'lab-axis', 'stroke-dasharray': '3 6' })); text(s, X(st.D / 2), yT + 12, 'halfway', 'lab-tick', 'middle');
			if (rp !== null) { s.append(svg('circle', { cx: X(rp), cy: Y(s1(rp)), r: 7, fill: 'var(--wp--preset--color--accent)' })); text(s, X(rp), yB + 26, 'roams here', 'lab-tick lab-tick--f', 'middle'); }
			s.append(svg('line', { x1: X(st.x), y1: yT, x2: X(st.x), y2: yB, stroke: cur === 1 ? 'var(--wp--preset--color--brand)' : 'var(--wp--preset--color--accent)', 'stroke-width': 3 }));
			s.append(svg('circle', { cx: X(st.x), cy: yB + 4, r: 9, fill: cur === 1 ? 'var(--wp--preset--color--brand)' : 'var(--wp--preset--color--accent)' }));
			stage.replaceChildren(s);
			roA.set(cur === 1 ? 'AP 1 at ' + fmt(s1(st.x), 0) + ' dBm' : 'AP 2 at ' + fmt(s2(st.x), 0) + ' dBm', cur === 1 && s2(st.x) > s1(st.x) + 10 ? 'bad' : 'good');
			roR.set(rp === null ? 'never (stays on AP 1)' : fmt(rp, 1) + ' m, at ' + fmt(s1(rp), 0) + ' dBm', rp === null ? 'bad' : '');
			var stuck = rp === null ? st.D / 2 : Math.max(0, rp - st.D / 2); roS.set(fmt(stuck, 1) + ' m', stuck > 3 ? 'bad' : 'good');
			note.textContent = 'A client decides for itself when to roam: the access point cannot move it (it can only suggest). A typical client stays where it is until the current signal is poor, so on the walk from AP 1 to AP 2 it keeps its first access point long after the second one is stronger: the sticky client. A higher threshold makes it leave earlier. Standards help it decide: 802.11k lets the AP give the client a list of neighbouring access points, 802.11v lets the AP suggest a better one (BSS transition management), and 802.11r (fast BSS transition) lets the client set up its keys with the next AP before it moves, so the handover is quick. The signal model here is free-space loss at 5 GHz with a path-loss exponent of 3 and 20 dBm EIRP; the thresholds and margins are illustrative.';
		}
		play.addEventListener('click', function () {
			if (timer) { clearInterval(timer); timer = null; play.textContent = 'Walk the corridor'; return; }
			if (RM) { st.x = st.x >= st.D ? 0 : Math.min(st.D, st.x + st.D / 8); syncPos(); draw(); return; }
			st.x = 0; play.textContent = 'Stop';
			timer = setInterval(function () { st.x += st.D / 120; if (st.x >= st.D) { st.x = st.D; clearInterval(timer); timer = null; play.textContent = 'Walk the corridor'; } syncPos(); draw(); }, 60);
		});
		function syncPos() { var sl = controls.querySelector('[data-pos]'); if (sl && sl.set) { sl.set(Math.round(st.x)); } }
		draw();
	};

	/* =====================================================================
	 * Coexistence in 2.4 GHz
	 * ===================================================================== */
	window.WifiLabModels.coexist = function (root) {
		var st = { bt: true, mw: false, zb: 25, wifi: [1, 6, 11] };
		var zbSeg = seg('ZigBee channel', [11, 15, 20, 25, 26].map(function (c) { return [c, String(c)]; }), st.zb, function (v) { st.zb = Number(v); draw(); });
		var tog = function (label, key) { var b = el('button', { type: 'button', 'aria-pressed': String(st[key]), text: label }); b.addEventListener('click', function () { st[key] = !st[key]; b.setAttribute('aria-pressed', String(st[key])); draw(); }); return el('div', { class: 'lab-seg' }, [b]); };
		var controls = el('div', { class: 'lab-controls' }, [ctl('Bluetooth (79 hopping channels)', tog('Show Bluetooth', 'bt')), ctl('Microwave oven (broad noise)', tog('Show microwave oven', 'mw')), ctl('802.15.4 / ZigBee channel (2 MHz wide)', zbSeg)]);
		var stage = el('div', { class: 'lab-stage' });
		var roZ = readout('', 'ZigBee channel centre'), roO = readout('', 'ZigBee sits inside Wi-Fi channel'), roB = readout('', 'Bluetooth channels inside Wi-Fi channel 6');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roZ, roO, roB]), note);
		function draw() {
			var W = 1000, H = 300, x0 = 30, x1 = 970, fmin = 2395, fmax = 2495, yb = 240;
			function X(f) { return x0 + (f - fmin) / (fmax - fmin) * (x1 - x0); }
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Wi-Fi channels 1, 6 and 11 with Bluetooth, ZigBee and microwave oven energy in the 2.4 GHz band' });
			s.append(svg('line', { x1: x0, y1: yb, x2: x1, y2: yb, class: 'lab-axis' }));
			for (var f = 2400; f <= 2480; f += 20) { text(s, X(f), yb + 22, String(f), 'lab-tick', 'middle'); }
			text(s, x1, yb + 42, 'MHz', 'lab-tick', 'end');
			if (st.mw) { s.append(svg('rect', { x: X(2430), y: 70, width: X(2490) - X(2430), height: yb - 70, fill: '#e03131', opacity: .18 })); text(s, X(2460), 86, 'microwave oven: broad noise, varies by oven', 'lab-tick lab-tick--f', 'middle'); }
			st.wifi.forEach(function (c) { var fc = 2407 + 5 * c, xl = X(fc - 10), xr = X(fc + 10), xc = X(fc), hw = (xr - xl) / 2, peak = 110; s.append(svg('path', { d: 'M' + xl + ' ' + yb + ' C' + (xl + .42 * hw) + ' ' + yb + ' ' + (xc - .5 * hw) + ' ' + peak + ' ' + xc + ' ' + peak + ' C' + (xc + .5 * hw) + ' ' + peak + ' ' + (xr - .42 * hw) + ' ' + yb + ' ' + xr + ' ' + yb + 'Z', class: 'lab-ov-bell is-sel', style: 'cursor:default;opacity:.55' })); text(s, xc, peak - 8, 'Wi-Fi ' + c, 'lab-tick lab-tick--f', 'middle'); });
			if (st.bt) { for (var k = 0; k < 79; k++) { var fb = 2402 + k; s.append(svg('rect', { x: X(fb) - 1.5, y: yb - 40, width: 3, height: 40, fill: 'var(--wp--preset--color--brand)', opacity: .7 })); } text(s, x0, yb + 42, 'Bluetooth: 79 channels of 1 MHz, hopping (the thin lines)', 'lab-tick lab-tick--f'); }
			var zf = 2405 + 5 * (st.zb - 11); s.append(svg('rect', { x: X(zf - 1), y: yb - 90, width: X(zf + 1) - X(zf - 1), height: 90, fill: 'var(--wp--preset--color--navy)', opacity: .85 })); text(s, X(zf), yb - 96, 'ZigBee ' + st.zb, 'lab-tick lab-tick--f', 'middle');
			stage.replaceChildren(s);
			var inside = st.wifi.filter(function (c) { var fc = 2407 + 5 * c; return zf - 1 >= fc - 10 && zf + 1 <= fc + 10; });
			var btIn = 0; for (var j = 0; j < 79; j++) { var fq = 2402 + j; if (fq >= 2427 && fq <= 2447) { btIn++; } }
			roZ.set(zf + ' MHz'); roO.set(inside.length ? 'channel ' + inside.join(', ') : 'none of 1, 6, 11', inside.length ? 'bad' : 'good'); roB.set(btIn + ' of 79');
			note.textContent = 'ZigBee (IEEE 802.15.4) channels 11 to 26 sit at 2405 + 5 x (channel - 11) MHz and are only 2 MHz wide, so channels 15, 20, 25 and 26 fall in the gaps between Wi-Fi channels 1, 6 and 11. Bluetooth hops across 79 channels of 1 MHz; with adaptive frequency hopping it marks channels used by Wi-Fi as bad and skips them, but it needs at least 20 channels to stay in service. A microwave oven leaks broad, strongly varying noise mostly in the upper part of the band, which is why a kitchen can hurt channel 11 but rarely channel 1. Wi-Fi treats other Wi-Fi and other noise differently: it defers to another Wi-Fi signal it can decode at -82 dBm (20 MHz channels), but non-Wi-Fi energy only blocks it when it is stronger than -62 dBm.';
		}
		draw();
	};

	/* =====================================================================
	 * Hidden node
	 * ===================================================================== */
	window.WifiLabModels.hidden = function (root) {
		var st = { gap: 70, range: 50, rts: false };
		var controls = el('div', { class: 'lab-controls' }, [slider('Distance between the two clients', 20, 120, 5, st.gap, function (v) { return v + ' m'; }, function (v) { st.gap = v; draw(); }), slider('How far a client’s signal is heard', 20, 100, 5, st.range, function (v) { return v + ' m'; }, function (v) { st.range = v; draw(); }),
			ctl('Protection', seg('RTS/CTS', [['off', 'RTS/CTS off'], ['on', 'RTS/CTS on']], 'off', function (v) { st.rts = v === 'on'; draw(); }))]);
		var stage = el('div', { class: 'lab-stage' });
		var roH = readout('', 'client A and client B'), roAP = readout('', 'access point hears both');
		var verdict = el('p', { class: 'lab-verdict', 'aria-live': 'polite' });
		root.append(controls, stage, verdict, el('div', { class: 'lab-reads' }, [roH, roAP]));
		function draw() {
			var W = 1000, H = 260, sc = Math.min(8, 300 / (st.gap / 2 + st.range)), cx = 500, cy = 130, a = cx - st.gap / 2 * sc, b = cx + st.gap / 2 * sc, r = st.range * sc;
			var hear = st.gap <= st.range, apHearsA = st.gap / 2 <= st.range;
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Two clients and an access point in between with their signal ranges' });
			[[a, 'A', '#1c7ed6'], [b, 'B', '#e8590c']].forEach(function (c) { s.append(svg('circle', { cx: c[0], cy: cy, r: r, fill: c[2], opacity: .12, stroke: c[2], 'stroke-dasharray': '4 4' })); s.append(svg('circle', { cx: c[0], cy: cy, r: 14, fill: c[2] })); text(s, c[0], cy + 5, c[1], 'lab-net-letter', 'middle'); });
			s.append(svg('rect', { x: cx - 14, y: cy - 14, width: 28, height: 28, rx: 5, fill: 'var(--wp--preset--color--ink)' })); text(s, cx, cy + 40, 'AP', 'lab-tick lab-tick--f', 'middle');
			if (st.rts && apHearsA) { s.append(svg('circle', { cx: cx, cy: cy, r: Math.max(r, st.gap / 2 * sc + 30), fill: 'none', stroke: 'var(--wp--preset--color--brand)', 'stroke-width': 3, opacity: .7 })); text(s, cx, 30, 'the AP’s CTS tells both clients to keep quiet', 'lab-tick lab-tick--f', 'middle'); }
			text(s, 10, H - 10, 'The shaded circles show how far each client’s transmissions can be heard.', 'lab-tick');
			stage.replaceChildren(s);
			roH.set(hear ? 'can hear each other' : 'cannot hear each other (hidden)', hear ? 'good' : 'bad'); roAP.set(apHearsA ? 'yes' : 'no: too far', apHearsA ? 'good' : 'bad');
			verdict.textContent = !apHearsA ? 'The clients are too far from the access point for it to hear them: this is a coverage problem, not a hidden node.' : (hear ? 'Each client hears the other, so carrier sensing works: they wait for each other and rarely collide.' : (st.rts ? 'The clients still cannot hear each other, but the access point can hear both. A short RTS from one is answered by a CTS that both clients hear, so the other one waits (its NAV timer is set) and the long frame is protected.' : 'The clients cannot hear each other, so each thinks the channel is free. Both send, and their frames collide at the access point, which hears both. Switch on RTS/CTS to see the fix.'));
		}
		draw();
	};

	/* =====================================================================
	 * SNR, noise floor and the rate a client can use
	 * ===================================================================== */
	var LADDERS = {
		og: { label: '802.11a/g, 20 MHz OFDM (Table 17-18)', rungs: [['6 Mbit/s, BPSK 1/2', -82], ['9 Mbit/s, BPSK 3/4', -81], ['12 Mbit/s, QPSK 1/2', -79], ['18 Mbit/s, QPSK 3/4', -77], ['24 Mbit/s, 16-QAM 1/2', -74], ['36 Mbit/s, 16-QAM 3/4', -70], ['48 Mbit/s, 64-QAM 2/3', -66], ['54 Mbit/s, 64-QAM 3/4', -65]] },
		vht: { label: '802.11ac, 20 MHz, one stream (Table 21-25)', rungs: [['MCS 0: 6.5 Mbit/s, BPSK 1/2', -82], ['MCS 1: 13 Mbit/s, QPSK 1/2', -79], ['MCS 2: 19.5 Mbit/s, QPSK 3/4', -77], ['MCS 3: 26 Mbit/s, 16-QAM 1/2', -74], ['MCS 4: 39 Mbit/s, 16-QAM 3/4', -70], ['MCS 5: 52 Mbit/s, 64-QAM 2/3', -66], ['MCS 6: 58.5 Mbit/s, 64-QAM 3/4', -65], ['MCS 7: 65 Mbit/s, 64-QAM 5/6', -64], ['MCS 8: 78 Mbit/s, 256-QAM 3/4', -59], ['MCS 9: 86.7 Mbit/s, 256-QAM 5/6', -57]] }
	};
	window.WifiLabModels.snr = function (root) {
		var st = { sig: -62, noise: -95, lad: 'og' };
		var controls = el('div', { class: 'lab-controls' }, [ctl('Rate ladder', seg('Rate ladder', Object.keys(LADDERS).map(function (k) { return [k, k === 'og' ? '802.11a/g' : '802.11ac']; }), st.lad, function (v) { st.lad = v; draw(); })),
			slider('Signal the client receives', -95, -30, 1, st.sig, function (v) { return v + ' dBm'; }, function (v) { st.sig = v; draw(); }),
			slider('Noise floor (noise plus interference)', -100, -70, 1, st.noise, function (v) { return v + ' dBm'; }, function (v) { st.noise = v; draw(); })]);
		var stage = el('div', { class: 'lab-stage' });
		var roSNR = readout('', 'signal-to-noise ratio'), roR = readout('', 'best rate it can hold', 'good'), roM = readout('', 'margin above that rate’s minimum');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roSNR, roR, roM]), note);
		function draw() {
			var lad = LADDERS[st.lad], shift = st.noise - (-91), best = -1, W = 1000, rowH = 24, H = 20 + lad.rungs.length * rowH + 26, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Which rates the received signal supports' });
			var lo = -95, hi = -30, x0 = 280, x1 = 960; function X(v) { return x0 + (v - lo) / (hi - lo) * (x1 - x0); }
			lad.rungs.forEach(function (r, i) {
				var need = r[1] + shift, ok = st.sig >= need; if (ok) { best = i; }
				var y = 10 + i * rowH; text(s, x0 - 8, y + 15, r[0], 'lab-tick', 'end');
				s.append(svg('rect', { x: X(lo), y: y + 2, width: Math.max(2, X(Math.max(lo, Math.min(hi, need))) - X(lo)), height: 18, rx: 3, class: 'lab-bar ' + (ok ? 'is-good' : 'is-bad'), style: 'opacity:' + (ok ? .7 : .35) }));
			});
			[-90, -70, -50, -30].forEach(function (v) { text(s, X(v), H - 2 - 0, v, 'lab-tick', 'middle'); });
			s.append(svg('line', { x1: X(st.sig), y1: 4, x2: X(st.sig), y2: H - 16, stroke: 'var(--wp--preset--color--accent)', 'stroke-width': 3 })); text(s, X(st.sig) + 8, 16, 'signal ' + st.sig + ' dBm', 'lab-tick lab-tick--f');
			stage.replaceChildren(s);
			var snr = st.sig - st.noise; roSNR.set(snr + ' dB', snr < 10 ? 'bad' : (snr < 25 ? 'warn' : 'good'));
			roR.set(best < 0 ? 'none: out of range' : lad.rungs[best][0].split(',')[0], best < 0 ? 'bad' : 'good'); roM.set(best < 0 ? '–' : fmt(st.sig - (lad.rungs[best][1] + shift), 0) + ' dB');
			note.textContent = 'Each bar is the weakest signal at which that rate is guaranteed to work, from ' + lad.label + '. The standard’s figures assume a receiver noise figure of 10 dB and a 5 dB implementation margin, which is about a -91 dBm noise floor in a 20 MHz channel (thermal noise is -174 dBm/Hz + 10 log10(20 MHz) = -101 dBm). If your noise floor is higher because of interference, each rate needs a stronger signal by the same amount, and if it is lower they need less: that is the shift applied here. The lesson for measurement: a strong signal does not guarantee a fast link if the noise floor is high, and signal strength readings differ between vendors, so judge SNR and the rate in use rather than a single RSSI number.';
		}
		draw();
	};

	/* =====================================================================
	 * QoE: does the link meet the need?
	 * ===================================================================== */
	window.WifiLabModels.qoe = function (root) {
		var st = { tp: 80, lat: 25, jit: 8, loss: 0.3 };
		var APPS = [
			['Web browsing and email', 5, 150, 100, 2],
			['HD video call', 4, 150, 30, 1],
			['4K video streaming', 25, 300, 100, 2],
			['Online gaming', 5, 50, 15, 1],
			['Large file backup or download', 50, 300, 100, 2]
		];
		var controls = el('div', { class: 'lab-controls' }, [slider('Measured throughput', 1, 500, 1, st.tp, function (v) { return v + ' Mbit/s'; }, function (v) { st.tp = v; draw(); }), slider('Latency (round trip)', 1, 300, 1, st.lat, function (v) { return v + ' ms'; }, function (v) { st.lat = v; draw(); }), slider('Jitter', 0, 100, 1, st.jit, function (v) { return v + ' ms'; }, function (v) { st.jit = v; draw(); }), slider('Packet loss', 0, 10, 0.1, st.loss, function (v) { return fmt(v, 1) + '%'; }, function (v) { st.loss = v; draw(); })]);
		var box = el('div', { class: 'lab-stage' }), note = el('p', { class: 'lab-note' });
		root.append(controls, box, note);
		function draw() {
			var rows = APPS.map(function (a) {
				var ok = [st.tp >= a[1], st.lat <= a[2], st.jit <= a[3], st.loss <= a[4]], all = ok.every(Boolean);
				var cell = function (good, txt) { return el('td', { class: good ? 'lab-tone-good' : 'lab-tone-bad', text: (good ? '✓ ' : '✗ ') + txt }); };
				return el('tr', {}, [el('th', { scope: 'row', text: a[0] }), cell(ok[0], 'needs ' + a[1] + ' Mbit/s'), cell(ok[1], 'under ' + a[2] + ' ms'), cell(ok[2], 'under ' + a[3] + ' ms'), cell(ok[3], 'under ' + a[4] + '%'), el('td', { class: all ? 'lab-tone-good' : 'lab-tone-bad', text: all ? 'Good' : 'Not good' })]);
			});
			box.replaceChildren(el('div', { class: 'lab-tablewrap' }, [el('table', { class: 'lab-table' }, [el('thead', {}, [el('tr', {}, ['Application', 'Throughput', 'Latency', 'Jitter', 'Loss', 'Verdict'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]), el('tbody', {}, rows)])]));
			note.textContent = 'Quality of experience (QoE) is what a person feels, not what a tool reports: it depends on throughput, delay, delay variation (jitter) and loss together. The targets in this table are planning rules of thumb, not standards, and they vary by service. The one widely cited reference is ITU-T G.114, which treats one-way delay up to 150 ms as acceptable for most interactive applications. Use the sliders with your own measurements, and replace the targets with those of your application.';
		}
		draw();
	};

	/* =====================================================================
	 * Capacity: how many access points?
	 * ===================================================================== */
	window.WifiLabModels.capacity = function (root) {
		var st = { clients: 120, demand: 6, rate: 600, eff: 55, util: 50, area: 3000, per: 400 };
		var controls = el('div', { class: 'lab-controls' }, [
			slider('Clients on the floor', 10, 500, 10, st.clients, function (v) { return String(v); }, function (v) { st.clients = v; draw(); }),
			slider('Average demand per client', 0.5, 30, 0.5, st.demand, function (v) { return fmt(v, 1) + ' Mbit/s'; }, function (v) { st.demand = v; draw(); }),
			slider('Typical link rate of a client', 100, 2400, 50, st.rate, function (v) { return v + ' Mbit/s'; }, function (v) { st.rate = v; draw(); }),
			slider('Share of the link rate you really get', 30, 70, 5, st.eff, function (v) { return v + '%'; }, function (v) { st.eff = v; draw(); }),
			slider('Keep each AP no busier than', 30, 80, 5, st.util, function (v) { return v + '%'; }, function (v) { st.util = v; draw(); }),
			slider('Floor area', 500, 10000, 500, st.area, function (v) { return v + ' m²'; }, function (v) { st.area = v; draw(); }),
			slider('Area one AP covers well', 100, 1000, 50, st.per, function (v) { return v + ' m²'; }, function (v) { st.per = v; draw(); })]);
		var stage = el('div', { class: 'lab-stage' });
		var roC = readout('', 'access points needed for capacity'), roV = readout('', 'access points needed for coverage'), roN = readout('', 'plan for', 'good'), roP = readout('', 'clients per access point');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, el('div', { class: 'lab-reads' }, [roC, roV, roN, roP]), stage, note);
		function draw() {
			var demand = st.clients * st.demand, per = st.rate * st.eff / 100 * st.util / 100, nc = Math.ceil(demand / per), nv = Math.ceil(st.area / st.per), n = Math.max(nc, nv);
			roC.set(String(nc)); roV.set(String(nv)); roN.set(n + (nc > nv ? ' (capacity limits)' : (nv > nc ? ' (coverage limits)' : ' (both)')), 'good'); roP.set(fmt(st.clients / n, 0));
			var W = 1000, H = 90, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Total demand against what each access point can carry' });
			var tot = Math.max(demand, per * n); s.append(svg('rect', { x: 20, y: 14, width: 960 * demand / tot, height: 24, rx: 4, class: 'lab-bar is-warn', style: 'opacity:.8' })); text(s, 24, 31, 'Demand: ' + fmt(demand, 0) + ' Mbit/s', 'lab-tick lab-tick--f');
			s.append(svg('rect', { x: 20, y: 48, width: 960 * per * n / tot, height: 24, rx: 4, class: 'lab-bar is-good', style: 'opacity:.8' })); text(s, 24, 65, n + ' APs x ' + fmt(per, 0) + ' Mbit/s usable = ' + fmt(per * n, 0) + ' Mbit/s', 'lab-tick lab-tick--f');
			stage.replaceChildren(s);
			note.textContent = 'Capacity: total demand divided by what one access point can usefully carry, which is its link rate times the share you really get (see the airtime model: overheads take roughly half) times how busy you are willing to let it run (leaving headroom keeps latency low). Coverage: floor area divided by the area one access point serves well. You need the larger of the two. The numbers are inputs, not facts: measure the real demand and the real coverage in your building, and remember that access points on the same channel share airtime, so extra access points only add capacity if they can use different channels.';
		}
		draw();
	};

	/* =====================================================================
	 * Checklist (kept in this browser)
	 * ===================================================================== */
	window.WifiLabModels.checklist = function (root) {
		var GROUPS = [
			['Plan', ['Write down the applications, the number of clients and the areas that matter', 'Choose measurable targets (signal, SNR, throughput, latency, roaming time)', 'Check the regulatory domain and the channels and power it allows']],
			['Design', ['Predict coverage and capacity and place the access points', 'Plan channels and power so neighbouring access points do not share a channel', 'Plan the wired side: switch ports, power over Ethernet, uplink capacity']],
			['Install', ['Mount access points as designed and record where each one really is', 'Set channels, widths and power; remove unused low data rates', 'Record the firmware versions and every setting changed']],
			['Validate', ['Passive survey: signal, SNR, channel overlap and noise on every band', 'Active survey: association, throughput and retries from real devices', 'Roaming test along every route people walk', 'Capture traffic and check retry rate and rates in use', 'Re-test at busy times with the real number of clients']],
			['Hand over', ['Compare every result with the targets and explain any miss', 'Save the survey data, the capture files and a configuration backup', 'Agree when the network will be measured again']]
		];
		var key = 'wifilab-checklist', done = {};
		try { done = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { done = {}; }
		var bar = el('div', { class: 'lab-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [el('span', {})]), lab = el('p', { class: 'lab-verdict' });
		root.append(lab, bar);
		var total = 0;
		GROUPS.forEach(function (g) {
			var ul = el('ul', { class: 'lab-check' });
			g[1].forEach(function (t, i) {
				var id = g[0] + i; total++;
				var cb = el('input', { type: 'checkbox', id: 'lc-' + id }); cb.checked = !!done[id];
				cb.addEventListener('change', function () { done[id] = cb.checked; try { localStorage.setItem(key, JSON.stringify(done)); } catch (e) { /* storage blocked */ } upd(); });
				ul.append(el('li', {}, [cb, el('label', { for: 'lc-' + id, text: t })]));
			});
			root.append(el('div', { class: 'lab-panel' }, [el('h3', { class: 'lab-rules__t', text: g[0] }), ul]));
		});
		function upd() { var n = 0; Object.keys(done).forEach(function (k) { if (done[k]) { n++; } }); n = Math.min(n, total); var pct = Math.round(n / total * 100); lab.textContent = n + ' of ' + total + ' steps ticked (saved in this browser only)'; bar.firstChild.style.width = pct + '%'; bar.setAttribute('aria-valuenow', String(pct)); }
		upd();
	};
})();
