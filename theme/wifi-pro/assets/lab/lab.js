/* Wi-Fi Pro Lab: interactive models for the band lessons.
 * Mount points are <div class="lab-model" data-model="..." data-band="2.4"> created by the [wifi_lab] shortcode.
 * Every number here is either defined by the standards (channel plans, subcarrier counts, MCS tables) or
 * computed from a stated formula. Region plans follow FCC (US) and ETSI/CEPT (UK/EU) main rules; always
 * check the current regulator text for a real deployment.
 */
(function () {
	'use strict';

	var NS = 'http://www.w3.org/2000/svg';
	var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* ---------- helpers ---------- */
	function el(tag, attrs, kids) {
		var n = document.createElement(tag);
		if (attrs) { Object.keys(attrs).forEach(function (k) {
			if (k === 'class') { n.className = attrs[k]; }
			else if (k === 'text') { n.textContent = attrs[k]; }
			else if (k.slice(0, 2) === 'on') { n.addEventListener(k.slice(2), attrs[k]); }
			else { n.setAttribute(k, attrs[k]); }
		}); }
		(kids || []).forEach(function (c) { if (c) { n.append(c); } });
		return n;
	}
	function svg(tag, attrs) {
		var n = document.createElementNS(NS, tag);
		Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
		return n;
	}
	function text(parent, x, y, str, cls, anchor) { var t = svg('text', { x: x, y: y, class: cls || 'lab-tick', 'text-anchor': anchor || 'start' }); t.textContent = str; parent.append(t); return t; }
	function seg(label, options, current, onChange) {
		var wrap = el('div', { class: 'lab-seg', role: 'group', 'aria-label': label });
		options.forEach(function (o) {
			var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
			var b = el('button', { type: 'button', 'data-v': String(v), 'aria-pressed': String(String(v) === String(current)), text: String(t) });
			b.addEventListener('click', function () {
				Array.prototype.forEach.call(wrap.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
				b.setAttribute('aria-pressed', 'true');
				onChange(v);
			});
			wrap.append(b);
		});
		return wrap;
	}
	function readout(value, label, tone) {
		var v = el('span', { class: 'lab-ro__v', text: value });
		var r = el('div', { class: 'lab-ro', 'data-tone': tone || '' }, [v, el('span', { class: 'lab-ro__l', text: label })]);
		r.set = function (val, t) { v.textContent = val; r.setAttribute('data-tone', t || ''); };
		return r;
	}
	function fmt(n, d) { return Number(n).toFixed(d === undefined ? 1 : d); }

	/* =====================================================================
	 * Channel plans
	 * ===================================================================== */
	function range(a, b, step) { var o = []; for (var i = a; i <= b; i += step) { o.push(i); } return o; }

	/* ---------- Regulatory domain (UK Ofcom by default, US FCC on request) ---------- */
	var Region = (function () {
		var cur = 'uk', subs = [];
		try { var saved = localStorage.getItem('wifilab-region'); if (saved === 'us' || saved === 'uk' || saved === 'eu') { cur = saved; } } catch (e) { /* storage may be blocked */ }
		return {
			get: function () { return cur; },
			set: function (r) { if (r === cur) { return; } cur = r; try { localStorage.setItem('wifilab-region', r); } catch (e) { /* ignore */ } subs.forEach(function (f) { f(r); }); },
			on: function (f) { subs.push(f); }
		};
	})();
	var REGION_NAMES = { uk: 'UK (Ofcom)', eu: 'EU (CEPT / ETSI)', us: 'US (FCC)' };
	var REGION_ORDER = ['uk', 'eu', 'us'];
	function regionSeg() {
		var wrap = seg('Regulatory domain', REGION_ORDER.map(function (r) { return [r, REGION_NAMES[r]]; }), Region.get(), function (v) { Region.set(v); });
		Region.on(function (r) { Array.prototype.forEach.call(wrap.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === r)); }); });
		return wrap;
	}

	var PLANS = {
		'2.4': {
			label: '2.4 GHz', min: 2395, max: 2495, centre: function (c) { return 2407 + 5 * c; },
			widths: [20],
			regions: {
				uk: { 20: range(1, 13, 1), note: 'UK (Ofcom IR 2030/7/1): 2400 to 2483.5 MHz, channels 1 to 13 (channel 14 at 2484 MHz lies outside the band), 100 mW EIRP maximum. The classic non-overlapping set is 1, 6 and 11; some designs use 1, 5, 9, 13 with partial overlap.' },
				eu: { 20: range(1, 13, 1), note: 'EU (ETSI EN 300 328): 2400 to 2483.5 MHz, channels 1 to 13, 20 dBm (100 mW) EIRP maximum, the same channel plan and power as the UK.' },
				us: { 20: range(1, 11, 1), note: 'US (FCC Part 15): channels 1 to 11 only. The classic non-overlapping set is 1, 6 and 11.' }
			},
			mark: [1, 6, 11]
		},
		'5': {
			label: '5 GHz', min: 5150, max: 5850, centre: function (c) { return 5000 + 5 * c; },
			widths: [20, 40, 80, 160],
			regions: {
				uk: {
					20: [36, 40, 44, 48, 52, 56, 60, 64].concat(range(100, 144, 4), [149, 153, 157, 161, 165]),
					40: [38, 46, 54, 62, 102, 110, 118, 126, 134, 142, 151, 159],
					80: [42, 58, 106, 122, 138, 155],
					160: [50, 114],
					note: 'UK (Ofcom IR 2030): 5150 to 5250 MHz (channels 36 to 48) allows indoor and outdoor use at 200 mW EIRP, but not as part of a fixed outdoor installation. 5250 to 5350 MHz (52 to 64) is indoor-only at 200 mW with DFS and TPC. 5470 to 5730 MHz (100 to 144) allows indoor and outdoor use at up to 1 W EIRP with DFS and TPC. 5725 to 5850 MHz (149 to 165) is licence-exempt at 200 mW with no fixed outdoor use.' },
				eu: {
					20: [36, 40, 44, 48, 52, 56, 60, 64].concat(range(100, 140, 4)),
					40: [38, 46, 54, 62, 102, 110, 118, 126, 134],
					80: [42, 58, 106, 122],
					160: [50, 114],
					note: 'EU (ETSI EN 301 893): the harmonised standard covers 5150 to 5350 MHz and 5470 to 5725 MHz (channels 36 to 64 and 100 to 140). Radar detection (DFS) applies to any channel that falls partly or completely within 5250 to 5350 or 5470 to 5725 MHz. Indoor and outdoor conditions come from EU and national law rather than from the standard, so check the national rules.' },
				us: {
					20: [36, 40, 44, 48, 52, 56, 60, 64].concat(range(100, 144, 4), [149, 153, 157, 161, 165]),
					40: [38, 46, 54, 62, 102, 110, 118, 126, 134, 142, 151, 159],
					80: [42, 58, 106, 122, 138, 155],
					160: [50, 114],
					note: 'US (FCC, 47 CFR 15.407): U-NII-1 (36 to 48), U-NII-2A (52 to 64, DFS), U-NII-2C (100 to 144, DFS) and U-NII-3 (149 to 165). The channel numbers match the UK plan, but power limits, indoor/outdoor rules and DFS details differ.' }
			}
		},
		'6': {
			label: '6 GHz', min: 5925, max: 7125, centre: function (c) { return 5950 + 5 * c; },
			widths: [20, 40, 80, 160, 320],
			regions: {
				uk: {
					20: range(1, 93, 4), 40: range(3, 91, 8), 80: range(7, 87, 16), 160: [15, 47, 79], 320: [31],
					note: 'UK (Ofcom): lower 6 GHz, 5925 to 6425 MHz, licence-exempt: low-power indoor (LPI) at 250 mW EIRP and very low power (VLP) at 25 mW indoors and outdoors on the move. That gives 24 standard 20 MHz channels (1 to 93) plus a 20 MHz edge channel. Ofcom has announced decisions to extend Wi-Fi access beyond this; check its pages for what is in force.' },
				eu: {
					20: range(1, 93, 4), 40: range(3, 91, 8), 80: range(7, 87, 16), 160: [15, 47, 79], 320: [31],
					note: 'EU (Decision (EU) 2021/1067, ETSI EN 303 687): 5945 to 6425 MHz only, in 24 nominal 20 MHz channels (centre = 5935 + 20 x n MHz, n = 1 to 24), for low-power indoor (LPI) and very low power (VLP) devices.' },
				us: {
					20: range(1, 233, 4), 40: range(3, 227, 8), 80: range(7, 215, 16), 160: range(15, 207, 32), 320: [31, 95, 159],
					note: 'US (FCC 20-51): 5925 to 7125 MHz, 59 x 20 MHz channels (1 to 233). Low-power indoor access points may use the whole band; standard-power access points need AFC and are limited to U-NII-5 and U-NII-7. The 320 MHz plan shown is "320-1"; a second offset plan ("320-2") also exists.' }
			},
			psc: range(5, 229, 16)
		}
	};

	function isDfs(centre, width) {
		var lo = centre - width / 2, hi = centre + width / 2;
		return (hi > 5250 && lo < 5350) || (hi > 5470 && lo < 5725);
	}
	function isIndoorOnly(region, band, centre, width) {
		// UK IR 2030/8/1b: 5250 to 5350 MHz is indoor-only. (5150 to 5250 MHz was liberalised in March 2023.)
		var lo = centre - width / 2, hi = centre + width / 2;
		return region === 'uk' && band === '5' && hi > 5250 && lo < 5350;
	}

	function modelChannels(root, band) {
		var plan = PLANS[band];
		var state = { region: Region.get(), width: 20 };
		var W = 1000, H = band === '2.4' ? 230 : 190, padL = 14, padR = 14, axisY = H - 50;
		var stage = el('div', { class: 'lab-stage' });
		var controls = el('div', { class: 'lab-controls' });
		Region.on(function (r) { state.region = r; draw(); });
		if (plan.widths.length > 1) {
			var wSeg = seg('Channel width', plan.widths.map(function (w) { return [w, w + ' MHz']; }), state.width, function (v) { state.width = Number(v); draw(); });
			controls.append(el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Channel width' }), wSeg]));
		}
		var roCount = readout('', 'non-overlapping channels'), roSpan = readout('', 'spectrum shown'), roPsc = readout('', band === '6' ? 'PSC (scan-first) channels' : 'DFS channels', band === '5' ? 'warn' : ''), roIn = readout('', 'indoor-only channels');
		var reads = el('div', { class: 'lab-reads' }, band === '5' ? [roCount, roSpan, roPsc, roIn] : [roCount, roSpan, roPsc]);
		var note = el('p', { class: 'lab-note' });
		var legend = el('p', { class: 'lab-legend' });
		function swatch(color, text, dashed) { return el('span', {}, [el('i', { style: 'background:' + color + (dashed ? ';outline:2px dashed var(--wp--preset--color--ink)' : '') }), document.createTextNode(text)]); }
		if (band === '2.4') { legend.append(swatch('var(--wp--preset--color--accent)', 'Non-overlapping 1 / 6 / 11'), swatch('var(--wp--preset--color--brand)', 'Other channels (overlap)')); }
		else if (band === '5') { legend.append(swatch('var(--wp--preset--color--brand)', 'Ordinary channel'), swatch('var(--wp--preset--color--accent)', 'Needs DFS (radar check)'), swatch('transparent', 'Indoor-only in the UK', true)); }
		else { legend.append(swatch('var(--wp--preset--color--brand)', 'Channel'), swatch('var(--wp--preset--color--accent)', 'PSC: scanned first (20 MHz view)')); }
		root.append(controls, stage, legend, reads, note);

		function x(f) { return padL + (f - plan.min) / (plan.max - plan.min) * (W - padL - padR); }

		function draw() {
			var reg = plan.regions[state.region];
			var list = reg[state.width] || reg[20];
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': plan.label + ' channel map, ' + state.width + ' MHz channels, ' + REGION_NAMES[state.region] });
			s.append(svg('line', { x1: padL, y1: axisY, x2: W - padR, y2: axisY, class: 'lab-axis' }));
			var dfsCount = 0, pscCount = 0, inCount = 0;
			var lo = Infinity, hi = -Infinity;
			list.forEach(function (c, i) {
				var f = plan.centre(c), w = state.width;
				lo = Math.min(lo, f - w / 2); hi = Math.max(hi, f + w / 2);
				var x0 = x(f - w / 2), x1 = x(f + w / 2);
				var dfs = band === '5' && isDfs(f, w);
				var indoor = band === '5' && isIndoorOnly(state.region, band, f, w);
				if (indoor) { inCount++; }
				var psc = band === '6' && state.width === 20 && plan.psc.indexOf(c) >= 0;
				if (dfs) { dfsCount++; }
				if (psc) { pscCount++; }
				var cls = 'lab-ch';
				if (band === '2.4') { cls += plan.mark.indexOf(c) >= 0 ? ' is-key' : ' is-other'; }
				else { cls += ((i % 2) ? ' is-b' : ' is-a'); }
				if (dfs) { cls += ' is-dfs'; }
				if (indoor) { cls += ' is-indoor'; }
				if (psc) { cls += ' is-psc'; }
				if (band === '2.4') {
					var cx = (x0 + x1) / 2, hw = (x1 - x0) / 2, top = 40 + (plan.mark.indexOf(c) >= 0 ? 0 : 22);
					s.append(svg('path', { d: 'M' + (cx - hw * 1.05) + ' ' + axisY + ' C' + (cx - hw * 0.7) + ' ' + axisY + ' ' + (cx - hw * 0.7) + ' ' + top + ' ' + cx + ' ' + top + ' S' + (cx + hw * 0.7) + ' ' + axisY + ' ' + (cx + hw * 1.05) + ' ' + axisY + ' Z', class: cls }));
				} else {
					s.append(svg('rect', { x: x0 + 0.5, y: 40, width: Math.max(1, x1 - x0 - 1), height: axisY - 40, rx: 3, class: cls }));
				}
				var showLabel = band === '2.4' || state.width >= 40 || (band === '5') || (band === '6' && (i % 2 === 0));
				if (showLabel) {
					var t = svg('text', { x: (x0 + x1) / 2, y: axisY + 18, 'text-anchor': 'middle', class: 'lab-tick' }); t.textContent = c; s.append(t);
				}
			});
			// frequency ticks
			var step = band === '6' ? 200 : (band === '5' ? 100 : 20);
			for (var f = Math.ceil(plan.min / step) * step; f <= plan.max; f += step) {
				var tt = svg('text', { x: x(f), y: axisY + 40, 'text-anchor': 'middle', class: 'lab-tick lab-tick--f' }); tt.textContent = f; s.append(tt);
				s.append(svg('line', { x1: x(f), y1: axisY, x2: x(f), y2: axisY + 5, class: 'lab-axis' }));
			}
			var unit = svg('text', { x: W - padR, y: 20, 'text-anchor': 'end', class: 'lab-tick lab-tick--f' }); unit.textContent = 'MHz'; s.append(unit);
			stage.replaceChildren(s);

			// non-overlapping count: for 2.4 GHz at 20 MHz the usable non-overlapping set is the 1/6/11 plan
			var count = band === '2.4' ? 3 : list.length;
			roCount.set(String(count), count >= 6 ? 'good' : (count >= 3 ? 'warn' : 'bad'));
			roSpan.set(fmt(hi - lo, 0) + ' MHz');
			if (band === '5') { roPsc.set(dfsCount + ' of ' + list.length, 'warn'); roIn.set(state.region === 'uk' ? inCount + ' of ' + list.length : 'none', ''); }
			else if (band === '6') { roPsc.set(state.width === 20 ? pscCount + ' of ' + list.length : 'shown at 20 MHz', ''); }
			else { roPsc.set('none (no DFS)', ''); }
			var extra = '';
			if (band === '6' && state.width === 320) { extra = ' ' + list.length + ' channel' + (list.length > 1 ? 's' : '') + ' fit, so one neighbour on 320 MHz can leave nothing for you.'; }
			if (band === '5' && state.width === 160) { extra = ' Only two 160 MHz channels exist, and both include DFS channels.'; }
			if (band === '5' && state.region === 'uk') { extra += ' Channels with a dashed outline (52 to 64) are indoor-only in the UK.'; }
			if (band === '2.4' ) { extra = ' Orange peaks are the 1/6/11 plan; the lower peaks show how every other channel overlaps its neighbours.'; }
			note.textContent = reg.note + extra;
		}
		draw();
	}

	/* =====================================================================
	 * 2.4 GHz channels: pick several channels, give each its own width, and see which ones overlap
	 * Nominal widths: 22 MHz (DSSS / CCK), 20 MHz (OFDM), 40 MHz (HT / HE / EHT: two bonded 20 MHz channels,
	 * the second one 4 channel numbers above or below the primary).
	 * Overlap of two channels = the length of the frequency range they share.
	 * ===================================================================== */
	function modelChannelsOverlap(root) {
		var PL = PLANS['2.4'];
		var KEYS = {
			'22': { w: 22, s: 0, t: '22 MHz: DSSS / CCK (802.11b)' },
			'20': { w: 20, s: 0, t: '20 MHz: OFDM (802.11g, n, ax, be)' },
			'40u': { w: 40, s: 10, t: '40 MHz, secondary channel above (n, ax, be)' },
			'40d': { w: 40, s: -10, t: '40 MHz, secondary channel below (n, ax, be)' }
		};
		var MAXNETS = 6, NAMES = 'ABCDEF';
		var state = { region: Region.get(), pref: '20', nets: [], uid: 0 };
		function maxCh() { var l = PL.regions[state.region][20]; return l[l.length - 1]; }
		function valid(ch, key) { if (key === '40u') { return ch + 4 <= maxCh(); } if (key === '40d') { return ch - 4 >= 1; } return ch <= maxCh(); }
		function keyFor(ch, pref) { if (pref !== '40') { return pref; } return valid(ch, '40u') ? '40u' : (valid(ch, '40d') ? '40d' : '20'); }
		function add(ch, key) { if (state.nets.length >= MAXNETS) { return false; } state.nets.push({ id: ++state.uid, ch: ch, key: key || keyFor(ch, state.pref) }); return true; }
		function geom(n) { var k = KEYS[n.key]; return { f: PL.centre(n.ch) + k.s, w: k.w, lo: PL.centre(n.ch) + k.s - k.w / 2, hi: PL.centre(n.ch) + k.s + k.w / 2 }; }
		function chLabel(n) { return n.ch + (n.key === '40u' ? '+' : (n.key === '40d' ? '−' : '')); }
		function netName(n, i) { return NAMES[i] + ': channel ' + chLabel(n) + ', ' + KEYS[n.key].w + ' MHz'; }
		function ovl(a, b) { var A = geom(a), B = geom(b); return Math.max(0, Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo)); }
		function classify(a, b) {
			var A = geom(a), B = geom(b), o = ovl(a, b), gap = Math.abs(A.f - B.f) - (A.w + B.w) / 2;
			if (A.f === B.f && A.w === B.w) { return { o: o, tone: 'warn', cls: 'is-same', t: 'Same channel: they hear each other and take turns' }; }
			if (o === 0) { return { o: o, tone: 'good', cls: '', t: gap === 0 ? 'Edges touch, no shared frequencies' : 'No overlap' }; }
			if (o >= Math.min(A.w, B.w) - 0.001) { return { o: o, tone: 'warn', cls: 'is-same', t: 'One sits inside the other: they share airtime' }; }
			return { o: o, tone: 'bad', cls: 'is-bad', t: 'Partial overlap: interference, neither can decode the other' };
		}
		function setPreset(list) { state.nets = []; list.forEach(function (p) { add(p[0], p[1]); }); }
		function presets() {
			var us = state.region === 'us';
			return [
				['1 · 6 · 11', [[1, '20'], [6, '20'], [11, '20']]],
				[us ? '1 · 4 · 8 · 11' : '1 · 5 · 9 · 13', us ? [[1, '20'], [4, '20'], [8, '20'], [11, '20']] : [[1, '20'], [5, '20'], [9, '20'], [13, '20']]],
				['1 · 4 · 7 · 10', [[1, '20'], [4, '20'], [7, '20'], [10, '20']]],
				['1 · 3 · 6', [[1, '20'], [3, '20'], [6, '20']]],
				['1 · 6 · 11 at 22 MHz', [[1, '22'], [6, '22'], [11, '22']]],
				['Two 40 MHz channels', [[1, '40u'], [us ? 11 : 13, '40d']]],
				['Clear all', []]
			];
		}

		var controls = el('div', { class: 'lab-controls' });
		controls.append(el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Width of the next channel you add' }), seg('Width for new channels', [['22', '22 MHz'], ['20', '20 MHz'], ['40', '40 MHz']], state.pref, function (v) { state.pref = v; })]));
		var picker = el('div', { class: 'lab-ctl' });
		controls.append(picker);
		var presetBox = el('div', { class: 'lab-ctl' });
		controls.append(presetBox);
		var chips = el('div', { class: 'lab-nets' });
		var stage = el('div', { class: 'lab-stage' });
		var verdict = el('p', { class: 'lab-verdict', 'aria-live': 'polite' });
		var detail = el('div', { class: 'lab-ovdetail' });
		var reads = el('div', { class: 'lab-reads' });
		var roN = readout('', 'networks on the chart'), roBad = readout('', 'pairs that partly overlap'), roOk = readout('', 'pairs with no overlap', 'good');
		reads.append(roN, roBad, roOk);
		var note = el('p', { class: 'lab-note' });
		root.append(controls, chips, stage, verdict, reads, detail, note);

		var pickBtns = {};
		function buildPicker() {
			pickBtns = {};
			var wrap = el('div', { class: 'lab-seg', role: 'group', 'aria-label': 'Add or remove a channel' });
			PL.regions[state.region][20].forEach(function (c) {
				var b = el('button', { type: 'button', 'data-fk': 'pick-' + c, 'aria-pressed': 'false', text: String(c) });
				b.addEventListener('click', function () { toggle(c); });
				pickBtns[c] = b; wrap.append(b);
			});
			picker.replaceChildren(el('span', { class: 'lab-ctl__t', text: 'Click channels to add or remove them (up to ' + MAXNETS + ')' }), wrap);
			var pw = el('div', { class: 'lab-seg lab-seg--presets', role: 'group', 'aria-label': 'Example combinations' });
			presets().forEach(function (p) { var b = el('button', { type: 'button', text: p[0] }); b.addEventListener('click', function () { setPreset(p[1]); draw(); }); pw.append(b); });
			presetBox.replaceChildren(el('span', { class: 'lab-ctl__t', text: 'Or try a combination' }), pw);
		}
		function toggle(ch) {
			var at = -1;
			state.nets.forEach(function (n, i) { if (at < 0 && n.ch === ch) { at = i; } });
			if (at >= 0) { state.nets.splice(at, 1); } else { add(ch); }
			draw();
		}
		Region.on(function (r) {
			state.region = r;
			state.nets = state.nets.filter(function (n) { return valid(n.ch, '20'); });
			state.nets.forEach(function (n) { if (!valid(n.ch, n.key)) { n.key = '20'; } });
			buildPicker(); draw();
		});

		function draw() {
			var active = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-fk') : null;
			var nets = state.nets, list = PL.regions[state.region][20];
			Object.keys(pickBtns).forEach(function (c) { pickBtns[c].setAttribute('aria-pressed', String(nets.some(function (n) { return n.ch === Number(c); }))); });

			// network cards: width per network, add another on the same channel, remove
			chips.replaceChildren.apply(chips, nets.map(function (n, i) {
				var sel = el('select', { 'aria-label': 'Width of network ' + NAMES[i], 'data-fk': 'sel-' + n.id });
				Object.keys(KEYS).forEach(function (k) { var o = el('option', { value: k, text: KEYS[k].t }); if (!valid(n.ch, k)) { o.disabled = true; } if (k === n.key) { o.selected = true; } sel.append(o); });
				sel.addEventListener('change', function () { n.key = sel.value; draw(); });
				var dup = el('button', { type: 'button', class: 'lab-net__b', 'data-fk': 'dup-' + n.id, 'aria-label': 'Add another network on channel ' + n.ch, text: '+ same channel' });
				dup.addEventListener('click', function () { if (add(n.ch, n.key)) { draw(); } });
				var rm = el('button', { type: 'button', class: 'lab-net__b', 'data-fk': 'rm-' + n.id, 'aria-label': 'Remove network ' + NAMES[i], text: 'Remove' });
				rm.addEventListener('click', function () { state.nets = state.nets.filter(function (x) { return x !== n; }); draw(); });
				return el('div', { class: 'lab-net' }, [el('span', { class: 'lab-net__badge lab-netbg-' + i, text: NAMES[i] }), el('b', { text: 'Channel ' + chLabel(n) }), sel, dup, rm]);
			}));

			var W = 1000, H = 340, padL = 20, padR = 20, yb = 255, ytop = 78;
			var fmin = 2395, fmax = 2495;
			function x(f) { return padL + (f - fmin) / (fmax - fmin) * (W - padL - padR); }
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': nets.length ? 'Channels ' + nets.map(chLabel).join(', ') + ' drawn on the 2.4 GHz frequency axis; shaded areas are shared frequencies.' : 'Empty 2.4 GHz frequency axis. Add channels to see them.' });
			s.append(svg('line', { x1: padL, y1: yb, x2: W - padR, y2: yb, class: 'lab-axis' }));
			[2400, 2483.5].forEach(function (f) { s.append(svg('line', { x1: x(f), y1: ytop - 34, x2: x(f), y2: yb + 6, class: 'lab-axis', 'stroke-dasharray': '2 4' })); });
			text(s, x(2400), ytop - 40, '2400', 'lab-tick', 'middle'); text(s, x(2483.5), ytop - 40, '2483.5 MHz: band edge', 'lab-tick', 'middle');

			function bell(f, w, peak, cls, style) {
				var xl = x(f - w / 2), xr = x(f + w / 2), xc = x(f), hw = (xr - xl) / 2;
				return svg('path', { d: 'M' + xl + ' ' + yb + ' C' + (xl + 0.42 * hw) + ' ' + yb + ' ' + (xc - 0.5 * hw) + ' ' + peak + ' ' + xc + ' ' + peak + ' C' + (xc + 0.5 * hw) + ' ' + peak + ' ' + (xr - 0.42 * hw) + ' ' + yb + ' ' + xr + ' ' + yb + ' Z', class: cls, style: style || '' });
			}
			// 1. every channel as a faint 20 MHz guide, so any of them can be clicked
			list.forEach(function (c) {
				if (nets.some(function (n) { return n.ch === c; })) { return; }
				var b = bell(PL.centre(c), 20, ytop + 30, 'lab-ov-bell is-none'); b.addEventListener('click', function () { toggle(c); }); s.append(b);
			});
			// 2. shared frequencies of every pair that overlaps
			var pairs = [];
			for (var i = 0; i < nets.length; i++) { for (var j = i + 1; j < nets.length; j++) { var cl = classify(nets[i], nets[j]); pairs.push({ a: i, b: j, c: cl }); } }
			pairs.forEach(function (p) {
				if (p.c.o <= 0) { return; }
				var A = geom(nets[p.a]), B = geom(nets[p.b]), a1 = Math.max(A.lo, B.lo), a2 = Math.min(A.hi, B.hi);
				s.append(svg('rect', { x: x(a1), y: ytop - 14, width: Math.max(1, x(a2) - x(a1)), height: yb - ytop + 14, class: 'lab-ov-zone ' + p.c.cls }));
			});
			// 3. the networks, each in its own colour
			nets.forEach(function (n, i) {
				var g = geom(n), peak = ytop + i * 9;
				var b = bell(g.f, g.w, peak, 'lab-ov-bell is-net lab-net-' + i); b.addEventListener('click', function () { toggle(n.ch); }); s.append(b);
				s.append(svg('circle', { cx: x(g.f), cy: peak - 13, r: 11, class: 'lab-netbg-' + i }));
				text(s, x(g.f), peak - 8.5, NAMES[i], 'lab-net-letter', 'middle');
			});
			// 4. MHz written on each shared area
			pairs.forEach(function (p) {
				if (p.c.o <= 0) { return; }
				var A = geom(nets[p.a]), B = geom(nets[p.b]), a1 = Math.max(A.lo, B.lo), a2 = Math.min(A.hi, B.hi);
				if (x(a2) - x(a1) > 26) { text(s, (x(a1) + x(a2)) / 2, yb - 10 - (p.a + p.b) % 3 * 14, fmt(p.c.o, 0), 'lab-tick lab-tick--f', 'middle'); }
			});
			// 5. channel numbers along the bottom (click to add or remove) and frequency ticks
			list.forEach(function (c) {
				var on = nets.some(function (n) { return n.ch === c; });
				var gr = svg('g', { class: 'lab-ov-row', tabindex: '0', role: 'button', 'data-fk': 'svg-' + c, 'aria-label': 'Channel ' + c + (on ? ', on the chart. Press to remove' : '. Press to add') });
				gr.append(svg('rect', { x: x(PL.centre(c)) - 18, y: yb + 2, width: 36, height: 22, fill: 'transparent' }));
				var tt = svg('text', { x: x(PL.centre(c)), y: yb + 19, 'text-anchor': 'middle', class: 'lab-tick lab-tick--f' + (on ? ' is-picked' : '') }); tt.textContent = c; gr.append(tt);
				gr.addEventListener('click', function () { toggle(c); });
				gr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(c); } });
				s.append(gr);
			});
			for (var f = 2400; f <= 2480; f += 20) { var ft = svg('text', { x: x(f), y: yb + 46, 'text-anchor': 'middle', class: 'lab-tick' }); ft.textContent = f; s.append(ft); s.append(svg('line', { x1: x(f), y1: yb, x2: x(f), y2: yb + 5, class: 'lab-axis' })); }
			var unit = svg('text', { x: W - padR, y: yb + 46, 'text-anchor': 'end', class: 'lab-tick' }); unit.textContent = 'MHz'; s.append(unit);
			stage.replaceChildren(s);

			// summary
			var bad = pairs.filter(function (p) { return p.c.cls === 'is-bad'; }).length;
			var shared = pairs.filter(function (p) { return p.c.cls === 'is-same'; }).length;
			var clear = pairs.filter(function (p) { return p.c.o === 0; }).length;
			roN.set(String(nets.length));
			roBad.set(String(bad), bad ? 'bad' : 'good');
			roOk.set(String(clear) + ' of ' + pairs.length, clear === pairs.length && pairs.length ? 'good' : 'warn');
			if (nets.length === 0) { verdict.textContent = 'Nothing on the chart. Click a channel number, or try one of the combinations above.'; }
			else if (nets.length === 1) { verdict.textContent = 'One network: add a second channel to see how they compare.'; }
			else if (!bad && !shared) { verdict.textContent = 'Clean: no two of these networks share any frequencies, so none of them interferes with another.'; }
			else {
				var parts = [];
				if (bad) { parts.push(bad + (bad === 1 ? ' pair overlaps' : ' pairs overlap') + ' partly (red): those networks interfere with each other because neither can decode the other’s frames'); }
				if (shared) { parts.push(shared + (shared === 1 ? ' pair shares' : ' pairs share') + ' the same frequencies (amber): they hear each other and take turns, which costs airtime but not corruption'); }
				verdict.textContent = parts.join('; ') + '.';
			}

			var rows = pairs.map(function (p) {
				var A = geom(nets[p.a]), B = geom(nets[p.b]);
				var shareOfNarrow = p.c.o ? Math.round(p.c.o / Math.min(A.w, B.w) * 100) + '% of the narrower channel' : '–';
				return el('tr', {}, [
					el('th', { scope: 'row', text: NAMES[p.a] + ' and ' + NAMES[p.b] + ' (channels ' + chLabel(nets[p.a]) + ' and ' + chLabel(nets[p.b]) + ')' }),
					el('td', { text: fmt(A.lo, 0) + '–' + fmt(A.hi, 0) + ' and ' + fmt(B.lo, 0) + '–' + fmt(B.hi, 0) + ' MHz' }),
					el('td', { text: p.c.o ? fmt(p.c.o, 0) + ' MHz (' + shareOfNarrow + ')' : 'none' }),
					el('td', { class: 'lab-tone-' + p.c.tone, text: p.c.t })
				]);
			});
			detail.replaceChildren(
				pairs.length
					? el('div', { class: 'lab-tablewrap' }, [el('table', { class: 'lab-table' }, [el('thead', {}, [el('tr', {}, ['Pair', 'Frequencies', 'Shared', 'Result'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]), el('tbody', {}, rows)])])
					: null
			);
			var plan = state.region === 'us' ? 'Channels 1 to 11 are allowed in the US.' : 'Channels 1 to 13 are allowed in the UK and the EU.';
			note.textContent = plan + ' A 40 MHz channel written 1+ means primary channel 1 with its secondary channel 4 numbers above; 13− means the secondary is below. Widths are nominal: the overlap is how much of each channel’s nominal width is shared, and real signals also leak a little outside it. That is why 1, 6 and 11, which are 25 MHz apart, is the usual plan, and why 40 MHz channels almost never make sense here.';

			if (active) { var back = root.querySelector('[data-fk="' + active + '"]'); if (back && back.focus) { back.focus(); } }
		}
		setPreset(presets()[0][1]);
		buildPicker();
		draw();
	}

	/* =====================================================================
	 * Generation timeline
	 * ===================================================================== */
	var TIMELINES = {
		'2.4': [
			{ y: '1997', name: 'IEEE 802.11-1997', brand: 'Original standard', phy: 'DSSS and FHSS (two radio PHYs)', mod: 'DBPSK / DQPSK (DSSS), 2-/4-level GFSK (FHSS)', width: '22 MHz (DSSS)', rate: '1 and 2 Mbps',
			  why: 'The first interoperable wireless LAN standard. It defined two spread-spectrum radios for the licence-free 2.4 GHz ISM band: direct-sequence (an 11-chip Barker code spreads each bit) and frequency-hopping (the radio hops across 1 MHz channels).',
			  src: 'RevCom approval 26 June 1997 (IEEE 802.11 timelines)' },
			{ y: '1999', name: 'IEEE 802.11b', brand: '', phy: 'HR/DSSS with CCK', mod: 'DQPSK with complementary code keying (CCK)', width: '22 MHz', rate: '5.5 and 11 Mbps',
			  why: 'Raised DSSS speeds without changing the channel: CCK carries more bits per symbol while keeping a spread-spectrum waveform. Wi-Fi became a consumer product on 802.11b.',
			  src: 'RevCom approval 16 September 1999' },
			{ y: '2003', name: 'IEEE 802.11g', brand: '', phy: 'ERP-OFDM (and ERP-DSSS/CCK for compatibility)', mod: 'BPSK to 64-QAM on 48 data subcarriers', width: '20 MHz', rate: 'up to 54 Mbps',
			  why: 'Brought the OFDM waveform already used by 802.11a to 2.4 GHz, while staying backward compatible with 802.11b. OFDM copes much better with indoor multipath echoes than a single wideband carrier.',
			  src: 'RevCom approval 12 June 2003' },
			{ y: '2009', name: 'IEEE 802.11n', brand: 'Wi-Fi 4', phy: 'HT (OFDM plus MIMO)', mod: 'up to 64-QAM, 5/6', width: '20 and 40 MHz', rate: 'up to 600 Mbps (4 streams, 40 MHz)',
			  why: 'Multiple antennas send several spatial streams at once (MIMO), and frame aggregation cuts overhead. In 2.4 GHz a 40 MHz channel leaves room for roughly one channel, so 20 MHz stays the practical choice.',
			  src: 'RevCom approval 11 September 2009' },
			{ y: '2021', name: 'IEEE 802.11ax', brand: 'Wi-Fi 6', phy: 'HE (OFDM and OFDMA)', mod: 'up to 1024-QAM, 5/6', width: '20 and 40 MHz in 2.4 GHz', rate: '143.4 Mbps per stream at 20 MHz',
			  why: 'Designed for crowded networks. OFDMA splits a channel into resource units shared by several clients, BSS colouring improves reuse, and target wake time helps battery life. Longer symbols (12.8 microseconds) tolerate echoes better.',
			  src: 'RevCom approval 1 February 2021. Wi-Fi CERTIFIED 6 programme followed (2019 onward).' },
			{ y: '2024', name: 'IEEE 802.11be', brand: 'Wi-Fi 7', phy: 'EHT (OFDM and OFDMA)', mod: 'up to 4096-QAM, 5/6', width: '20 and 40 MHz in 2.4 GHz', rate: '172.1 Mbps per stream at 20 MHz',
			  why: 'A Wi-Fi 7 client can treat 2.4 GHz as one link inside a multi-link connection (MLO), using it for reach and reliability while other links do the heavy lifting.',
			  src: 'RevCom approval 26 September 2024; published 22 July 2025. Wi-Fi CERTIFIED 7 announced 8 January 2024.' }
		],
		'5': [
			{ y: '1999', name: 'IEEE 802.11a', brand: '', phy: 'OFDM', mod: 'BPSK to 64-QAM on 48 data subcarriers', width: '20 MHz', rate: 'up to 54 Mbps',
			  why: 'The first OFDM Wi-Fi. It put 54 Mbps into a 20 MHz channel in 5 GHz, but needed expensive radios for the time, so early adoption was slow.',
			  src: 'RevCom approval 16 September 1999' },
			{ y: '2003', name: 'IEEE 802.11h', brand: '', phy: 'Spectrum management for 5 GHz', mod: '(adds no new modulation)', width: '20 MHz', rate: '(same as 802.11a)',
			  why: 'Added Dynamic Frequency Selection (DFS) and Transmit Power Control (TPC) so Wi-Fi can share 5 GHz with radar and satellite services in Europe. This is why some 5 GHz channels need a radar check.',
			  src: 'RevCom approval 11 September 2003' },
			{ y: '2009', name: 'IEEE 802.11n', brand: 'Wi-Fi 4', phy: 'HT (OFDM plus MIMO)', mod: 'up to 64-QAM, 5/6', width: '20 and 40 MHz', rate: 'up to 600 Mbps (4 streams, 40 MHz)',
			  why: 'Multiple antennas send several spatial streams at once (MIMO), and frame aggregation cuts overhead. In 5 GHz, 40 MHz channels were realistic because the band has many channels.',
			  src: 'RevCom approval 11 September 2009' },
			{ y: '2013', name: 'IEEE 802.11ac', brand: 'Wi-Fi 5', phy: 'VHT (OFDM plus MIMO)', mod: 'up to 256-QAM, 5/6', width: '20, 40, 80 and 160 MHz', rate: 'up to about 6.9 Gbps (8 streams, 160 MHz)',
			  why: 'A 5 GHz-only generation: wider channels (80 and 160 MHz), denser modulation and downlink MU-MIMO (Wave 2). Wider channels brought more speed, and also more DFS exposure and fewer free channels.',
			  src: 'RevCom approval 9 December 2013' },
			{ y: '2021', name: 'IEEE 802.11ax', brand: 'Wi-Fi 6', phy: 'HE (OFDM and OFDMA)', mod: 'up to 1024-QAM, 5/6', width: '20 to 160 MHz', rate: '600.5 Mbps per stream at 80 MHz',
			  why: 'Efficiency for dense deployments: OFDMA, uplink MU-MIMO, BSS colouring and target wake time.',
			  src: 'RevCom approval 1 February 2021' },
			{ y: '2024', name: 'IEEE 802.11be', brand: 'Wi-Fi 7', phy: 'EHT (OFDM and OFDMA)', mod: 'up to 4096-QAM, 5/6', width: '20 to 160 MHz in 5 GHz', rate: '1441.2 Mbps per stream at 160 MHz',
			  why: 'Multi-link operation lets a client use 5 GHz as one of several simultaneous links. Multi-RU and preamble puncturing let a network keep using a wide channel even when part of it is occupied.',
			  src: 'RevCom approval 26 September 2024; published 22 July 2025' }
		],
		'6': [
			{ y: '2020', byRegion: {
				uk: { y: '2021', name: 'Ofcom opens lower 6 GHz', brand: 'Rules', phy: '(regulatory step)', mod: '', width: '500 MHz (5925 to 6425 MHz)', rate: '',
				      why: 'Version 1.14 of Ofcom\u2019s IR 2030 (April 2021) added 5925 to 6425 MHz for Wi-Fi and other RLAN use: low-power indoor (LPI) devices at up to 250 mW EIRP and very low power (VLP) devices at up to 25 mW. Ofcom has since announced decisions (2026) to go further, including outdoor and higher-power use under AFC control and a Wi-Fi priority block at 6425 to 6585 MHz, but the current IR 2030 (v1.16, April 2026) does not include them yet.',
				      src: 'Ofcom IR 2030 version history (v1.14, April 2021; v1.16, April 2026); Ofcom 6 GHz pages (2026 decisions)' },
				eu: { y: '2021', name: 'EU opens lower 6 GHz', brand: 'Rules', phy: '(regulatory step)', mod: '', width: '480 MHz (5945 to 6425 MHz)', rate: '',
				      why: 'Commission Implementing Decision (EU) 2021/1067 of 17 June 2021 harmonised 5945 to 6425 MHz across the EU for low-power indoor (LPI) devices at up to 23 dBm EIRP and very low power (VLP) devices at up to 14 dBm. ETSI then published the harmonised standard EN 303 687 so that equipment can show it complies.',
				      src: 'Decision (EU) 2021/1067; ETSI EN 303 687 (names the Decision and its date)' },
				us: { name: 'FCC opens 5.925 to 7.125 GHz', brand: 'Rules', phy: '(regulatory step)', mod: '', width: '1,200 MHz of spectrum', rate: '',
				      why: 'On 23 April 2020 the FCC (order FCC 20-51) made 1,200 MHz available for unlicensed use: low-power indoor access points across the whole band, and standard-power access points under AFC control in U-NII-5 and U-NII-7.',
				      src: 'FCC 20-51, adopted 23 April 2020' } } },
			{ y: '2020', name: 'Wi-Fi 6E named', brand: 'Wi-Fi 6E', phy: 'HE (802.11ax) in 6 GHz', mod: 'up to 1024-QAM', width: '20 to 160 MHz', rate: '600.5 Mbps per stream at 80 MHz',
			  why: 'The Wi-Fi Alliance introduced the "6E" name on 3 January 2020 for Wi-Fi 6 devices that can also operate in 6 GHz. Only HE (802.11ax) and later devices may use 6 GHz: no legacy 802.11a/b/g/n/ac devices, which gives a clean start.',
			  src: 'Wi-Fi Alliance, 3 January 2020' },
			{ y: '2021', name: 'Wi-Fi 6E certification', brand: 'Wi-Fi CERTIFIED 6', phy: 'HE in 6 GHz', mod: 'up to 1024-QAM', width: '20 to 160 MHz', rate: '',
			  why: 'Interoperability testing for 6 GHz started on 7 January 2021. WPA3 security is required in 6 GHz, and the band uses new discovery methods (below) because clients cannot probe every channel.',
			  src: 'Wi-Fi Alliance, 7 January 2021' },
			{ y: '2024', name: 'IEEE 802.11be and Wi-Fi 7', brand: 'Wi-Fi 7', phy: 'EHT in 6 GHz', mod: 'up to 4096-QAM', width: '20 to 320 MHz', rate: '2882.4 Mbps per stream at 320 MHz',
			  why: '320 MHz channels exist only in 6 GHz, together with 4096-QAM and multi-link operation. Wi-Fi CERTIFIED 7 was announced on 8 January 2024; the amendment was published on 22 July 2025.',
			  src: 'Wi-Fi Alliance, 8 January 2024; IEEE 802.11 timelines' },
			{ y: 'next', name: 'IEEE 802.11bn', brand: 'Wi-Fi 8 (expected)', phy: 'UHR (draft work)', mod: '(not final)', width: '(not final)', rate: '',
			  why: 'Ultra High Reliability: the goals are consistency, latency and coordination rather than a bigger peak rate. The IEEE timeline predicts approval in 2028 and the details may change, so treat everything about it as provisional.',
			  src: 'IEEE 802.11 timelines (prediction only)' }
		]
	};

	function modelTimeline(root, band) {
		var items = TIMELINES[band], idx = 0;
		function resolve(it) { return it.byRegion ? Object.assign({ y: it.y }, it.byRegion[Region.get()] || it.byRegion.uk) : it; }
		var rail = el('div', { class: 'lab-tl__rail', role: 'tablist', 'aria-label': plan_label(band) + ' timeline' });
		var card = el('div', { class: 'lab-tl__card', role: 'tabpanel', 'aria-live': 'polite' });
		var prev = el('button', { type: 'button', class: 'lab-btn lab-btn--ghost', text: 'Previous' });
		var next = el('button', { type: 'button', class: 'lab-btn', text: 'Next' });
		var nav = el('div', { class: 'lab-tl__nav' }, [prev, next]);
		var hasRegional = items.some(function (i) { return i.byRegion; });
		if (hasRegional) { root.append(el('div', { class: 'lab-controls' }, [el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Regulatory steps shown for' }), regionSeg()])])); }
		root.append(rail, card, nav);

		function row(k, v) { return v ? el('div', { class: 'lab-kv' }, [el('dt', { text: k }), el('dd', { text: v })]) : null; }
		function buildRail() {
			rail.replaceChildren();
			items.forEach(function (raw, i) {
				var it = resolve(raw);
				var b = el('button', { type: 'button', role: 'tab', class: 'lab-tl__dot', 'aria-selected': String(i === idx) }, [
					el('span', { class: 'lab-tl__y', text: it.y }),
					el('span', { class: 'lab-tl__n', text: it.brand && it.brand !== 'Rules' ? it.brand : it.name.replace('IEEE ', '') })
				]);
				b.addEventListener('click', function () { show(i); });
				rail.append(b);
			});
		}
		function show(i) {
			idx = i; var it = resolve(items[i]);
			Array.prototype.forEach.call(rail.children, function (c, j) { c.setAttribute('aria-selected', String(j === i)); });
			var dl = el('dl', { class: 'lab-kvs' }, [row('Waveform (PHY)', it.phy), row('Modulation', it.mod), row('Channel width', it.width), row('Headline rate', it.rate)]);
			card.replaceChildren(
				el('div', { class: 'lab-tl__head' }, [el('span', { class: 'lab-tl__year', text: it.y }), el('h3', { text: it.name + (it.brand && it.brand !== 'Rules' ? '  (' + it.brand + ')' : '') })]),
				el('p', { class: 'lab-tl__why', text: it.why }),
				dl,
				el('p', { class: 'lab-tl__src', text: 'Source: ' + it.src })
			);
			prev.disabled = i === 0; next.disabled = i === items.length - 1;
		}
		prev.addEventListener('click', function () { if (idx > 0) { show(idx - 1); } });
		next.addEventListener('click', function () { if (idx < items.length - 1) { show(idx + 1); } });
		Region.on(function () { buildRail(); show(idx); });
		buildRail(); show(0);
	}
	function plan_label(b) { return PLANS[b].label; }

	/* =====================================================================
	 * Representative channel per band (used by the wave and path-loss models)
	 * ===================================================================== */
	var REP = { '2.4': { mhz: 2437, ch: 6 }, '5': { mhz: 5500, ch: 100 }, '6': { mhz: 6195, ch: 49 } };

	/* =====================================================================
	 * Wavelength (this band only)
	 * ===================================================================== */
	function modelWaves(root, band) {
		var f = REP[band].mhz, cm = 29979.2458 / f;          // c = 299792458 m/s, f in MHz -> cm
		var FRAME_CM = 40, W = 1000, cycles = FRAME_CM / cm, phase = 0;
		var s = svg('svg', { viewBox: '0 0 1000 190', class: 'lab-svg', role: 'img', 'aria-label': 'Wave at ' + PLANS[band].label + ' drawn over a 40 cm ruler' });
		s.append(svg('line', { x1: 0, y1: 90, x2: W, y2: 90, class: 'lab-axis' }));
		var path = svg('path', { class: 'lab-wave is-on' }); s.append(path);
		// ruler: tick every 5 cm over 40 cm
		for (var i = 0; i <= 8; i++) {
			var x = i / 8 * W;
			s.append(svg('line', { x1: x, y1: 150, x2: x, y2: 160, class: 'lab-axis' }));
			var t = svg('text', { x: x, y: 178, 'text-anchor': i === 0 ? 'start' : (i === 8 ? 'end' : 'middle'), class: 'lab-tick' }); t.textContent = (i * 5) + (i === 8 ? ' cm' : ''); s.append(t);
		}
		s.append(svg('line', { x1: 0, y1: 155, x2: W, y2: 155, class: 'lab-axis' }));
		// bracket for one wavelength
		var bw = cm / FRAME_CM * W;
		s.append(svg('path', { d: 'M0 22 L0 14 L' + bw + ' 14 L' + bw + ' 22', fill: 'none', class: 'lab-axis', style: 'stroke-width:2' }));
		var bt = svg('text', { x: bw + 8, y: 20, class: 'lab-tick lab-tick--f' }); bt.textContent = 'one wavelength = ' + fmt(cm) + ' cm'; s.append(bt);
		root.append(el('div', { class: 'lab-stage' }, [s]));
		var reads = el('div', { class: 'lab-reads' }, [
			readout(fmt(cm) + ' cm', 'wavelength at channel ' + REP[band].ch + ' (' + f + ' MHz)'),
			readout(fmt(100 / cm) + '', 'complete waves in one metre'),
			readout(fmt(1 / (f * 1e6) * 1e12, 0) + ' ps', 'time for one wave to pass (the period)')
		]);
		root.append(reads);
		root.append(el('p', { class: 'lab-note', text: 'Wavelength = speed of light / frequency. The ruler shows how many waves fit in 40 cm. Wavelength matters because antennas, obstacles and even your hand are the size of a wave or larger, so what a signal does when it meets them depends on it.' }));
		function draw() {
			var d = '';
			for (var k = 0; k <= 400; k++) { var xx = k / 400 * W; var yy = 90 - 40 * Math.sin(k / 400 * cycles * 2 * Math.PI - phase); d += (k ? 'L' : 'M') + xx.toFixed(1) + ' ' + yy.toFixed(1); }
			path.setAttribute('d', d);
		}
		draw();
		if (!RM) { (function tick() { phase += 0.07; draw(); requestAnimationFrame(tick); })(); }
	}

	/* =====================================================================
	 * Path loss (this band only)
	 * received = EIRP - FSPL(d) - obstruction,  FSPL = 20log10(d) + 20log10(f) - 27.55  (d in m, f in MHz)
	 * ===================================================================== */
	function modelPathloss(root, band) {
		var f = REP[band].mhz, state = { d: 10, obs: 0, eirp: 20 };
		function slider(label, min, max, step, val, unit, onInput) {
			var out = el('output', { text: val + ' ' + unit });
			var inp = el('input', { type: 'range', min: min, max: max, step: step, value: val, 'aria-label': label });
			inp.addEventListener('input', function () { out.textContent = inp.value + ' ' + unit; onInput(Number(inp.value)); });
			return el('label', { class: 'lab-ctl lab-ctl--range' }, [el('span', { class: 'lab-ctl__t' }, [document.createTextNode(label + ': '), out]), inp]);
		}
		var controls = el('div', { class: 'lab-controls' }, [
			slider('Distance', 1, 60, 1, state.d, 'm', function (v) { state.d = v; draw(); }),
			slider('Obstructions (walls, furniture, people)', 0, 40, 1, state.obs, 'dB', function (v) { state.obs = v; draw(); }),
			slider('Transmit EIRP', 10, 30, 1, state.eirp, 'dBm', function (v) { state.eirp = v; draw(); })
		]);
		var stage = el('div', { class: 'lab-stage' });
		var roLoss = readout('', 'free-space path loss at this distance'), roRx = readout('', 'estimated received signal'), roRange = readout('', 'distance until the signal falls to -75 dBm');
		var note = el('p', { class: 'lab-note' });
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roLoss, roRx, roRange]), note);
		function fspl(d) { return 20 * Math.log10(d) + 20 * Math.log10(f) - 27.55; }
		function rx(d) { return state.eirp - fspl(d) - state.obs; }
		function tone(p) { return p >= -65 ? 'good' : (p >= -75 ? 'warn' : 'bad'); }
		function draw() {
			var W = 1000, H = 260, x0 = 60, x1 = 980, y0 = 20, y1 = 210;
			function sx(d) { return x0 + (Math.log10(d) / Math.log10(60)) * (x1 - x0); }   // log distance axis, 1..60 m
			function sy(p) { return y0 + (-20 - Math.max(-100, Math.min(-20, p))) / 80 * (y1 - y0); }
			var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Estimated received signal against distance at ' + PLANS[band].label });
			[-30, -50, -65, -75, -90].forEach(function (g) {
				s.append(svg('line', { x1: x0, y1: sy(g), x2: x1, y2: sy(g), class: 'lab-grid' }));
				var t = svg('text', { x: x0 - 8, y: sy(g) + 4, 'text-anchor': 'end', class: 'lab-tick' }); t.textContent = g; s.append(t);
			});
			var u = svg('text', { x: 4, y: 14, class: 'lab-tick' }); u.textContent = 'dBm'; s.append(u);
			[1, 2, 5, 10, 20, 40, 60].forEach(function (d) {
				var t = svg('text', { x: sx(d), y: y1 + 22, 'text-anchor': 'middle', class: 'lab-tick' }); t.textContent = d + ' m'; s.append(t);
			});
			var d = '';
			for (var k = 0; k <= 120; k++) { var dist = Math.pow(60, k / 120); d += (k ? 'L' : 'M') + sx(dist).toFixed(1) + ' ' + sy(rx(dist)).toFixed(1); }
			s.append(svg('path', { d: d, class: 'lab-wave is-on' }));
			var p = rx(state.d);
			s.append(svg('circle', { cx: sx(state.d), cy: sy(p), r: 8, class: 'lab-bar is-' + tone(p) }));
			var v = svg('text', { x: Math.min(sx(state.d) + 14, x1 - 80), y: sy(p) - 12, class: 'lab-tick lab-tick--f' }); v.textContent = fmt(p, 0) + ' dBm'; s.append(v);
			stage.replaceChildren(s);
			roLoss.set(fmt(fspl(state.d)) + ' dB');
			roRx.set(fmt(p, 0) + ' dBm', tone(p));
			var dmax = Math.pow(10, (state.eirp - state.obs + 75 - 20 * Math.log10(f) + 27.55) / 20);
			roRange.set(dmax > 1000 ? 'over 1 km' : (dmax < 1 ? 'under 1 m' : fmt(dmax, 0) + ' m'));
			note.textContent = 'Free-space path loss: FSPL = 20 log10(d) + 20 log10(f) - 27.55 (d in metres, f in MHz), here with f = ' + f + ' MHz (channel ' + REP[band].ch + '). Every doubling of distance adds about 6 dB. The obstruction slider is yours to set, since real wall loss depends on the material. Colours are rule-of-thumb bands (-65 dBm good, -75 dBm marginal), not a promise: real sensitivity depends on the modulation and the receiver. The model ignores antenna gain and multipath.';
		}
		draw();
	}

	/* =====================================================================
	 * PHY rate calculator
	 * rate = N_SD x N_BPSCS x R x N_SS / T_SYM
	 * ===================================================================== */
	var MCS_TABLE = [
		['BPSK', 1, '1/2', 1 / 2], ['QPSK', 2, '1/2', 1 / 2], ['QPSK', 2, '3/4', 3 / 4], ['16-QAM', 4, '1/2', 1 / 2], ['16-QAM', 4, '3/4', 3 / 4],
		['64-QAM', 6, '2/3', 2 / 3], ['64-QAM', 6, '3/4', 3 / 4], ['64-QAM', 6, '5/6', 5 / 6], ['256-QAM', 8, '3/4', 3 / 4], ['256-QAM', 8, '5/6', 5 / 6],
		['1024-QAM', 10, '3/4', 3 / 4], ['1024-QAM', 10, '5/6', 5 / 6], ['4096-QAM', 12, '3/4', 3 / 4], ['4096-QAM', 12, '5/6', 5 / 6]
	];
	var GENS = {
		'b':  { name: '802.11b (HR/DSSS, 1999)', dsss: true, bands: ['2.4'] },
		'g':  { name: '802.11g (ERP-OFDM, 2003)', sd: { 20: 48 }, tsym: { '0.8': 4.0 }, mcs: 8, ss: 1, bands: ['2.4'],
		        rates: [[0, 1, '1/2'], [0, 1, '3/4'], [1, 2, '1/2'], [1, 2, '3/4'], [3, 4, '1/2'], [4, 4, '3/4'], [5, 6, '2/3'], [6, 6, '3/4']] },
		'a':  { name: '802.11a (OFDM, 1999)', sd: { 20: 48 }, tsym: { '0.8': 4.0 }, mcs: 8, ss: 1, bands: ['5'],
		        rates: [[0, 1, '1/2'], [0, 1, '3/4'], [1, 2, '1/2'], [1, 2, '3/4'], [3, 4, '1/2'], [4, 4, '3/4'], [5, 6, '2/3'], [6, 6, '3/4']] },
		'n':  { name: '802.11n (Wi-Fi 4, HT)', sd: { 20: 52, 40: 108 }, tsym: { '0.8': 4.0, '0.4': 3.6 }, mcs: 8, ss: 4, bands: ['2.4', '5'] },
		'ac': { name: '802.11ac (Wi-Fi 5, VHT)', sd: { 20: 52, 40: 108, 80: 234, 160: 468 }, tsym: { '0.8': 4.0, '0.4': 3.6 }, mcs: 10, ss: 8, bands: ['5'] },
		'ax': { name: '802.11ax (Wi-Fi 6/6E, HE)', sd: { 20: 234, 40: 468, 80: 980, 160: 1960 }, tsym: { '0.8': 13.6, '1.6': 14.4, '3.2': 16.0 }, mcs: 12, ss: 8, bands: ['2.4', '5', '6'] },
		'be': { name: '802.11be (Wi-Fi 7, EHT)', sd: { 20: 234, 40: 468, 80: 980, 160: 1960, 320: 3920 }, tsym: { '0.8': 13.6, '1.6': 14.4, '3.2': 16.0 }, mcs: 14, ss: 8, bands: ['2.4', '5', '6'] }
	};
	/* 802.11b: rate = symbol rate x bits per symbol (11 Mchip/s spreading) */
	var DSSS_RATES = [
		{ mbps: 1,   mod: 'DBPSK', code: '11-chip Barker code',        chips: 11, bits: 1, symrate: 1 },
		{ mbps: 2,   mod: 'DQPSK', code: '11-chip Barker code',        chips: 11, bits: 2, symrate: 1 },
		{ mbps: 5.5, mod: 'DQPSK + CCK', code: '8-chip CCK code word',  chips: 8,  bits: 4, symrate: 1.375 },
		{ mbps: 11,  mod: 'DQPSK + CCK', code: '8-chip CCK code word',  chips: 8,  bits: 8, symrate: 1.375 }
	];

	function modelPhyrate(root, band) {
		var order = ['b', 'g', 'a', 'n', 'ac', 'ax', 'be'].filter(function (g) { return GENS[g].bands.indexOf(band) >= 0; });
		var st = { g: order[order.length - 1], w: 20, m: 0, n: 1, gi: '0.8' };
		var controls = el('div', { class: 'lab-controls' });
		var selGen = el('select', { 'aria-label': 'Generation' }), selW = el('select', { 'aria-label': 'Channel width' }), selM = el('select', { 'aria-label': 'MCS' }), selN = el('select', { 'aria-label': 'Spatial streams' }), selG = el('select', { 'aria-label': 'Guard interval' });
		function field(t, s) { return el('label', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: t }), s]); }
		controls.append(field('Generation', selGen), field('Channel width', selW), field('MCS (modulation and coding)', selM), field('Spatial streams', selN), field('Guard interval (µs)', selG));
		var ro = readout('', 'PHY data rate', 'good'), roBits = readout('', 'bits per symbol per stream'), roT = readout('', 'symbol time');
		var reads = el('div', { class: 'lab-reads' }, [ro, roBits, roT]);
		var eq = el('p', { class: 'lab-eq' });
		var note = el('p', { class: 'lab-note' });
		root.append(controls, reads, eq, note);

		function widthsFor(g) {
			var all = Object.keys(GENS[g].sd).map(Number);
			var cap = band === '2.4' ? 40 : 320;
			return all.filter(function (w) { return w <= cap; });
		}
		function fillGen() { order.forEach(function (g) { selGen.append(el('option', { value: g, text: GENS[g].name })); }); selGen.value = st.g; }
		function fillRest() {
			var G = GENS[st.g];
			if (G.dsss) {
				selW.replaceChildren(el('option', { value: 22, text: '22 MHz (DSSS channel)' })); selW.disabled = true;
				selM.replaceChildren(); DSSS_RATES.forEach(function (r, i) { selM.append(el('option', { value: i, text: r.mbps + ' Mbps: ' + r.mod })); });
				if (st.m >= DSSS_RATES.length) { st.m = DSSS_RATES.length - 1; } selM.value = st.m;
				selN.replaceChildren(el('option', { value: 1, text: '1' })); selN.disabled = true;
				selG.replaceChildren(el('option', { value: '-', text: 'not used' })); selG.disabled = true;
				return;
			}
			selW.disabled = false;
			selW.replaceChildren(); widthsFor(st.g).forEach(function (w) { selW.append(el('option', { value: w, text: w + ' MHz' })); });
			if (widthsFor(st.g).indexOf(st.w) < 0) { st.w = widthsFor(st.g)[0]; }
			selW.value = st.w;
			selM.replaceChildren();
			for (var i = 0; i < G.mcs; i++) {
				var t = G.rates ? MCS_TABLE[G.rates[i][0]] : MCS_TABLE[i];
				var rate = G.rates ? G.rates[i][2] : t[2];
				selM.append(el('option', { value: i, text: (G.rates ? (i + 1) + ': ' : 'MCS ' + i + ': ') + t[0] + ' ' + rate }));
			}
			if (st.m >= G.mcs) { st.m = G.mcs - 1; }
			selM.value = st.m;
			selN.replaceChildren(); for (var s = 1; s <= G.ss; s++) { selN.append(el('option', { value: s, text: String(s) })); }
			if (st.n > G.ss) { st.n = G.ss; } selN.value = st.n;
			selG.replaceChildren(); Object.keys(G.tsym).forEach(function (g) { selG.append(el('option', { value: g, text: g })); });
			if (!G.tsym[st.gi]) { st.gi = Object.keys(G.tsym)[0]; } selG.value = st.gi;
			selN.disabled = G.ss === 1; selG.disabled = Object.keys(G.tsym).length === 1;
		}
		function calc() {
			var G = GENS[st.g], bits, r;
			if (G.dsss) {
				var d = DSSS_RATES[st.m];
				ro.set(fmt(d.mbps, 1) + ' Mbps'); roBits.set(String(d.bits)); roT.set(fmt(1 / d.symrate, 3) + ' µs');
				eq.textContent = 'rate = symbol rate x bits per symbol = ' + d.symrate + ' Msym/s x ' + d.bits + ' = ' + fmt(d.mbps, 1) + ' Mbps. Each symbol is ' + d.chips + ' chips (' + d.code + ') sent at 11 Mchip/s, using ' + d.mod + '.';
				note.textContent = 'This is the PHY rate of the original spread-spectrum radio. 802.11b uses one 22 MHz-wide channel and one spatial stream, and has no subcarriers: the number of bits per symbol is what changes between 1, 2, 5.5 and 11 Mbps.';
				return;
			}
			if (G.rates) { bits = MCS_TABLE[G.rates[st.m][0]][1]; r = G.rates[st.m][2]; }
			else { var t = MCS_TABLE[st.m]; bits = t[1]; r = t[2]; }
			var num = r.split('/'), R = Number(num[0]) / Number(num[1]);
			var nsd = G.sd[st.w], tsym = G.tsym[st.gi];
			var rate = nsd * bits * R * st.n / tsym;
			ro.set(fmt(rate, rate >= 1000 ? 0 : 1) + ' Mbps');
			roBits.set(String(bits));
			roT.set(fmt(tsym, 1) + ' µs');
			eq.textContent = 'rate = N_SD x bits x coding rate x streams / T_SYM = ' + nsd + ' x ' + bits + ' x ' + r + ' x ' + st.n + ' / ' + fmt(tsym, 1) + ' µs = ' + fmt(rate, 1) + ' Mbps';
			var lim = '';
			if (band === '2.4') { lim = ' In 2.4 GHz the practical channel is 20 MHz; 40 MHz is defined but leaves room for about one channel.'; }
			if (band === '5' && st.g === 'ac') { lim = ' 802.11ac (VHT) is a 5 GHz-only generation.'; }
			if (band === '6') { lim = ' Only 802.11ax and 802.11be devices may operate in 6 GHz, so older generations are not offered.'; }
			note.textContent = 'This is the PHY rate: the speed of the radio waveform for one link. Real throughput is lower, since contention, headers, acknowledgements, retries and management traffic all use airtime.' + lim;
		}
		selGen.addEventListener('change', function () { st.g = selGen.value; fillRest(); calc(); });
		selW.addEventListener('change', function () { st.w = Number(selW.value); calc(); });
		selM.addEventListener('change', function () { st.m = Number(selM.value); calc(); });
		selN.addEventListener('change', function () { st.n = Number(selN.value); calc(); });
		selG.addEventListener('change', function () { st.gi = selG.value; calc(); });
		fillGen(); fillRest(); calc();
	}

	/* =====================================================================
	 * Quiz
	 * ===================================================================== */
	var QUIZ = {
		'2.4': [
			{ q: 'Which set of 20 MHz channels is the classic non-overlapping plan in 2.4 GHz?', a: ['1, 6, 11', '1, 2, 3', '2, 7, 12', '1, 4, 8'], c: 0, e: 'Channels are 5 MHz apart but about 20 MHz wide, so you need five channel numbers between non-overlapping neighbours: 1, 6 and 11.' },
			{ q: '802.11g brought which waveform to 2.4 GHz?', a: ['OFDM', 'FHSS', 'Barker-coded DSSS only', 'OFDMA'], c: 0, e: '802.11g used the same OFDM as 802.11a (and stayed compatible with 802.11b). OFDMA arrived later, with 802.11ax.' },
			{ q: 'True or false: 2.4 GHz is a modulation technique.', a: ['False: it is a frequency band', 'True'], c: 0, e: 'A band is where the signal sits. Modulation (such as QPSK or QAM) and the waveform (DSSS, OFDM) describe how it is shaped.' }
		],
		'5': [
			{ q: 'Why do some 5 GHz channels require a radar check?', a: ['Radar and some other services share them (DFS)', 'They are reserved for Wi-Fi 6', 'They are only for outdoor use', 'They carry no data'], c: 0, e: 'Dynamic Frequency Selection (introduced for Europe by 802.11h) makes Wi-Fi vacate a channel when it detects radar.' },
			{ q: 'Which generation runs only in 5 GHz?', a: ['802.11ac (Wi-Fi 5)', '802.11n (Wi-Fi 4)', '802.11ax (Wi-Fi 6)', '802.11b'], c: 0, e: '802.11ac (VHT) is a 5 GHz-only generation. The other generations are not tied to a single band.' },
			{ q: 'How many 160 MHz channels fit in the 5 GHz plan (UK or US)?', a: ['2', '6', '12', '25'], c: 0, e: '36 to 64 and 100 to 128. That is why very wide channels are fragile in dense 5 GHz networks.' }
		],
		'6': [
			{ q: 'Which devices may operate in 6 GHz?', a: ['802.11ax (HE) and later only', 'Any 802.11 device', 'Only 802.11ac', 'Only 802.11n'], c: 0, e: 'The 6 GHz band is limited to HE and newer devices, so there are no legacy clients and a clean start.' },
			{ q: 'What does a PSC (preferred scanning channel) help with?', a: ['Faster discovery, since scanning every channel is slow', 'Higher power', 'Longer range', 'Encryption'], c: 0, e: 'In 6 GHz there are 59 channels in the US. PSCs are every 16th channel (15 of them), so clients scan those first.' },
			{ q: 'Where do 320 MHz channels exist?', a: ['Only in 6 GHz', 'In every Wi-Fi band', 'Nowhere: the standard does not define them', 'Only for indoor use'], c: 0, e: '320 MHz channels need about 320 MHz of clean spectrum, which only the 6 GHz band offers. They were introduced with 802.11be (Wi-Fi 7).' }
		]
	};
	QUIZ.dsss = [
		{ q: 'How much processing gain does an 11-chip spreading code give?', a: ['About 10.4 dB', 'About 3 dB', 'About 20 dB', 'None: spreading only costs bandwidth'], c: 0, e: 'Processing gain is 10 log10(chips per bit) = 10 log10(11) = 10.4 dB.' },
		{ q: 'In 802.11 DBPSK at 1 Mbit/s, what does a data bit of 1 do to the next symbol?', a: ['Flips its phase by 180 degrees', 'Doubles its amplitude', 'Moves it to another channel', 'Switches the Barker code off'], c: 0, e: 'DBPSK is differential: a 1 changes the phase relative to the previous symbol and a 0 leaves it unchanged.' },
		{ q: 'Compared with the peak of 11, how large can the Barker-11 correlation be at any other shift?', a: ['At most 1', 'About 5', 'About 11', 'Exactly 0 at every shift'], c: 0, e: 'The sidelobes are only 0 or -1, so the peak stands far above everything else.' }
	];
	QUIZ.fhss = [
		{ q: 'Is FHSS part of the current IEEE 802.11 standard (IEEE Std 802.11-2020)?', a: ['No: it belongs to the 1997 original', 'Yes, as one of the main PHYs', 'Yes, but only for 5 GHz', 'It was never part of 802.11'], c: 0, e: 'The 2020 standard has no FHSS clause. The 1997 original defined both an FHSS and a DSSS radio.' },
		{ q: 'A 22 MHz-wide network sits on top of the 79 one-MHz hop channels. Roughly what share of hops is hit?', a: ['About 28%', 'All of them', 'About 1%', 'None'], c: 0, e: '22 busy channels out of 79 is about 28%, and each lost packet is retried on the next hop.' },
		{ q: 'What is the idea of frequency hopping?', a: ['Keep the signal narrow but move it between channels in a pattern both ends know', 'Spread each bit over 11 chips', 'Use many slow subcarriers', 'Send the same data on every channel at once'], c: 0, e: 'Hopping spreads the signal in time and frequency, not by making it wider at any instant.' }
	];
	QUIZ.cck = [
		{ q: 'How many bits does one CCK symbol carry at 11 Mbit/s?', a: ['8', '4', '2', '11'], c: 0, e: 'Eight bits per symbol at 1.375 million symbols a second gives 11 Mbit/s.' },
		{ q: 'How many chips are in one CCK symbol?', a: ['8', '11', '4', '64'], c: 0, e: 'A CCK symbol is an 8-chip code word sent at 11 Mchip/s, so it lasts about 0.73 microseconds.' },
		{ q: 'What did CCK keep the same as the 2 Mbit/s DSSS radio?', a: ['The 11 Mchip/s chip rate and the 22 MHz channel', 'The Barker code', 'The symbol rate of 1 Msym/s', 'The use of OFDM subcarriers'], c: 0, e: 'CCK raised the speed by putting more bits into each symbol, not by changing the chip rate or channel width.' }
	];
	QUIZ.ofdm = [
		{ q: 'How many subcarriers carry data in a 20 MHz 802.11a/g OFDM symbol?', a: ['48 (plus 4 pilots)', '52 (plus 4 pilots)', '64', '11'], c: 0, e: '52 subcarriers are used: 48 for data and 4 pilots. The IFFT has 64 points, with the rest left empty.' },
		{ q: 'What is the subcarrier spacing for a 20 MHz channel with a 64-point FFT?', a: ['312.5 kHz', '1 MHz', '78.125 kHz', '20 MHz'], c: 0, e: '20 MHz / 64 = 312.5 kHz, and 1 / 312.5 kHz = 3.2 microseconds, the useful symbol time.' },
		{ q: 'An echo arrives 0.5 microseconds late and the guard interval is 0.8 microseconds. What happens?', a: ['No inter-symbol interference: the echo falls inside the guard interval', 'The symbol is lost', 'The channel changes', 'The subcarriers stop being orthogonal at the receiver for ever'], c: 0, e: 'Echoes shorter than the guard interval only change the phase and gain of each subcarrier, which the receiver corrects.' }
	];

	QUIZ.fwaves = [
		{ q: 'A Wi-Fi signal at 2437 MHz has a wavelength of about:', a: ['12 cm', '1.2 m', '12 mm', '12 m'], c: 0, e: 'wavelength = c / f = 299 792 458 / 2 437 000 000 = 0.123 m, about 12 cm.' },
		{ q: 'You double the frequency. What happens to the wavelength?', a: ['It halves', 'It doubles', 'It stays the same', 'It quadruples'], c: 0, e: 'wavelength = c / f, and c is fixed, so doubling f halves the wavelength.' },
		{ q: 'Two equal waves arrive half a cycle (180 degrees) apart. What does the receiver see?', a: ['They cancel: a null', 'Twice the amplitude', 'The same as one wave', 'A different frequency'], c: 0, e: 'Equal waves in opposite phase add to zero. This is why moving a receiver a few centimetres can change the signal so much.' },
		{ q: 'Amplitude is doubled. By what factor does power increase?', a: ['4', '2', '8', '1'], c: 0, e: 'Power is proportional to amplitude squared, so twice the amplitude is four times the power.' }
	];
	QUIZ.fdb = [
		{ q: 'What is 20 dBm in milliwatts?', a: ['100 mW', '20 mW', '2 mW', '1000 mW'], c: 0, e: '10 ^ (20 / 10) = 100 mW. Each +10 dB is ten times the power.' },
		{ q: 'A cable loses 3 dB. Roughly how much of the power gets through?', a: ['Half', 'A tenth', 'A quarter', 'Almost all'], c: 0, e: '-3 dB is a factor of 10 ^ (-0.3) = 0.501, about half.' },
		{ q: 'A 15 dBm transmitter feeds a 2 dB cable and a 5 dBi antenna. What is the EIRP?', a: ['18 dBm', '22 dBm', '12 dBm', '20 dBm'], c: 0, e: '15 - 2 + 5 = 18 dBm. Decibels simply add and subtract along a chain.' },
		{ q: 'What does the i in dBi stand for?', a: ['Isotropic: gain compared with an antenna that radiates equally in every direction', 'Indoor', 'Interference', 'Integrated'], c: 0, e: 'An isotropic radiator is the ideal reference. A real antenna does not add power: it concentrates it in some directions.' }
	];

	QUIZ.fprop = [
		{ q: 'You double the distance in free space. How much extra path loss is that?', a: ['6 dB', '3 dB', '12 dB', '20 dB'], c: 0, e: 'Free-space loss follows 20 log10(distance), and 20 log10(2) is 6 dB: a quarter of the power.' },
		{ q: 'With the same antennas and power, which band reaches least far in free space?', a: ['6 GHz', '2.4 GHz', '5 GHz', 'They all reach the same'], c: 0, e: 'Free-space path loss rises with frequency (20 log10 f), so the highest frequency loses the most over the same distance.' },
		{ q: 'A directional antenna with 12 dBi gain is fed 15 dBm with no cable loss. What is the EIRP?', a: ['27 dBm', '3 dBm', '15 dBm', '12 dBm'], c: 0, e: 'EIRP = transmitter power - cable loss + antenna gain = 15 + 12 = 27 dBm in the strongest direction.' },
		{ q: 'What does the first Fresnel zone tell you?', a: ['How much clear space is needed around the line of sight', 'How far the signal reaches', 'Which channel to use', 'How strong the transmitter is'], c: 0, e: 'Obstacles that cut into the first Fresnel zone cost signal even when the straight line is clear; about 60% of its radius should be kept free.' }
	];
	QUIZ.qam = [
		{ q: 'How many bits does one 64-QAM symbol carry?', a: ['6', '4', '8', '64'], c: 0, e: '64 = 2^6 points, so each symbol carries 6 bits. 256-QAM carries 8, 1024-QAM 10 and 4096-QAM 12.' },
		{ q: 'Why does higher-order QAM need a cleaner signal?', a: ['The points sit closer together, so less noise pushes a symbol to the wrong decision', 'It uses more bandwidth', 'It transmits at lower power', 'It cannot be coded'], c: 0, e: 'At the same average power more points means a smaller gap between neighbours.' },
		{ q: 'What is Gray coding in a constellation?', a: ['Neighbouring points differ by only one bit', 'Points are painted by colour', 'Bits are inverted before sending', 'Only the corners are used'], c: 0, e: 'When noise pushes a symbol to a neighbouring point it then causes just one bit error.' },
		{ q: 'Which generation first defined 1024-QAM?', a: ['802.11ax (Wi-Fi 6)', '802.11ac (Wi-Fi 5)', '802.11n (Wi-Fi 4)', '802.11be (Wi-Fi 7)'], c: 0, e: '802.11n and 802.11a/g stop at 64-QAM, 802.11ac adds 256-QAM, 802.11ax adds 1024-QAM and 802.11be adds 4096-QAM.' }
	];
	QUIZ.ofdma = [
		{ q: 'What does OFDMA add to OFDM?', a: ['It lets several clients share one transmission by using different resource units', 'It makes the channel wider', 'It removes the guard interval', 'It switches to a different band'], c: 0, e: 'OFDM gives the whole channel to one client at a time; OFDMA divides it into resource units for several.' },
		{ q: 'How many 26-tone resource units fit in a 20 MHz 802.11ax channel?', a: ['9', '2', '18', '4'], c: 0, e: 'A 20 MHz channel holds up to nine 26-tone RUs (18 in 40 MHz, 37 in 80 MHz).' },
		{ q: 'When does OFDMA help most?', a: ['Many clients each sending small packets', 'One client downloading a huge file', 'A single client very close to the access point', 'Only in the 2.4 GHz band'], c: 0, e: 'It spreads the fixed cost of a transmission (contention, preamble, acknowledgement) across several clients.' }
	];
	QUIZ.mimo = [
		{ q: 'An access point has 4 antennas and the phone has 2. How many spatial streams can they use?', a: ['2', '4', '6', '8'], c: 0, e: 'The number of streams is limited by the smaller antenna count.' },
		{ q: 'What does beamforming do?', a: ['Adjusts the phase of each antenna so the signals add up in a chosen direction', 'Increases the transmit power', 'Changes the channel', 'Removes the need for encryption'], c: 0, e: 'In the chosen direction the waves arrive in step and reinforce each other; elsewhere they partly cancel.' },
		{ q: 'What is the array gain of 4 antennas sending the same total power in a beam?', a: ['About 6 dB', 'About 3 dB', 'About 12 dB', '0 dB'], c: 0, e: '10 log10(4) = 6 dB at the peak of the beam.' },
		{ q: 'What does multi-user MIMO let an access point do?', a: ['Send different streams to different clients at the same time', 'Use two bands at once', 'Raise the modulation order', 'Skip the acknowledgement'], c: 0, e: 'It is spatial separation between clients: downlink in 802.11ac, and both directions in 802.11ax.' }
	];
	QUIZ.mac = [
		{ q: 'What does a station do when it wants to send and the channel is busy?', a: ['It waits, counting down a random backoff while the channel is idle', 'It sends anyway', 'It switches band', 'It sends twice as loud'], c: 0, e: 'CSMA/CA: listen first, count down a random backoff, and send only when the counter reaches zero on an idle channel.' },
		{ q: 'What happens to the contention window after a collision?', a: ['It roughly doubles (15, 31, 63 ... up to 1023)', 'It stays the same', 'It resets to 0', 'It halves'], c: 0, e: 'Doubling makes a repeat collision less likely; after a success the window returns to aCWmin.' },
		{ q: 'Why is the real throughput of a 54 Mbit/s link around 30 Mbit/s?', a: ['Waiting time, preamble, interframe spaces and the acknowledgement take airtime', 'The standard limits it', 'Encryption halves it', 'Distance only'], c: 0, e: 'Overheads are a roughly fixed time per frame, so they take a bigger share as the data part gets faster.' },
		{ q: 'What problem does RTS/CTS address?', a: ['Hidden nodes that cannot hear each other', 'Weak signal', 'Wrong channel', 'Weak passwords'], c: 0, e: 'The access point’s CTS is heard by both clients, so the one that cannot hear the sender still stays quiet.' }
	];
	QUIZ.qos = [
		{ q: 'What does a priority label on a Wi-Fi packet decide?', a: ['Which of four waiting lines (access categories) it joins', 'How strong the signal is', 'Which channel it uses', 'Whether it is encrypted'], c: 0, e: 'The user priority (0 to 7) in the QoS Control field maps to voice, video, best effort or background.' },
		{ q: 'Which access category waits the least before sending?', a: ['Voice', 'Video', 'Best effort', 'Background'], c: 0, e: 'Voice has the smallest AIFSN and the smallest contention window, so it usually wins the race.' },
		{ q: 'When do the priority labels make the biggest difference?', a: ['When the channel is crowded', 'When the network is empty', 'Only on 2.4 GHz', 'Only for downloads'], c: 0, e: 'With no competition everyone sends at once. Priority decides who goes first only when devices compete.' },
		{ q: 'Why might an app marked as voice still end up in the normal line?', a: ['The label was never set, or was removed on the way', 'Voice is not supported by Wi-Fi', 'The channel is too wide', 'The password is wrong'], c: 0, e: 'Labels are only as good as whoever sets them, and some routers rewrite or clear them. Capture and check the QoS field.' }
	];
	QUIZ.bss = [
		{ q: 'What is a BSS colour?', a: ['A number from 1 to 63 that every Wi-Fi 6 packet carries to say which network it belongs to', 'The colour of the router’s light', 'A type of encryption', 'The name of the channel'], c: 0, e: 'It is a 6-bit field in the HE-SIG-A part of the PHY header, announced in the HE Operation element of beacons.' },
		{ q: 'A router hears a packet with a different colour that is fairly faint. What may a Wi-Fi 6 router do?', a: ['Ignore it and send at lower power', 'Always wait', 'Switch to another band', 'Send at full power'], c: 0, e: 'OBSS PD-based spatial reuse: it may transmit if it lowers its power by the number of dB it raised its threshold above -82 dBm.' },
		{ q: 'What happens when two neighbouring networks pick the same colour?', a: ['They treat each other’s packets as their own and wait for each other again', 'Nothing, it is better', 'Both stop working', 'The channel changes'], c: 0, e: 'A colour collision removes the benefit. One router announces a colour change and moves.' },
		{ q: 'Which devices can use BSS colouring?', a: ['Wi-Fi 6 and later (802.11ax and 802.11be)', 'All Wi-Fi devices', 'Only 2.4 GHz devices', 'Only phones'], c: 0, e: 'Older devices cannot read the colour, so they still follow the old wait-if-you-hear-anything rule.' }
	];
	QUIZ.gens = [
		{ q: 'Which generation introduced MIMO?', a: ['802.11n (Wi-Fi 4)', '802.11g', '802.11ac (Wi-Fi 5)', '802.11a'], c: 0, e: '802.11n added MIMO with up to four spatial streams, 40 MHz channels and frame aggregation.' },
		{ q: 'Which generation introduced OFDMA?', a: ['802.11ax (Wi-Fi 6)', '802.11ac (Wi-Fi 5)', '802.11n (Wi-Fi 4)', '802.11g'], c: 0, e: 'OFDMA arrived with 802.11ax and continues in 802.11be.' },
		{ q: 'Which generation works only in 5 GHz?', a: ['802.11ac (Wi-Fi 5)', '802.11n', '802.11ax', '802.11be'], c: 0, e: '802.11a is also 5 GHz only, but of the Wi-Fi Alliance generations, Wi-Fi 5 is the 5 GHz-only one.' },
		{ q: 'What is the headline new idea of 802.11be (Wi-Fi 7)?', a: ['Multi-link operation, 320 MHz channels and 4096-QAM', 'OFDM', 'CCK', 'FHSS'], c: 0, e: 'Wi-Fi 7 combines wider channels, higher modulation and the ability to use several links at once.' }
	];
	QUIZ.assoc = [
		{ q: 'In what order does a client join a WPA2-Personal network?', a: ['Discover, authenticate, associate, four-way handshake', 'Four-way handshake, associate, discover', 'Associate, discover, authenticate', 'Discover, handshake, authenticate'], c: 0, e: 'Open-system authentication and association come first; the four-way handshake then derives the keys.' },
		{ q: 'A client has the wrong password. What do you typically see?', a: ['The four-way handshake fails and the client is deauthenticated (reason 15)', 'The beacon disappears', 'The access point changes channel', 'The association response has status 0 and all is well'], c: 0, e: 'The message integrity code cannot be verified, so the exchange stalls and ends with a deauthentication.' },
		{ q: 'What is a sticky client?', a: ['A client that stays on a distant access point although a nearer one is stronger', 'A client that never sleeps', 'A client stuck at 1 Mbit/s', 'An access point that never roams'], c: 0, e: 'Clients decide when to roam. Many wait until the signal is poor.' },
		{ q: 'Which amendment lets the access point suggest a better access point to a client?', a: ['802.11v (BSS transition management)', '802.11k', '802.11r', '802.11e'], c: 0, e: '802.11k gives the neighbour list, 802.11v suggests the move, 802.11r speeds up the key setup.' }
	];
	QUIZ.coex = [
		{ q: 'Which is likely to hurt 2.4 GHz Wi-Fi most when you cannot decode it?', a: ['Non-Wi-Fi interference such as a microwave oven', 'Another Wi-Fi network on the same channel', 'A weak password', 'Too many SSIDs'], c: 0, e: 'Wi-Fi can decode and take turns with other Wi-Fi on the same channel; non-Wi-Fi energy is only noise that cannot be shared.' },
		{ q: 'What is the preamble detection level for CCA with 20 MHz Wi-Fi?', a: ['-82 dBm', '-62 dBm', '-30 dBm', '0 dBm'], c: 0, e: 'A valid Wi-Fi signal at -82 dBm or stronger makes the channel busy; non-Wi-Fi energy needs to reach -62 dBm.' },
		{ q: 'Two clients cannot hear each other but both reach the access point. What is this?', a: ['A hidden node problem', 'Adjacent-channel interference', 'A DFS event', 'Roaming'], c: 0, e: 'They cannot sense each other, so their frames can collide at the access point.' },
		{ q: 'Which ZigBee channels sit between Wi-Fi channels 1, 6 and 11?', a: ['15, 20, 25 and 26', '11, 12 and 13', 'All of them', 'None'], c: 0, e: 'ZigBee channels are 5 MHz apart and only 2 MHz wide, so these four avoid the three Wi-Fi channels.' }
	];
	QUIZ.meas = [
		{ q: 'A strong signal and a slow link. What is a likely cause?', a: ['A high noise floor or interference, so SNR is poor', 'The password', 'The SSID length', 'The access point colour'], c: 0, e: 'Signal strength alone is not enough: the rate depends on signal-to-noise ratio.' },
		{ q: 'Which Wireshark field shows the retry flag of a frame?', a: ['wlan.fc.retry', 'wlan.ssid', 'radiotap.length', 'eapol'], c: 0, e: 'A high share of frames with the retry bit set means many lost frames and wasted airtime.' },
		{ q: 'What does jitter measure?', a: ['Variation in packet delay', 'Packet size', 'Signal strength', 'Channel width'], c: 0, e: 'Real-time services such as calls and games suffer when delay varies.' },
		{ q: 'Why compare RSSI only on the same device?', a: ['Vendors scale and calibrate RSSI differently', 'It is illegal otherwise', 'RSSI changes with colour', 'It is always the same'], c: 0, e: 'RSSI is defined loosely, so readings from different devices cannot be compared directly.' }
	];
	QUIZ.eng = [
		{ q: 'When do more access points on the same channel stop adding capacity?', a: ['When they share one channel, because they share its airtime', 'Never', 'When they are indoors', 'When the password is long'], c: 0, e: 'Access points that hear each other on one channel take turns, so capacity grows only if they can use different channels.' },
		{ q: 'What should you do before changing a design after a survey?', a: ['Compare results with the targets you set at the start', 'Buy more access points', 'Delete the survey', 'Change the SSID'], c: 0, e: 'Validation is only meaningful against agreed, measurable targets.' },
		{ q: 'Why keep each access point well below full load?', a: ['Headroom keeps delay and jitter low and absorbs peaks', 'The standard demands it', 'It saves electricity', 'It improves the signal'], c: 0, e: 'A busy shared channel has long queues; a margin keeps latency predictable.' },
		{ q: 'What is the aim of a standard test plan such as Broadband Forum TR-398?', a: ['Repeatable, comparable performance tests of Wi-Fi equipment', 'Selling hardware', 'Choosing the SSID', 'Changing regulations'], c: 0, e: 'It defines test setups and cases (such as range versus rate, airtime fairness and multi-client performance) so results can be compared.' }
	];

	QUIZ.frames = [
		{ q: 'How long is the MAC header of a plain 802.11 data frame (three addresses, no QoS)?', a: ['24 bytes', '14 bytes', '30 bytes', '36 bytes'], c: 0, e: 'Frame Control 2, Duration 2, three addresses 18 and Sequence Control 2 make 24 bytes. A fourth address (To DS and From DS both 1) makes 30; QoS Control adds 2 and HT Control adds 4.' },
		{ q: 'Which amendment added the QoS Control field?', a: ['802.11e', '802.11n', '802.11ac', '802.11ax'], c: 0, e: '802.11e added QoS Control (TID, ack policy, A-MSDU present and more) so that frames can be given a priority.' },
		{ q: 'A client sends a data frame to its access point (To DS = 1, From DS = 0). What does Address 1 hold?', a: ['The BSSID (the access point)', 'The source address', 'The destination address', 'The transmitter address of the client'], c: 0, e: 'Address 1 is the receiver (the access point), Address 2 is the transmitter and source (the client) and Address 3 is the final destination.' },
		{ q: 'What happened to the Order bit at the end of Frame Control in 802.11n?', a: ['It became +HTC: 1 means a 4-byte HT Control field follows', 'It was removed', 'It became the Retry bit', 'It moved to the QoS Control field'], c: 0, e: 'The Frame Control field is still 16 bits, but its last bit is now read as +HTC in QoS Data and management frames.' },
		{ q: 'Which frame is the shortest?', a: ['ACK or CTS at 14 bytes', 'RTS at 20 bytes', 'Block Ack at 32 bytes', 'QoS Data at 26 bytes plus the body'], c: 0, e: 'ACK and CTS carry only Frame Control, Duration, one address and the FCS.' },
		{ q: 'What does an A-MPDU do that an A-MSDU does not?', a: ['Each frame keeps its own header and FCS, so one error loses only that frame', 'It removes the preamble', 'It encrypts better', 'It uses a different band'], c: 0, e: 'An A-MSDU shares one header and FCS, so one error loses everything; an A-MPDU delimits complete MPDUs and one Block Ack answers them all.' }
	];

	function modelQuiz(root, band) {
		var qs = QUIZ[band], score = 0, done = 0;
		var out = el('p', { class: 'lab-quiz__score', 'aria-live': 'polite' });
		qs.forEach(function (q, qi) {
			var fb = el('p', { class: 'lab-quiz__fb', 'aria-live': 'polite' });
			var opts = el('div', { class: 'lab-quiz__opts' });
			q.a.forEach(function (a, ai) {
				var b = el('button', { type: 'button', class: 'lab-quiz__opt', text: a });
				b.addEventListener('click', function () {
					if (opts.getAttribute('data-done')) { return; }
					opts.setAttribute('data-done', '1'); done++;
					var ok = ai === q.c; if (ok) { score++; }
					b.classList.add(ok ? 'is-right' : 'is-wrong');
					if (!ok) { opts.children[q.c].classList.add('is-right'); }
					fb.textContent = (ok ? 'Correct. ' : 'Not quite. ') + q.e;
					if (done === qs.length) { out.textContent = 'You scored ' + score + ' out of ' + qs.length + '.'; }
				});
				opts.append(b);
			});
			root.append(el('div', { class: 'lab-quiz__q' }, [el('p', { class: 'lab-quiz__t', text: (qi + 1) + '. ' + q.q }), opts, fb]));
		});
		root.append(out);
	}

	/* =====================================================================
	 * Rules and regulations panel (UK Ofcom default, US FCC on click)
	 * Figures quoted from: Ofcom IR 2030 v1.16 (April 2026), Ofcom information sheet "5 GHz RLANs",
	 * FCC 20-51 (Table 3) and 47 CFR Part 15. Regulations change; always check the regulator.
	 * ===================================================================== */
	var OFCOM_5 = 'https://www.ofcom.org.uk/__data/assets/pdf_file/0019/136009/Ofcom-Information-Sheet-5-GHz-RLANs.pdf';
	var OFCOM_IR2030 = 'https://www.ofcom.org.uk/siteassets/resources/documents/spectrum/interface-requirements/ir-2030.pdf';
	var OFCOM_6 = 'https://www.ofcom.org.uk/spectrum/innovative-use-of-spectrum/consultation-expanding-access-to-the-6-ghz-band-for-commercial-mobile-and-wi-fi-services/';
	var FCC_2051 = 'https://docs.fcc.gov/public/attachments/FCC-20-51A1.pdf';
	var ECFR15 = 'https://www.ecfr.gov/current/title-47/part-15';

	var ETSI_328 = 'https://www.etsi.org/deliver/etsi_en/300300_300399/300328/02.02.02_60/en_300328v020202p.pdf';
	var ETSI_893 = 'https://www.etsi.org/deliver/etsi_en/301800_301899/301893/02.01.01_60/en_301893v020101p.pdf';
	var ETSI_687 = 'https://www.etsi.org/deliver/etsi_en/303600_303699/303687/01.01.01_60/en_303687v010101p.pdf';
	var CEPT_NOTE = 'https://www.ieee802.org/18/Meeting_documents/2007_Nov/FM(07)133_2.4%20GHz%20Wireless%20Networking%20Issues.doc';
	var ECFR247 = 'https://www.ecfr.gov/current/title-47/section-15.247';
	var ECFR407 = 'https://www.ecfr.gov/current/title-47/section-15.407';

	var RULES = {
		'2.4': {
			uk: { title: 'UK: Ofcom, UK Interface Requirement 2030, entry IR2030/7/1',
				who: [
					['Regulator', 'Ofcom (the Office of Communications)'],
					['Rule', 'UK Interface Requirement 2030 (IR 2030), entry IR2030/7/1: wideband data transmission systems in 2400 to 2483.5 MHz'],
					['Legal basis', 'Wireless Telegraphy Act 2006 licence exemption; Radio Equipment Regulations 2017'],
					['Standards cited', 'ETSI EN 300 328 and EN 303 422']
				],
				head: ['Item', 'Rule'],
				rows: [
					['Spectrum', '2400 to 2483.5 MHz'],
					['Licence', 'Licence-exempt'],
					['Maximum power', '100 mW (20 dBm) EIRP'],
					['Power density', '100 mW per 100 kHz EIRP when frequency hopping is used; 10 mW per MHz EIRP for other types of modulation such as OFDM'],
					['Channel access', 'Techniques to access spectrum and mitigate interference at least equivalent to those in the designated standards must be used'],
					['Channels', '1 to 13 (channel 14 at 2484 MHz is outside the band)'],
					['DFS / TPC', 'Not required']
				],
				extra: 'IR 2030 is the UK\u2019s national interface requirement for short-range devices. For 2.4 GHz it sets the same headline limits as the European rule and points to the ETSI standard for the behaviour rules (such as listen-before-talk). Version 1.16 (April 2026) is the current edition.',
				src: [['Ofcom IR 2030, current edition (entry IR2030/7/1)', OFCOM_IR2030]] },
			eu: { title: 'EU: ETSI EN 300 328 under the Radio Equipment Directive',
				who: [
					['Legal basis', 'Radio Equipment Directive 2014/53/EU (equipment is CE marked)'],
					['Spectrum harmonisation', 'CEPT / ECC: ERC Recommendation 70-03, Annex 3 (wide band data transmission systems)'],
					['Harmonised standard', 'ETSI EN 300 328 (wideband transmission systems in the 2.4 GHz band)'],
					['National regulators', 'Each member state’s regulator (for example BNetzA in Germany, ANFR in France) applies the rules']
				],
				head: ['Item', 'Rule'],
				rows: [
					['Spectrum', '2400 to 2483.5 MHz'],
					['Maximum power', '20 dBm (100 mW) mean EIRP, for both frequency hopping and other (non-hopping) modulation'],
					['Power density', '10 dBm per MHz mean EIRP for non-hopping modulation'],
					['Channel access', 'Adaptive equipment must use a channel access mechanism: listen before talk (LBT) or detect and avoid (DAA)'],
					['Channels', '1 to 13'],
					['DFS / TPC', 'Not required']
				],
				extra: 'The standard cited here is EN 300 328 V2.2.2 (2019). A harmonised standard is how a manufacturer shows compliance with the Directive; the numbers above are quoted from its limit clauses.',
				src: [['ETSI EN 300 328 V2.2.2 (harmonised standard)', ETSI_328], ['CEPT / ECC background on the 100 mW limit (ERC/REC 70-03)', CEPT_NOTE]] },
			us: { title: 'US: FCC, 47 CFR Part 15',
				who: [
					['Regulator', 'FCC (the Federal Communications Commission)'],
					['Rule', '47 CFR Part 15, section 15.247 (operation in 2400 to 2483.5 MHz)'],
					['Equipment approval', 'FCC equipment authorisation (an FCC ID)'],
					['Licensing', 'Unlicensed (Part 15)']
				],
				head: ['Item', 'Rule'],
				rows: [
					['Spectrum', '2400 to 2483.5 MHz'],
					['Maximum power', 'Digital modulation (such as OFDM): up to 1 W conducted with an antenna gain of up to 6 dBi (36 dBm EIRP); above 6 dBi the power must be reduced by the excess'],
					['Power density', '8 dBm in any 3 kHz band for digital modulation'],
					['Channels', '1 to 11'],
					['DFS / TPC', 'Not required']
				],
				extra: 'The US limit is expressed as conducted power plus antenna gain, so it allows a much higher EIRP than the UK and EU limit of 20 dBm. A device has to be configured to the limits of the country where it is used.',
				src: [['eCFR: 47 CFR 15.247', ECFR247]] }
		},
		'5': {
			uk: { title: 'UK: Ofcom, UK Interface Requirement 2030 (entries 8/1a, 8/1b, 8/2, 8/3)',
				who: [
					['Regulator', 'Ofcom'],
					['Rule', 'UK Interface Requirement 2030 (IR 2030), wireless access systems: entries IR2030/8/1a, 8/1b, 8/2 and 8/3'],
					['Technical standard', 'ETSI EN 301 893 (5 GHz RLAN)'],
					['Legal basis', 'Wireless Telegraphy Act 2006 licence exemption; Radio Equipment Regulations 2017']
				],
				head: ['Band', 'Channels', 'Where', 'Maximum EIRP', 'DFS / TPC'],
				rows: [
					['5150 to 5250 MHz (8/1a)', '36 to 48', 'Indoor and outdoor, but not as part of a fixed outdoor installation', '200 mW (10 mW/MHz)', 'TPC not required (EN 301 893)'],
					['5250 to 5350 MHz (8/1b)', '52 to 64', 'Indoor only', '200 mW (10 mW/MHz)', 'DFS and TPC'],
					['5470 to 5730 MHz (8/2)', '100 to 144', 'Indoor and outdoor', '1 W (50 mW/MHz)', 'DFS and TPC assumed'],
					['5725 to 5850 MHz (8/3)', '149 to 165', 'No fixed outdoor installation in 5730 to 5850 MHz', '200 mW (10 mW/MHz)', 'DFS removed for Wi-Fi here in April 2021']
				],
				extra: 'In 2023 Ofcom liberalised 5150 to 5250 MHz, which was indoor-only before, so older guides that call channels 36 to 48 indoor-only are out of date. 5250 to 5350 MHz is still limited to use inside a building (or aircraft or similar enclosed space) and only to connect to equipment in the same enclosed space. Airborne use is limited: 5170 to 5250 MHz may be used outside an aircraft only as stated, and 5470 to 5730 MHz and 5725 to 5850 MHz only within an aircraft. Channel 144 straddles the 5725 MHz edge of the lower bands; both Ofcom and the FCC allow it.',
				src: [['Ofcom IR 2030, current edition (entries IR2030/8/1a to 8/3)', OFCOM_IR2030], ['Ofcom information sheet: 5 GHz RLANs (older plain-language guide)', OFCOM_5]] },
			eu: { title: 'EU: ETSI EN 301 893 under the Radio Equipment Directive',
				who: [
					['Legal basis', 'Radio Equipment Directive 2014/53/EU (CE marking)'],
					['Harmonised standard', 'ETSI EN 301 893 (5 GHz RLAN: power, TPC and DFS)'],
					['Indoor / outdoor conditions', 'Set by EU and national law, not by the standard: check the national regulator'],
					['National regulators', 'Each member state’s regulator applies the rules']
				],
				head: ['Band', 'Mean EIRP with TPC', 'Mean EIRP without TPC', 'Power density (with / without TPC)', 'DFS'],
				rows: [
					['5150 to 5350 MHz', '23 dBm (200 mW)', '20 dBm (100 mW); 23 dBm if the channel lies entirely within 5150 to 5250 MHz', '10 dBm/MHz with TPC; 7 dBm/MHz without (10 within 5150 to 5250)', 'Required in 5250 to 5350 MHz'],
					['5470 to 5725 MHz', '30 dBm (1 W)', '27 dBm (500 mW)', '17 dBm/MHz with TPC; 14 dBm/MHz without', 'Required']
				],
				extra: 'TPC is not required for channels that fall completely within 5150 to 5250 MHz. Radar detection applies to any channel that falls partly or completely within 5250 to 5350 or 5470 to 5725 MHz. Figures are from EN 301 893 V2.1.1 (2017); a newer version exists, so check the current one.',
				src: [['ETSI EN 301 893 V2.1.1 (harmonised standard)', ETSI_893]] },
			us: { title: 'US: FCC, 47 CFR 15.407 (U-NII)',
				who: [
					['Regulator', 'FCC (the Federal Communications Commission)'],
					['Rule', '47 CFR Part 15, section 15.407 (unlicensed national information infrastructure, U-NII)'],
					['Equipment approval', 'FCC equipment authorisation (an FCC ID)']
				],
				head: ['Sub-band', 'Channels', 'Maximum conducted power', 'Power density', 'DFS'],
				rows: [
					['U-NII-1: 5150 to 5250 MHz', '36 to 48', '1 W (with antenna gain up to 6 dBi)', '17 dBm per MHz', 'No'],
					['U-NII-2A: 5250 to 5350 MHz', '52 to 64', 'The lesser of 250 mW and 11 dBm + 10 log B (B = 26 dB bandwidth in MHz)', '11 dBm per MHz', 'Yes'],
					['U-NII-2C: 5470 to 5725 MHz', '100 to 144', 'The lesser of 250 mW and 11 dBm + 10 log B', '11 dBm per MHz', 'Yes'],
					['U-NII-3: 5725 to 5850 MHz', '149 to 165', '1 W (with antenna gain up to 6 dBi)', '30 dBm per 500 kHz', 'No']
				],
				extra: 'With an antenna gain above 6 dBi the power and density limits are reduced by the excess (fixed point-to-point links in U-NII-3 are an exception). Outdoor U-NII-1 access points must keep EIRP above 30 degrees elevation to 125 mW (21 dBm). DFS (section 15.407(h)): sense radar across the whole emission bandwidth, listen for 60 seconds before using a channel, stop transmitting within 10 seconds of detecting radar, and stay off the channel for at least 30 minutes.',
				src: [['eCFR: 47 CFR 15.407 (U-NII devices)', ECFR407]] }
		},
		'6': {
			uk: { title: 'UK: Ofcom, lower 6 GHz (5925 to 6425 MHz)',
				who: [
					['Regulator', 'Ofcom'],
					['Rule', 'UK Interface Requirement 2030 (IR 2030), entry IR2030/7/6: wireless access systems in 5925 to 6425 MHz'],
					['Licensing', 'Licence-exempt'],
					['Status', 'The current IR 2030 (v1.16, April 2026) still lists only the low-power classes below; Ofcom\u2019s 2026 decisions on more 6 GHz access are not in it yet']
				],
				head: ['Class', 'Where', 'Maximum EIRP', 'Density limit'],
				rows: [
					['Low power indoor (LPI)', 'Indoor only', '250 mW (24 dBm)', '12.6 mW per MHz'],
					['Very low power (VLP)', 'Indoor, and outdoor on the move (no fixed outdoor use)', '25 mW (14 dBm)', '12.6 mW per MHz']
				],
				extra: 'Licence-exempt. Ofcom has since published decisions (January and July 2026) to allow outdoor and higher-power use under AFC control and to add the 6425 to 6585 MHz block, with draft regulations and an updated IR 2030 still out for consultation when its page was last updated (24 September 2026). The IR also says low-power indoor equipment must not form part of a fixed outdoor installation, and airborne use is not permitted. Treat anything beyond 5925 to 6425 MHz and LPI/VLP as pending until you have checked what is in force.',
				src: [['Ofcom IR 2030, current edition (entry IR2030/7/6)', OFCOM_IR2030], ['Ofcom: expanding access to the 6 GHz band', OFCOM_6]] },
			eu: { title: 'EU: Decision (EU) 2021/1067 and ETSI EN 303 687 (5945 to 6425 MHz)',
				who: [
					['Legal basis', 'Commission Implementing Decision (EU) 2021/1067 of 17 June 2021; Radio Equipment Directive 2014/53/EU'],
					['Spectrum harmonisation', 'CEPT / ECC Decision (20)01 (5945 to 6425 MHz for wireless access systems and RLANs)'],
					['Harmonised standard', 'ETSI EN 303 687 (6 GHz WAS / RLAN)'],
					['National regulators', 'Each member state’s regulator applies the rules']
				],
				head: ['Class', 'Maximum mean EIRP', 'Maximum mean EIRP density'],
				rows: [
					['Low power indoor (LPI)', '23 dBm (200 mW)', '10 dBm per MHz'],
					['Very low power (VLP)', '14 dBm (25 mW)', '1 dBm per MHz (10 dBm per MHz for narrowband use with a duty cycle of at most 1/15)']
				],
				extra: 'The EU band is 5945 to 6425 MHz, in 24 nominal 20 MHz channels. LPI is for indoor use; VLP devices are portable and may be used indoors and outdoors. Figures are from EN 303 687 V1.1.1 (2023), tables 2 and 3. The 2021 Decision has been amended since, so check the current annex.',
				src: [['ETSI EN 303 687 V1.1.1 (harmonised standard)', ETSI_687]] },
			us: { title: 'US: FCC 20-51 (5925 to 7125 MHz)',
				who: [
					['Regulator', 'FCC (the Federal Communications Commission)'],
					['Rule', 'Report and Order FCC 20-51 (23 April 2020), implemented in 47 CFR 15.407'],
					['Standard-power control', 'Automated Frequency Coordination (AFC) system']
				],
				head: ['Class', 'Bands', 'Maximum EIRP', 'Density limit'],
				rows: [
					['Low-power indoor access point', 'U-NII-5 to U-NII-8 (whole band)', '30 dBm (1 W)', '5 dBm/MHz'],
					['Client of a low-power access point', 'Whole band', '24 dBm', '-1 dBm/MHz'],
					['Standard-power access point (AFC)', 'U-NII-5 (5925 to 6425) and U-NII-7 (6525 to 6875)', '36 dBm', '23 dBm/MHz'],
					['Client of a standard-power access point', 'U-NII-5 and U-NII-7', '30 dBm', '17 dBm/MHz']
				],
				extra: 'Sub-bands: U-NII-5 5925 to 6425, U-NII-6 6425 to 6525, U-NII-7 6525 to 6875, U-NII-8 6875 to 7125 MHz. Standard-power operation must be controlled by an Automated Frequency Coordination (AFC) system. Adopted 23 April 2020.',
				src: [['FCC 20-51 (Table 3: expanded unlicensed use of the 6 GHz band)', FCC_2051]] }
		}
	};

	function whoBlock(rows) {
		return el('div', { class: 'lab-who' }, [el('p', { class: 'lab-who__t', text: 'Who sets the rules' }), el('dl', { class: 'lab-whol' }, rows.map(function (r) { return el('div', { class: 'lab-kv' }, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]); }))]);
	}

	function modelRegRules(root, band) {
		var host = el('div', { class: 'lab-rules' });
		var controls = el('div', { class: 'lab-controls' }, [el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: 'Regulatory domain' }), regionSeg()])]);
		root.append(controls, host);
		function draw() {
			var d = RULES[band][Region.get()];
			var thead = el('thead', {}, [el('tr', {}, d.head.map(function (h) { return el('th', { scope: 'col', text: h }); }))]);
			var tbody = el('tbody', {}, d.rows.map(function (r) { return el('tr', {}, r.map(function (c, i) { return el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row', text: c } : { text: c }); })); }));
			var links = el('ul', { class: 'lab-src' }, d.src.map(function (x) { return el('li', {}, [el('a', { href: x[1], rel: 'noopener', text: x[0] })]); }));
			var parts = [
				el('h3', { class: 'lab-rules__t', text: d.title }),
				d.who ? whoBlock(d.who) : null,
				el('div', { class: 'lab-tablewrap' }, [el('table', { class: 'lab-table' }, [thead, tbody])]),
				d.extra ? el('p', { class: 'lab-note', text: d.extra }) : null,
				el('p', { class: 'lab-note lab-note--warn', text: 'Regulations change and this is a teaching summary, not legal advice. Check the regulator\u2019s current text before you deploy or certify anything.' }),
				el('p', { class: 'lab-src__t', text: 'Sources' }), links
			].filter(Boolean);
			host.replaceChildren.apply(host, parts);
		}
		Region.on(draw);
		draw();
	}

	function modelRegion(root) {
		root.append(el('div', { class: 'lab-regionbar' }, [
			el('span', { class: 'lab-regionbar__t', text: 'Regulatory domain for this page' }),
			regionSeg(),
			el('span', { class: 'lab-regionbar__h', text: 'UK (Ofcom) is the default. Switch to the EU or US to see their rules; every map and table on the page follows.' })
		]));
	}

	/* =====================================================================
	 * Boot
	 * ===================================================================== */
	var MODELS = { region: modelRegion, regrules: modelRegRules, channels: function (root, band) { return band === '2.4' ? modelChannelsOverlap(root) : modelChannels(root, band); }, timeline: modelTimeline, waves: modelWaves, pathloss: modelPathloss, phyrate: modelPhyrate, quiz: modelQuiz };
	window.WifiLab = { el: el, svg: svg, seg: seg, readout: readout, fmt: fmt, Region: Region, RM: RM, range: range };

	function boot() {
		var ALL = Object.assign({}, MODELS, window.WifiLabModels || {});
		Array.prototype.forEach.call(document.querySelectorAll('.lab-model'), function (n) {
			var m = n.getAttribute('data-model'), band = n.getAttribute('data-band') || '2.4';
			if (ALL[m] && !n.hasAttribute('data-ready')) { n.setAttribute('data-ready', '1'); ALL[m](n, band); }
		});
		// On-this-page index for long lessons
		var toc = document.querySelector('.lab-toc__list');
		if (toc) {
			Array.prototype.forEach.call(document.querySelectorAll('.lab-lesson h2'), function (h, i) {
				if (!h.id) { h.id = 'sec-' + (i + 1); }
				var st = h.querySelector('.lab-step'); toc.append(el('li', {}, [el('a', { href: '#' + h.id, text: st ? st.textContent : h.textContent })]));
			});
		}
	}
	// deferred scripts run before DOMContentLoaded, so models registered by other lab scripts are ready by then
	if (document.readyState === 'complete') { boot(); } else { document.addEventListener('DOMContentLoaded', boot); }
})();
