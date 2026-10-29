/* Homepage hero: wavelength by Wi-Fi band. Wavelength = c / f. */
(function () {
	'use strict';
	var root = document.getElementById('wave-demo');
	if (!root) { return; }

	var path = document.getElementById('wave-path');
	var wl = document.getElementById('wave-wl');
	var cyc = document.getElementById('wave-cycles');
	var note = document.getElementById('wave-note');
	var learn = document.getElementById('wave-learn');
	var buttons = root.querySelectorAll('button[data-ghz]');
	var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* Frame is 40 cm wide, so cycles = 40 / wavelength(cm). */
	var FRAME_CM = 40;
	var BANDS = {
		'2.4': { ghz: 2.4, href: '/lab/2-4-ghz/', name: '2.4 GHz', text: 'Longer waves travel through walls more easily, but the band is crowded and offers fewer channels.' },
		'5':   { ghz: 5,   href: '/lab/5-ghz/', name: '5 GHz', text: 'Shorter waves carry more data and have many more channels, but they lose more strength through walls.' },
		'6':   { ghz: 6,   href: '/lab/6-ghz/', name: '6 GHz', text: 'The newest band: clean spectrum with no older devices, but the shortest range of the three.' }
	};

	var cur = BANDS['2.4'];
	var phase = 0;
	var W = 400, MID = 70, AMP = 46, STEPS = 200;

	function draw() {
		var cm = 29.98 / cur.ghz;           /* c = 29.98 cm/ns, f in GHz */
		var cycles = FRAME_CM / cm;
		var d = '';
		for (var i = 0; i <= STEPS; i++) {
			var x = (i / STEPS) * W;
			var y = MID - AMP * Math.sin((i / STEPS) * cycles * 2 * Math.PI - phase);
			d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
		}
		path.setAttribute('d', d);
	}

	function label() {
		var cm = 29.98 / cur.ghz;
		var cycles = FRAME_CM / cm;
		wl.textContent = cm.toFixed(1) + ' cm';
		cyc.textContent = (Math.round(cycles * 10) / 10) + ' waves';
		note.textContent = cur.text;
		if (learn) { learn.href = cur.href; learn.textContent = 'Learn more about ' + cur.name + ' Wi-Fi \u2192'; }
	}

	function select(key) {
		cur = BANDS[key];
		buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ghz') === key)); });
		label();
		draw();
	}

	buttons.forEach(function (b) {
		b.addEventListener('click', function () { select(b.getAttribute('data-ghz')); });
	});

	select('2.4');

	if (!reduce) {
		var last = 0;
		(function tick(t) {
			if (t - last > 33) { phase += 0.12; draw(); last = t; }
			requestAnimationFrame(tick);
		})(0);
	}
})();
