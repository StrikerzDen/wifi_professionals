/* Wi-Fi Pro Lab: frames (MAC header builder), PPDU preambles and aggregation.
 * Checked against IEEE Std 802.11-2020: frame formats (clause 9.2 and 9.3), Frame Control (Figures 9-3, 9-4), Sequence
 * Control (Figure 9-7), QoS Control (Table 9-10), HT Control (Figures 9-11, 9-12, 9-16), address use (Table 9-30),
 * maximum data unit sizes (Table 9-25), A-MPDU delimiter (Table 9-527), A-MSDU subframe (Figure 9-69), CCMP/GCMP
 * expansion (12.5.3, 12.5.5) and the HT preamble timings (Table 19-6). The HE (802.11ax) and EHT (802.11be) items come
 * from those amendments, which are not in the 2020 edition; they are marked on screen.
 * Helpers come from lab.js (window.WifiLab); models register themselves in window.WifiLabModels.
 */
(function () {
	'use strict';
	var L = window.WifiLab;
	if (!L) { return; }
	var el = L.el, svg = L.svg, seg = L.seg, readout = L.readout, fmt = L.fmt;
	window.WifiLabModels = window.WifiLabModels || {};

	function text(parent, x, y, str, cls, anchor) { var t = svg('text', { x: x, y: y, class: cls || 'lab-tick', 'text-anchor': anchor || 'start' }); t.textContent = str; parent.append(t); return t; }
	function slider(label, min, max, step, val, fmtv, onInput) {
		var out = el('output', { text: fmtv(val) });
		var inp = el('input', { type: 'range', min: min, max: max, step: step, value: val, 'aria-label': label });
		inp.addEventListener('input', function () { out.textContent = fmtv(Number(inp.value)); onInput(Number(inp.value)); });
		return el('label', { class: 'lab-ctl lab-ctl--range' }, [el('span', { class: 'lab-ctl__t' }, [document.createTextNode(label + ': '), out]), inp]);
	}
	function ctl(title, node) { return el('div', { class: 'lab-ctl' }, [el('span', { class: 'lab-ctl__t', text: title }), node]); }
	function toggle(label, get, set) {
		var b = el('button', { type: 'button', 'aria-pressed': String(get()), text: label });
		b.addEventListener('click', function () { set(!get()); b.setAttribute('aria-pressed', String(get())); });
		b.sync = function () { b.setAttribute('aria-pressed', String(get())); };
		return b;
	}
	function bitstrip(parts, title) {
		var total = parts.reduce(function (a, p) { return a + p[1]; }, 0);
		var row = el('div', { class: 'lab-bits2', role: 'img', 'aria-label': title + ': ' + parts.map(function (p) { return p[0] + ' ' + p[1] + ' bits' + (p[2] !== undefined ? ' = ' + p[2] : ''); }).join(', ') });
		parts.forEach(function (p) { row.append(el('div', { class: 'lab-bits2__s' + (p[3] ? ' is-new' : ''), style: 'flex:' + p[1] + ' 1 0;min-width:' + Math.max(64, p[1] * 7) + 'px' }, [el('b', { text: p[2] === undefined ? '' : String(p[2]) }), el('span', { text: p[0] }), el('i', { text: p[1] + (p[1] === 1 ? ' bit' : ' bits') })])); });
		return el('div', { class: 'lab-bits2w' }, [el('p', { class: 'lab-bits2__t', text: title + ' (' + total + ' bits, sent bit 0 first)' }), row]);
	}
	function bin(v, n) { var s = v.toString(2); while (s.length < n) { s = '0' + s; } return s; }

	var GEN = [
		{ id: 'orig', name: '802.11 / b / a / g', short: '1997 to 2003', rank: 0 },
		{ id: 'e', name: '+ 802.11e (QoS)', short: '2005', rank: 1 },
		{ id: 'n', name: '802.11n (HT)', short: 'Wi-Fi 4', rank: 2 },
		{ id: 'ac', name: '802.11ac (VHT)', short: 'Wi-Fi 5', rank: 3 },
		{ id: 'ax', name: '802.11ax (HE)', short: 'Wi-Fi 6', rank: 4 },
		{ id: 'be', name: '802.11be (EHT)', short: 'Wi-Fi 7', rank: 5 }
	];
	var SINCE = { orig: 'in the original 802.11', e: 'added by 802.11e', n: 'added by 802.11n', ac: 'extended by 802.11ac', ax: 'extended by 802.11ax', be: 'extended by 802.11be' };

	/* Frame Control subtypes: [type, subtype, name, protocol rank that defined it, retired]. Table 9-1 of IEEE Std 802.11-2020; the Trigger frame is from 802.11ax. */
	var SUB = [
	[0, 0, 'Association Request', 0], [0, 1, 'Association Response', 0], [0, 2, 'Reassociation Request', 0], [0, 3, 'Reassociation Response', 0], [0, 4, 'Probe Request', 0], [0, 5, 'Probe Response', 0], [0, 8, 'Beacon', 0], [0, 9, 'ATIM', 0], [0, 10, 'Disassociation', 0], [0, 11, 'Authentication', 0], [0, 12, 'Deauthentication', 0], [0, 13, 'Action (first used by 802.11h in 2003)', 0], [0, 14, 'Action No Ack', 2],
	[1, 2, 'Trigger (802.11ax amendment; reserved in the 2020 edition)', 4], [1, 4, 'Beamforming Report Poll', 3], [1, 5, 'VHT NDP Announcement', 3], [1, 7, 'Control Wrapper', 2], [1, 8, 'Block Ack Request', 1], [1, 9, 'Block Ack', 1], [1, 10, 'PS-Poll', 0], [1, 11, 'RTS', 0], [1, 12, 'CTS', 0], [1, 13, 'ACK', 0], [1, 14, 'CF-End', 0], [1, 15, 'CF-End + CF-Ack (PCF)', 0, true],
	[2, 0, 'Data', 0], [2, 1, 'Data + CF-Ack (PCF)', 0, true], [2, 2, 'Data + CF-Poll (PCF)', 0, true], [2, 3, 'Data + CF-Ack + CF-Poll (PCF)', 0, true], [2, 4, 'Null', 0], [2, 5, 'CF-Ack (PCF)', 0, true], [2, 6, 'CF-Poll (PCF)', 0, true], [2, 7, 'CF-Ack + CF-Poll (PCF)', 0, true],
	[2, 8, 'QoS Data', 1], [2, 9, 'QoS Data + CF-Ack', 1], [2, 10, 'QoS Data + CF-Poll', 1], [2, 11, 'QoS Data + CF-Ack + CF-Poll', 1], [2, 12, 'QoS Null', 1], [2, 14, 'QoS CF-Poll', 1], [2, 15, 'QoS CF-Ack + CF-Poll', 1]
	];
	var CHANGES = [
	'Defines the 16-bit layout used ever since: protocol version, type, subtype, To DS, From DS, More Fragments, Retry, Power Management, More Data, WEP and Order. The data subtypes include the optional point coordination function (PCF) variants with CF-Ack and CF-Poll.',
	'802.11e turns bit 7 of the data subtype into a QoS flag: eight QoS data subtypes (QoS Data, QoS Null and others) whose header carries a QoS Control field. It adds two control subtypes, Block Ack Request and Block Ack. The WEP bit is renamed Protected Frame when 802.11i generalised encryption beyond WEP.',
	'802.11n redefines the last bit. It was Order (strictly ordered service); it becomes +HTC: in QoS Data and Management frames, 1 means a 4-byte HT Control field follows. New subtypes: Control Wrapper (lets RTS, CTS or Block Ack frames carry an HT Control field) and Action No Ack.',
	'802.11ac leaves the 16-bit layout alone. It adds two control subtypes for beamforming and MU-MIMO sounding: Beamforming Report Poll and VHT NDP Announcement. +HTC is also set for frames sent in VHT format, now with the VHT variant of the HT Control field.',
	'802.11ax keeps the layout and adds a control subtype for its scheduled access: the Trigger frame, which tells clients which resource unit to use. The HT Control field gets its HE variant. (From the 802.11ax amendment; the 2020 edition reserves this subtype.) 802.11be builds on these; no further Frame Control change is described here.'
	];
	CHANGES[5] = '802.11be builds on these; no further Frame Control change is described here.';
	var KIND_OF = { '0,8': 'beacon', '1,11': 'rts', '1,12': 'cts', '1,13': 'ack', '1,9': 'ba', '1,2': 'trigger', '2,0': 'data', '2,8': 'qos' };
	var PROT_NAME = ['the original 802.11', '802.11e', '802.11n', '802.11ac', '802.11ax', '802.11be'];

	/* =====================================================================
	 * MAC frame builder
	 * ===================================================================== */
	window.WifiLabModels.macframe = function (root) {
		var st = { g: 'n', kind: 'qos', sec: 'ccmp', to: true, from: false, htc: false, pay: 1500, users: 4, sel: 'fc', prev: null };
		var KINDS = [['data', 'Data'], ['qos', 'QoS Data'], ['beacon', 'Beacon'], ['rts', 'RTS'], ['cts', 'CTS'], ['ack', 'ACK'], ['ba', 'Block Ack'], ['trigger', 'Trigger']];
		var SECS = [['none', 'No encryption'], ['tkip', 'TKIP'], ['ccmp', 'CCMP-128 (WPA2)'], ['gcmp', 'GCMP-256 (WPA3-192)']];
		var SECB = { none: [0, 0, ''], tkip: [8, 12, 'TKIP: 8-byte IV/extended IV, then an 8-byte Michael MIC and a 4-byte ICV'], ccmp: [8, 8, 'CCMP-128: 8-byte CCMP header (packet number, key ID) and an 8-byte MIC'], gcmp: [8, 16, 'GCMP: 8-byte GCMP header and a 16-byte MIC'] };
		var gen = function () { return GEN.filter(function (g) { return g.id === st.g; })[0]; };
		function allowed(k) {
			var r = gen().rank;
			if (k === 'qos') { return r >= 1; } if (k === 'ba') { return r >= 1; } if (k === 'trigger') { return r >= 4; }
			return true;
		}
		var genSeg = seg('Protocol', GEN.map(function (g) { return [g.id, g.name]; }), st.g, function (v) { st.g = v; fix(); draw(); });
		var kindBox = el('div', { class: 'lab-ctl' }), secBox = el('div', { class: 'lab-ctl' }), flagBox = el('div', { class: 'lab-ctl' });
		var payS = slider('Payload (MSDU)', 0, 2304, 100, st.pay, function (v) { return v + ' bytes'; }, function (v) { st.pay = v; draw(); });
		var usersS = slider('Clients addressed by the trigger', 1, 9, 1, st.users, function (v) { return String(v); }, function (v) { st.users = v; draw(); });
		var controls = el('div', { class: 'lab-controls' }, [ctl('Protocol', genSeg), kindBox, secBox, flagBox, payS, usersS]);
		var rowW = el('div', { class: 'lab-frame', role: 'group', 'aria-label': 'Fields of the frame, in transmission order' }), totW = el('div', { class: 'lab-stage' }), card = el('div', { class: 'lab-panel' }), diff = el('div', { class: 'lab-panel' });
		var roH = readout('', 'MAC header', ''), roO = readout('', 'bytes of overhead (header, security, FCS)'), roT = readout('', 'bytes in the whole MPDU'), roP = readout('', 'of the frame is overhead');
		root.append(controls, rowW, totW, el('div', { class: 'lab-reads' }, [roH, roO, roT, roP]), card, diff);
		var htcT = toggle('Include the HT Control field (+HTC)', function () { return st.htc; }, function (v) { st.htc = v; draw(); });
		var toT = toggle('To DS', function () { return st.to; }, function (v) { st.to = v; draw(); });
		var fromT = toggle('From DS', function () { return st.from; }, function (v) { st.from = v; draw(); });
		function fix() { if (st.prev && !SUB.some(function (x) { return x[0] === st.prev[0] && x[1] === st.prev[1] && x[3] <= Math.min(gen().rank, 4); })) { st.prev = null; } if (!allowed(st.kind)) { st.kind = st.kind === 'qos' ? 'data' : (st.kind === 'ba' ? 'ack' : 'data'); } if (gen().rank < 2) { st.htc = false; } }
		function addrNote(i) {
			var k = st.kind, d = st.to ? 1 : 0, f = st.from ? 1 : 0;
			if (k === 'beacon') { return ['Receiver and destination address: ff:ff:ff:ff:ff:ff (broadcast)', 'Transmitter and source address: the access point’s own address', 'BSSID: identifies the network (the access point’s address)'][i]; }
			if (k === 'rts') { return ['Receiver address (RA): who must answer with a CTS', 'Transmitter address (TA): who is asking'][i]; }
			if (k === 'cts' || k === 'ack') { return 'Receiver address (RA): who the answer is for'; }
			if (k === 'ba') { return ['Receiver address (RA)', 'Transmitter address (TA)'][i]; }
			if (k === 'trigger') { return ['Receiver address (RA): usually broadcast', 'Transmitter address (TA): the access point'][i]; }
			var t = { '00': ['Destination address (DA = RA)', 'Source address (SA = TA)', 'BSSID'], '01': ['Destination address (DA = RA)', 'BSSID (the access point, TA)', 'Source address (SA)'], '10': ['BSSID (the access point, RA)', 'Source address (SA = TA)', 'Destination address (DA)'], '11': ['Receiver address (RA)', 'Transmitter address (TA)', 'Destination address (DA)', 'Source address (SA)'] }[String(d) + String(f)];
			return t[i];
		}
		function fcBits() {
			var k = st.kind, g = gen(), r = g.rank, ty = { data: 2, qos: 2, beacon: 0, rts: 1, cts: 1, ack: 1, ba: 1, trigger: 1 }[k], sub = { data: 0, qos: 8, beacon: 8, rts: 11, cts: 12, ack: 13, ba: 9, trigger: 2 }[k], isData = k === 'data' || k === 'qos';
			if (st.prev) { ty = st.prev[0]; sub = st.prev[1]; }
			var nm = SUB.filter(function (x) { return x[0] === ty && x[1] === sub; })[0];
			var dataLike = ty === 2 && !st.prev ? isData : false;
			var parts = [['Protocol version', 2, '00'], ['Type', 2, bin(ty, 2)], ['Subtype', 4, bin(sub, 4)], ['To DS', 1, dataLike && st.to ? '1' : '0'], ['From DS', 1, dataLike && st.from ? '1' : '0'], ['More fragments', 1, '0'], ['Retry', 1, '0'], ['Power management', 1, '0'], ['More data', 1, '0'], [r === 0 ? 'WEP (later Protected frame)' : 'Protected frame', 1, dataLike && st.sec !== 'none' ? '1' : '0', r >= 1], [r >= 2 ? '+HTC' : 'Order', 1, st.htc ? '1' : '0', r >= 2]];
			var box = el('div', {});
			box.append(el('p', { class: 'lab-verdict', text: CHANGES[r] }), bitstrip(parts, 'Frame Control of ' + (nm ? nm[2] : 'this frame')));
			var rows = SUB.filter(function (x) { return x[0] === ty && x[3] <= Math.min(r, 4); });
			var tb = el('table', { class: 'lab-table' }, [el('thead', {}, [el('tr', {}, ['Subtype (binary)', 'Frame', 'Defined by'].map(function (h) { return el('th', { scope: 'col', text: h }); }))]), el('tbody', {}, rows.map(function (x) {
				var on = x[1] === sub, isNew = x[3] === Math.min(r, 4) && r > 0 && r < 5, tr = el('tr', { class: 'lab-fcrow' + (on ? ' is-on' : '') + (x[4] ? ' is-retired' : '') + (isNew ? ' is-new' : ''), tabindex: '0', 'aria-selected': String(on) }, [el('th', { scope: 'row', text: bin(x[1], 4) }), el('td', { text: x[2] }), el('td', { text: x[4] ? 'the 1997 standard; reserved in the 2020 edition' : (x[3] === 0 ? 'the original 802.11' : 'new in ' + PROT_NAME[x[3]]) })]);
				var pick = function () { var kk = KIND_OF[x[0] + ',' + x[1]]; if (kk && allowed(kk)) { st.kind = kk; st.prev = null; } else { st.prev = [x[0], x[1]]; } st.sel = 'fc'; draw(); };
				tr.addEventListener('click', pick); tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }); return tr; }))]);
			box.append(el('p', { class: 'lab-bits2__t', text: 'Frame subtypes defined by ' + PROT_NAME[r] + ' in this family (click one to see its bits above; the retired PCF types are dimmed)' }), el('div', { class: 'lab-tablewrap' }, [tb]));
			return box;
		}
		function fields() {
			var k = st.kind, g = gen(), f = [], isData = k === 'data' || k === 'qos', four = isData && st.to && st.from;
			var add = function (id, name, bytes, since, desc, extra) { f.push({ id: id, name: name, bytes: bytes, since: since, desc: desc, extra: extra }); };
			add('fc', 'Frame Control', 2, 'orig', 'Says what the frame is: its type and subtype, whether it is going to or coming from the distribution system (the wired side of the access point), whether it is a retry, whether it is encrypted, and whether an HT Control field follows. The field is 16 bits in every protocol, but the meaning of its last bits and the list of subtypes grew with each one: see below.', fcBits);
			add('dur', 'Duration / ID', 2, 'orig', 'The time in microseconds the channel will stay busy after this frame, which every other station copies into its NAV timer so that it keeps quiet. In a PS-Poll frame the same two bytes carry the association ID instead.');
			if (k === 'rts' || k === 'ba' || k === 'trigger') { add('a1', 'Receiver address (RA)', 6, 'orig', addrNote(0)); add('a2', 'Transmitter address (TA)', 6, 'orig', addrNote(1)); }
			else if (k === 'cts' || k === 'ack') { add('a1', 'Receiver address (RA)', 6, 'orig', addrNote(0)); }
			else { add('a1', 'Address 1', 6, 'orig', addrNote(0)); add('a2', 'Address 2', 6, 'orig', addrNote(1)); add('a3', 'Address 3', 6, 'orig', addrNote(2)); add('sc', 'Sequence Control', 2, 'orig', 'A 12-bit sequence number (0 to 4095) that lets the receiver detect duplicates when a frame is retried, and a 4-bit fragment number for fragmented frames.', function () { return bitstrip([['Fragment number', 4, '0000'], ['Sequence number', 12, 'counts up per frame']], 'Sequence Control'); }); if (four) { add('a4', 'Address 4', 6, 'orig', addrNote(3)); } }
			if (k === 'qos') { add('qos', 'QoS Control', 2, 'e', 'Added by 802.11e for QoS Data frames. It carries the traffic identifier (TID, which maps to one of four access categories), how the frame is acknowledged, whether the body is an A-MSDU, and, in its upper eight bits, a TXOP limit, queue size or buffer state depending on who is sending.', function () { return bitstrip([['TID', 4, 'priority'], ['EOSP', 1, '0'], ['Ack policy', 2, '00'], ['A-MSDU present', 1, '0'], ['TXOP, queue size or buffer state', 8, '–']], 'QoS Control'); }); }
			if (g.rank >= 2 && st.htc && (k === 'qos' || k === 'beacon')) {
				var v = g.rank === 2 ? 'HT variant' : (g.rank === 3 ? 'VHT variant' : 'HE variant');
				add('htc', 'HT Control (' + v + ')', 4, g.id === 'n' ? 'n' : g.id, g.rank === 2 ? 'Four bytes added by 802.11n for link adaptation, calibration and sounding feedback. Present only when the +HTC bit is 1.' : (g.rank === 3 ? 'The same four bytes, now with the VHT variant (VHT bit = 1): modulation feedback (MFB), group ID and coding information for beamforming and MU-MIMO.' : 'The same four bytes, now the HE variant (first two bits 1 and 1): the other 30 bits form the A-Control field, a list of small control items such as operating mode, buffer status and scheduling requests. (HE and EHT details are from the 802.11ax and 802.11be amendments.)'), function () {
					if (g.rank === 2) { return bitstrip([['VHT', 1, '0'], ['Link adaptation control', 15, '–'], ['Calibration position', 2, '–'], ['Calibration sequence', 2, '–'], ['Reserved', 2, '–'], ['CSI / steering', 2, '–'], ['NDP announcement', 1, '–'], ['Reserved', 4, '–'], ['DEI', 1, '–'], ['AC constraint', 1, '–'], ['RDG / more PPDU', 1, '–']], 'HT Control, HT variant'); }
					if (g.rank === 3) { return bitstrip([['VHT', 1, '1'], ['Reserved', 1, '–'], ['MRQ', 1, '–'], ['MSI / STBC', 3, '–'], ['MFSI / GID-L', 3, '–'], ['MFB', 15, '–'], ['GID-H', 3, '–'], ['Coding type', 1, '–'], ['FB Tx type', 1, '–'], ['Unsolicited MFB', 1, '–'], ['AC constraint', 1, '–'], ['RDG / more PPDU', 1, '–']], 'HT Control, VHT variant'); }
					return bitstrip([['VHT', 1, '1'], ['HE', 1, '1'], ['A-Control (control list)', 30, '–']], 'HT Control, HE variant');
				});
			}
			var body = 0, bodyName = 'Frame body', bodyDesc = '';
			if (isData) { body = st.pay; bodyDesc = 'The payload: an MSDU, which starts with an 8-byte LLC/SNAP header that says which protocol follows (for example IPv4 or IPv6). It can be up to 2304 bytes, or a whole A-MSDU in HT and later.'; }
			if (k === 'beacon') { body = beaconBody(); bodyName = 'Frame body (fixed fields and elements)'; bodyDesc = 'A beacon has no payload; its body is fixed fields (timestamp 8 bytes, beacon interval 2, capability 2) followed by elements. Each generation added elements that describe its features; see the list below.'; }
			if (k === 'ba') { body = g.rank >= 2 ? 12 : 132; bodyName = 'Block Ack control and information'; bodyDesc = g.rank >= 2 ? 'Compressed Block Ack: 2 bytes of Block Ack control, 2 bytes of starting sequence control and an 8-byte bitmap that acknowledges up to 64 frames at once.' : 'Basic Block Ack from 802.11e: 2 bytes of control, 2 of starting sequence control and a 128-byte bitmap (64 frames, 2 bytes each).'; }
			if (k === 'trigger') { body = 8 + 5 * st.users; bodyName = 'Common Info and User Info fields'; bodyDesc = 'An 802.11ax control frame sent by the access point: an 8-byte Common Info field and a 5-byte User Info field for every addressed client (AID, resource unit, coding, MCS, number of streams, target power). (From the 802.11ax amendment.)'; }
			if (body > 0 || isData) { f.push({ id: 'body', name: bodyName, bytes: body, since: 'orig', desc: bodyDesc, body: true }); }
			if (isData && st.sec !== 'none') { var sb = SECB[st.sec]; f.push({ id: 'sec', name: 'Security header', bytes: sb[0], since: 'orig', desc: 'Added when the frame is encrypted. ' + sb[2] + '.', sec: true }); f.push({ id: 'mic', name: 'MIC / ICV', bytes: sb[1], since: 'orig', desc: 'The integrity check that proves the frame was not altered. ' + sb[2] + '.', sec: true }); }
			f.push({ id: 'fcs', name: 'FCS', bytes: 4, since: 'orig', desc: 'A 32-bit CRC over the whole frame. A receiver that finds a mismatch discards the frame and sends no acknowledgement, which is how a corrupted frame is noticed and retried.' });
			return f;
		}
		function beaconBody() {
			var g = gen(), b = 12 + (2 + 6) + (2 + 8) + 3 + 6 + 22; // fixed + SSID(6 chars) + rates + DS + TIM(min) + RSN (WPA2-PSK)
			if (g.rank >= 2) { b += 28 + 24; } if (g.rank >= 3) { b += 14 + 7; } return b;
		}
		function elementList() {
			var g = gen(), r = g.rank, rows = [['Timestamp, beacon interval, capability', '12 bytes', 'orig'], ['SSID (a 6-character name)', '8 bytes', 'orig'], ['Supported rates', '10 bytes', 'orig'], ['DS parameter set (channel)', '3 bytes', 'orig'], ['TIM (traffic indication, smallest form)', '6 bytes', 'orig'], ['RSN (WPA2-Personal)', '22 bytes', 'orig']];
			if (r >= 2) { rows.push(['HT Capabilities (26 bytes of fields)', '28 bytes', 'n'], ['HT Operation (22 bytes of fields)', '24 bytes', 'n']); }
			if (r >= 3) { rows.push(['VHT Capabilities (12 bytes of fields)', '14 bytes', 'ac'], ['VHT Operation (5 bytes of fields)', '7 bytes', 'ac']); }
			if (r >= 4) { rows.push(['HE Capabilities and HE Operation', 'variable (not counted here)', 'ax']); }
			if (r >= 5) { rows.push(['EHT Capabilities and EHT Operation', 'variable (not counted here)', 'be']); }
			return rows;
		}
		function draw() {
			fix();
			var f = fields(), g = gen(), hdr = 0, secB = 0, bodyB = 0, i;
			Array.prototype.forEach.call(genSeg.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === st.g)); });
			kindBox.replaceChildren(el('span', { class: 'lab-ctl__t', text: 'Frame type' }), (function () { var w = el('div', { class: 'lab-seg', role: 'group', 'aria-label': 'Frame type' }); KINDS.forEach(function (k) { var ok = allowed(k[0]); var b = el('button', { type: 'button', 'aria-pressed': String(st.kind === k[0]), text: k[1] }); if (!ok) { b.disabled = true; b.title = 'Not defined in this protocol'; b.style.opacity = '.35'; } b.addEventListener('click', function () { st.kind = k[0]; st.prev = null; st.sel = 'fc'; draw(); }); w.append(b); }); return w; })());
			var isData = st.kind === 'data' || st.kind === 'qos';
			secBox.style.display = isData ? '' : 'none'; payS.style.display = isData ? '' : 'none'; usersS.style.display = st.kind === 'trigger' ? '' : 'none';
			secBox.replaceChildren(el('span', { class: 'lab-ctl__t', text: 'Security' }), seg('Security', SECS, st.sec, function (v) { st.sec = v; draw(); }));
			var flags = []; toT.sync(); fromT.sync(); htcT.sync();
			if (isData) { flags.push(toT, fromT); } if (g.rank >= 2 && (st.kind === 'qos' || st.kind === 'beacon')) { flags.push(htcT); }
			flagBox.style.display = flags.length ? '' : 'none'; flagBox.replaceChildren(el('span', { class: 'lab-ctl__t', text: 'Header options' }), el('div', { class: 'lab-seg', role: 'group', 'aria-label': 'Header options' }, flags));
			f.forEach(function (x) { if (x.body) { bodyB += x.bytes; } else if (x.sec) { secB += x.bytes; } else if (x.id !== 'fcs') { hdr += x.bytes; } });
			var total = hdr + bodyB + secB + 4, over = hdr + secB + 4;
			if (!f.some(function (x) { return x.id === st.sel; })) { st.sel = 'fc'; }
			rowW.replaceChildren.apply(rowW, f.map(function (x) {
				var isNew = x.since !== 'orig' && x.since !== undefined, b = el('button', { type: 'button', class: 'lab-frame__f' + (x.id === st.sel ? ' is-on' : '') + (isNew ? ' is-new' : '') + (x.body ? ' is-body' : '') + (x.sec ? ' is-sec' : ''), 'aria-pressed': String(x.id === st.sel), style: 'flex:' + Math.max(1, Math.min(x.bytes, 40)) + ' 1 0;min-width:' + (x.bytes >= 16 ? 110 : 72) + 'px' }, [el('b', { text: x.name }), el('span', { text: x.bytes + (x.bytes === 1 ? ' byte' : ' bytes') }), isNew ? el('i', { text: SINCE[x.since].replace('added by ', 'new in ').replace('extended by ', 'new in ') }) : null]);
				b.addEventListener('click', function () { st.sel = x.id; draw(); }); return b;
			}));
			var W = 1000, H = 46, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Share of the frame that is header, body, security and FCS' }), x0 = 10, sc = 980 / total, xx = x0;
			[['MAC header', hdr, 'is-warn'], ['Body', bodyB, 'is-good'], ['Security', secB, 'is-bad'], ['FCS', 4, 'is-bad']].forEach(function (p) { if (!p[1]) { return; } var w = p[1] * sc; s.append(svg('rect', { x: xx, y: 6, width: Math.max(2, w - 2), height: 30, rx: 3, class: 'lab-bar ' + p[2], style: 'opacity:.8' })); if (w > 70) { text(s, xx + w / 2, 26, p[0] + ' ' + p[1], 'lab-tick lab-tick--f', 'middle'); } xx += w; });
			totW.replaceChildren(s);
			roH.set(hdr + ' bytes'); roO.set(String(over)); roT.set(String(total)); if (bodyB === 0) { roP.set('no payload', ''); } else { roP.set(fmt(over / total * 100, over / total < 0.1 ? 1 : 0) + '%', over / total > 0.5 ? 'bad' : (over / total > 0.15 ? 'warn' : 'good')); }
			var sel = f.filter(function (x) { return x.id === st.sel; })[0], kids = [el('h3', { class: 'lab-rules__t', text: sel.name + ': ' + sel.bytes + ' bytes' }), el('p', { class: 'lab-note', text: sel.since === 'orig' || sel.since === undefined ? 'Present ' + SINCE.orig + '.' : 'Present because of 802.11: ' + SINCE[sel.since] + '.' }), el('p', { text: sel.desc })];
			if (typeof sel.extra === 'function') { kids.push(sel.extra()); }
			if (sel.id === 'body' && st.kind === 'beacon') { kids.push(table(['Element', 'Size', 'Came with'], elementList().map(function (r) { return [r[0], r[1], r[2] === 'orig' ? 'original 802.11' : SINCE[r[2]].replace('added by ', '').replace('extended by ', '')]; }))); }
			card.replaceChildren.apply(card, kids);
			// what changed against the original standard
			var base = isData || st.kind === 'beacon' ? 24 + (four() ? 6 : 0) : null, added = [];
			if (st.kind === 'qos') { added.push('QoS Control: +2 bytes (802.11e)'); }
			if (g.rank >= 2 && st.htc && (st.kind === 'qos' || st.kind === 'beacon')) { added.push('HT Control: +4 bytes (802.11n and later)'); }
			if (isData && st.sec !== 'none') { added.push('Security header and MIC: +' + secB + ' bytes'); }
			diff.replaceChildren(el('h3', { class: 'lab-rules__t', text: 'What this protocol adds to the original header' }), el('p', { text: (base !== null ? 'The original 802.11 data frame header is ' + base + ' bytes here. ' : '') + (added.length ? 'Added: ' + added.join('; ') + '.' : 'Nothing is added for this frame type.') + ' Maximum sizes: ' + (g.rank === 0 ? 'MSDU 2304 bytes, MPDU up to 2346 bytes.' : (g.rank === 1 ? 'MSDU 2304 bytes, MPDU up to 2346 bytes; Block Ack and QoS added.' : (g.rank === 2 ? 'A-MSDU 3839 or 7935 bytes; A-MPDU up to 65 535 bytes.' : (g.rank === 3 ? 'MPDU up to 3895, 7991 or 11 454 bytes; PSDU up to 4 692 480 bytes.' : 'MPDU and aggregate sizes grow again with this generation (see the table in the text).')))) }));
			function four() { return isData && st.to && st.from; }
		}
		function table(head, rows) { return el('div', { class: 'lab-tablewrap' }, [el('table', { class: 'lab-table' }, [el('thead', {}, [el('tr', {}, head.map(function (h) { return el('th', { scope: 'col', text: h }); }))]), el('tbody', {}, rows.map(function (r) { return el('tr', {}, r.map(function (c, i) { return i === 0 ? el('th', { scope: 'row', text: c }) : el('td', { text: c }); })); }))])]); }
		draw();
	};

	/* =====================================================================
	 * PPDU preambles
	 * ===================================================================== */
	window.WifiLabModels.ppdu = function (root) {
		var st = { ss: 1, sel: 'n' };
		function nltf(n) { return [1, 2, 4, 4, 6, 6, 8, 8][n - 1]; }
		function nht(n) { return [1, 2, 4, 4][Math.min(n, 4) - 1]; }
		var P = {
			b: { name: '802.11b (long)', f: function () { return [['Sync', 128, 'l'], ['SFD', 16, 'l'], ['PLCP header', 48, 'l']]; }, note: 'DSSS preamble: 128 bits of sync, a 16-bit start-of-frame delimiter and a 48-bit header, all at 1 Mbit/s, so it lasts 192 µs. A short-preamble option halves it to 96 µs.' },
			ag: { name: '802.11a / g', f: function () { return [['L-STF', 8, 'l'], ['L-LTF', 8, 'l'], ['L-SIG', 4, 'l']]; }, note: 'The OFDM preamble that every later generation keeps: two training fields and a SIGNAL symbol that gives the rate and length.' },
			n: { name: '802.11n (mixed format)', f: function () { return [['L-STF', 8, 'l'], ['L-LTF', 8, 'l'], ['L-SIG', 4, 'l'], ['HT-SIG', 8, 'n'], ['HT-STF', 4, 'n'], ['HT-LTF x ' + nht(st.ss), 4 * nht(st.ss), 'n']]; }, note: 'Starts with the legacy fields so that 802.11a/g stations understand the length and keep quiet, then adds the HT signal field (MCS, bandwidth, length, aggregation, guard interval) and one training field per spatial stream (rounded up to 1, 2 or 4).' },
			ac: { name: '802.11ac', f: function () { return [['L-STF', 8, 'l'], ['L-LTF', 8, 'l'], ['L-SIG', 4, 'l'], ['VHT-SIG-A', 8, 'n'], ['VHT-STF', 4, 'n'], ['VHT-LTF x ' + nltf(st.ss), 4 * nltf(st.ss), 'n'], ['VHT-SIG-B', 4, 'n']]; }, note: 'VHT-SIG-A (bandwidth, group ID, MCS and more) is followed by training fields and a second signal field, VHT-SIG-B, with per-user length for multi-user MIMO.' },
			ax: { name: '802.11ax (from the amendment)', f: function () { return [['L-STF', 8, 'l'], ['L-LTF', 8, 'l'], ['L-SIG', 4, 'l'], ['RL-SIG', 4, 'l'], ['HE-SIG-A', 8, 'n'], ['HE-STF', 4, 'n'], ['HE-LTF x ' + nltf(st.ss), 7.2 * nltf(st.ss), 'n']]; }, note: 'RL-SIG repeats L-SIG so that an 802.11ax receiver can recognise the format. HE-SIG-A carries bandwidth, MCS, BSS colour and more. The HE-LTF shown is the 2x type with a 0.8 µs guard interval (7.2 µs each); other types exist.' },
			be: { name: '802.11be (from the amendment)', f: function () { return [['L-STF', 8, 'l'], ['L-LTF', 8, 'l'], ['L-SIG', 4, 'l'], ['RL-SIG', 4, 'l'], ['U-SIG', 8, 'n'], ['EHT-SIG (at least)', 4, 'n'], ['EHT-STF', 4, 'n'], ['EHT-LTF x ' + nltf(st.ss), 7.2 * nltf(st.ss), 'n']]; }, note: 'U-SIG is a universal signal field that identifies the generation and version so that future amendments can be added; EHT-SIG has a variable length (shown at its minimum), and the total is therefore at least the value shown.' }
		};
		var keys = ['b', 'ag', 'n', 'ac', 'ax', 'be'];
		var controls = el('div', { class: 'lab-controls' }, [slider('Spatial streams', 1, 8, 1, st.ss, function (v) { return String(v); }, function (v) { st.ss = v; draw(); }), ctl('Look closely at', seg('Protocol', keys.map(function (k) { return [k, P[k].name.split(' (')[0]]; }), st.sel, function (v) { st.sel = v; draw(); }))]);
		var stage = el('div', { class: 'lab-stage' }), note = el('p', { class: 'lab-note' }), legend = el('p', { class: 'lab-verdict' });
		var roT = readout('', 'preamble length'), roN = readout('', 'of it is only for new devices');
		root.append(controls, stage, legend, el('div', { class: 'lab-reads' }, [roT, roN]), note);
		function draw() {
			var rows = keys.map(function (k) { var f = P[k].f(); return { k: k, f: f, tot: f.reduce(function (a, x) { return a + x[1]; }, 0) }; });
			var mx = Math.max.apply(null, rows.filter(function (r) { return r.k !== 'b'; }).map(function (r) { return r.tot; })), W = 1000, H = 24 + rows.length * 40, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Preamble length of each protocol' }), x0 = 190, sc = 690 / mx;
			rows.forEach(function (r, i) {
				var y = 10 + i * 40, x = x0, on = r.k === st.sel;
				text(s, x0 - 10, y + 22, P[r.k].name.split(' (')[0], on ? 'lab-tick lab-tick--f' : 'lab-tick', 'end');
				var clip = r.k === 'b';
				r.f.forEach(function (f) { var w = clip ? f[1] / r.tot * 690 : f[1] * sc; s.append(svg('rect', { x: x, y: y, width: Math.max(1, w - 1), height: 30, rx: 2, class: 'lab-bar ' + (f[2] === 'l' ? 'is-warn' : 'is-good'), style: 'opacity:' + (on ? .9 : .45) })); x += w; });
				text(s, x + 8, y + 20, fmt(r.tot, r.tot % 1 ? 1 : 0) + ' \u00b5s' + (clip ? ' (drawn smaller)' : ''), on ? 'lab-tick lab-tick--f' : 'lab-tick');
			});
			stage.replaceChildren(s);
			var cur = rows.filter(function (r) { return r.k === st.sel; })[0], legacy = cur.f.filter(function (f) { return f[2] === 'l'; }).reduce(function (a, f) { return a + f[1]; }, 0);
			roT.set(fmt(cur.tot, cur.tot % 1 ? 1 : 0) + ' µs'); roN.set(fmt(cur.tot - legacy, cur.tot % 1 ? 1 : 0) + ' µs');
			legend.textContent = 'Fields of ' + P[st.sel].name.split(' (')[0] + ': ' + cur.f.map(function (f) { return f[0].replace(' x ', ' x ') + ' ' + fmt(f[1], f[1] % 1 ? 1 : 0) + ' \u00b5s'; }).join(' \u00b7 ');
			note.textContent = P[st.sel].note + ' Orange fields are the part every device understands (the legacy preamble); green fields are only for devices of that generation. Fields that exist per spatial stream make the preamble longer as streams are added: 1 stream needs one training field, 2 need two, 3 or 4 need four, and so on. 802.11b, a, g, n and ac durations are from IEEE Std 802.11-2020; 802.11ax and 802.11be values come from those amendments and are typical, not fixed.';
		}
		draw();
	};

	/* =====================================================================
	 * Aggregation: A-MSDU and A-MPDU
	 * ===================================================================== */
	window.WifiLabModels.aggregation = function (root) {
		var st = { mode: 'ampdu', pay: 300, n: 8, rate: 300 };
		var HDR = 26, SEC = 16, FCS = 4, LLC = 8;
		var controls = el('div', { class: 'lab-controls' }, [ctl('How frames are sent', seg('Aggregation', [['none', 'One frame each'], ['amsdu', 'A-MSDU'], ['ampdu', 'A-MPDU']], st.mode, function (v) { st.mode = v; draw(); })), slider('Payload of each packet', 100, 1500, 50, st.pay, function (v) { return v + ' bytes'; }, function (v) { st.pay = v; draw(); }), slider('Packets waiting', 1, 32, 1, st.n, function (v) { return String(v); }, function (v) { st.n = v; draw(); }), slider('Data rate', 65, 1200, 5, st.rate, function (v) { return v + ' Mbit/s'; }, function (v) { st.rate = v; draw(); })]);
		var stage = el('div', { class: 'lab-stage' }), note = el('p', { class: 'lab-note' });
		var roB = readout('', 'of the bytes are overhead'), roE = readout('', 'of the data rate delivered', 'good'), roT = readout('', 'time for all the packets');
		root.append(controls, stage, el('div', { class: 'lab-reads' }, [roB, roE, roT]), note);
		function pad4(x) { return Math.ceil(x / 4) * 4; }
		function calc(mode) {
			var n = st.n, p = st.pay + LLC, DIFS = 34, BO = 67.5, SIFS = 16, PRE = 36, ACK = 28, BA = 32, bytes, over, t;
			var air = function (b) { return b * 8 / st.rate; };
			if (mode === 'none') { bytes = n * (HDR + SEC + FCS + p); over = n * (HDR + SEC + FCS + LLC); t = n * (DIFS + BO + PRE + air(HDR + SEC + FCS + p) + SIFS + ACK); }
			else if (mode === 'amsdu') { var sub = 0; for (var i = 0; i < n; i++) { sub += (i < n - 1 ? pad4(14 + p) : 14 + p); } bytes = HDR + SEC + FCS + sub; over = HDR + SEC + FCS + n * (14 + LLC) + (sub - n * (14 + p)); t = DIFS + BO + PRE + air(bytes) + SIFS + ACK; }
			else { var tot = 0; for (var j = 0; j < n; j++) { var m = HDR + SEC + FCS + p; tot += 4 + (j < n - 1 ? pad4(m) : m); } bytes = tot; over = n * (4 + HDR + SEC + FCS + LLC); t = DIFS + BO + PRE + air(bytes) + SIFS + BA; }
			var useful = n * st.pay, limit = mode === 'ampdu' ? 65535 : (mode === 'amsdu' ? 7935 : 11454);
			return { bytes: bytes, over: over, t: t, eff: useful * 8 / t / st.rate, ok: bytes <= limit, limit: limit };
		}
		function draw() {
			var res = calc(st.mode), W = 1000, H = 150, s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'lab-svg', role: 'img', 'aria-label': 'Time to send all the packets with each method' });
			var all = ['none', 'amsdu', 'ampdu'].map(function (m) { return [m, calc(m)]; }), mx = Math.max.apply(null, all.map(function (a) { return a[1].t; }));
			var names = { none: 'One frame each', amsdu: 'A-MSDU', ampdu: 'A-MPDU' };
			all.forEach(function (a, i) { var y = 12 + i * 44, w = a[1].t / mx * 700, on = a[0] === st.mode; s.append(svg('rect', { x: 150, y: y, width: Math.max(2, w), height: 30, rx: 4, class: 'lab-bar ' + (on ? 'is-good' : 'is-warn'), style: 'opacity:' + (on ? .9 : .45) })); text(s, 140, y + 20, names[a[0]], on ? 'lab-tick lab-tick--f' : 'lab-tick', 'end'); text(s, 158 + w, y + 20, fmt(a[1].t, 0) + ' µs' + (a[1].ok ? '' : ' (over the size limit)'), on ? 'lab-tick lab-tick--f' : 'lab-tick'); });
			stage.replaceChildren(s);
			roB.set(fmt(res.over / res.bytes * 100, 0) + '%', res.over / res.bytes > 0.3 ? 'bad' : 'warn'); roE.set(fmt(res.eff * 100, 0) + '%', res.eff < 0.3 ? 'bad' : (res.eff < 0.6 ? 'warn' : 'good')); roT.set(fmt(res.t, 0) + ' µs');
			note.textContent = 'Every packet normally pays for a full MAC header (26 bytes for QoS Data), security (16 bytes for CCMP), an FCS (4 bytes), the 8-byte LLC/SNAP header and, above all, its own wait for the channel, preamble (36 µs, 802.11n with one stream) and acknowledgement. An A-MSDU packs several packets into one frame behind a single MAC header: each packet gets a 14-byte subframe header (destination, source, length) but shares the header, security and FCS, and one error loses the whole frame (limit 3839 or 7935 bytes in 802.11n). An A-MPDU sends several complete frames back to back, each behind a 4-byte delimiter and protected by its own FCS, so one error loses only that frame, and a single Block Ack (32 bytes) answers them all (limit 65 535 bytes in 802.11n). The model uses OFDM timing for the waiting and acknowledgement, and ignores retries.' + (res.ok ? '' : ' The selected frame is larger than the limit for this method, so a real sender would split it.');
		}
		draw();
	};

})();
