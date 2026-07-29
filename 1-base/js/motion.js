/* HUISHUO · camada de movimento — sistema v1.3/Emenda 3
   Shader de matéria fluida (paleta), reveals de scroll, contadores.
   Fallbacks: prefers-reduced-motion, mobile, sem WebGL. */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reveals ---------- */
  var rvs = document.querySelectorAll('.rv');
  if (reduced || !('IntersectionObserver' in window)) {
    rvs.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var el = e.target;
          var siblings = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList && c.classList.contains('rv'); }) : [];
          var idx = siblings.indexOf(el);
          el.style.transitionDelay = (idx > 0 ? Math.min(idx * 70, 350) : 0) + 'ms';
          el.classList.add('in');
          io.unobserve(el);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rvs.forEach(function (el) { io.observe(el); });
  }

  /* ---------- contadores ---------- */
  var nums = document.querySelectorAll('[data-count]');
  if (!reduced && 'IntersectionObserver' in window && nums.length) {
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, target = parseInt(el.getAttribute('data-count'), 10);
        var suffix = el.getAttribute('data-suffix') || '';
        var t0 = null, dur = 900;
        function tick(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          p = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * p) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io2.unobserve(el);
      });
    }, { threshold: 0.4 });
    nums.forEach(function (el) { io2.observe(el); });
  }

  /* ---------- shader do hero ---------- */
  var canvas = document.getElementById('haze');
  if (!canvas || reduced || window.innerWidth < 900) return;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return;

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision mediump float;',
    'uniform vec2 r;uniform float t;uniform vec2 m;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.55;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/r; vec2 q=uv*vec2(r.x/r.y,1.)*1.6;',
    ' float drift=t*.018;',
    ' vec2 flow=vec2(fbm(q+vec2(drift,0.)),fbm(q+vec2(0.,drift*.7)));',
    ' float d=distance(uv,m); float pull=exp(-d*3.5)*.22;',
    ' float v=fbm(q+2.2*flow+pull);',
    ' v=smoothstep(.18,.92,v);',
    ' vec3 ink=vec3(.110,.102,.082);',
    ' vec3 off=vec3(.957,.933,.886);',
    ' vec3 bronze=vec3(.612,.482,.263);',
    ' vec3 col=mix(ink,off,pow(v,2.6)*.85);',
    ' float band=exp(-pow((v-.62)*4.2,2.));',
    ' col=mix(col,bronze,band*.28);',
    ' float vig=1.-.35*distance(uv,vec2(.5,.45));',
    ' gl_FragColor=vec4(col*vig,1.);}'
  ].join('\n');

  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uM = gl.getUniformLocation(prog, 'm');

  var mx = 0.5, my = 0.45, tx = 0.5, ty = 0.45;
  document.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    tx = (e.clientX - rect.left) / rect.width;
    ty = 1 - (e.clientY - rect.top) / rect.height;
  }, { passive: true });

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = canvas.clientWidth, hgt = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hgt * dpr; gl.viewport(0, 0, canvas.width, canvas.height); }
  }
  var running = true;
  document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) requestAnimationFrame(frame); });
  var t0 = performance.now();
  function frame(now) {
    if (!running) return;
    resize();
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.uniform2f(uM, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  canvas.classList.add('live');
  requestAnimationFrame(frame);
})();

/* ---------- v2: coreografia de scroll (home imersiva) ---------- */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || window.innerWidth < 920) return;

  var heroC = document.getElementById('heroContent');
  var show = document.getElementById('show');
  var track = document.getElementById('showtrack');
  var floors = document.getElementById('floors');
  var fbar = document.getElementById('fprogbar');
  var fdots = Array.prototype.slice.call(document.querySelectorAll('.fdot'));
  var fpanels = Array.prototype.slice.call(document.querySelectorAll('.fpanel'));
  if (!heroC && !show && !floors) return;

  var curX = 0, targX = 0;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function update() {
    var y = window.scrollY;
    if (heroC) {
      var p = clamp(y / (window.innerHeight * 0.9), 0, 1);
      heroC.style.transform = 'translateY(' + (p * 60) + 'px)';
      heroC.style.opacity = String(1 - p * 0.55);
    }
    if (show && track) {
      var r = show.getBoundingClientRect();
      var total = show.offsetHeight - window.innerHeight;
      var sp = clamp(-r.top / total, 0, 1);
      targX = -sp * Math.max(track.scrollWidth - window.innerWidth + 112, 0);
    }
    if (floors) {
      var fr = floors.getBoundingClientRect();
      var ftotal = floors.offsetHeight - window.innerHeight;
      var fp = clamp(-fr.top / ftotal, 0, 0.9999);
      var idx = Math.floor(fp * 3);
      fpanels.forEach(function (el, i) { el.classList.toggle('on', i === idx); el.setAttribute('aria-hidden', i === idx ? 'false' : 'true'); });
      fdots.forEach(function (el, i) { el.classList.toggle('on', i === idx); });
      if (fbar) fbar.style.width = (fp * 100) + '%';
    }
  }
  function raf() {
    curX += (targX - curX) * 0.12;
    if (track) track.style.transform = 'translateX(' + curX + 'px)';
    requestAnimationFrame(raf);
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
  if (fpanels.length) fpanels[0].classList.add('on');
  if (fdots.length) fdots[0].classList.add('on');
  requestAnimationFrame(raf);
})();

/* ---------- v3: paralaxe das bandas de facilities ---------- */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var plx = Array.prototype.slice.call(document.querySelectorAll('[data-plx]'));
  if (!plx.length) return;
  function upd() {
    plx.forEach(function (img) {
      var r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      img.style.transform = 'translateY(' + (p * 46) + 'px)';
    });
  }
  window.addEventListener('scroll', upd, { passive: true });
  upd();
})();

/* ---------- v4: triptico de facilities ---------- */
(function () {
  'use strict';
  var pans = Array.prototype.slice.call(document.querySelectorAll('.fpan'));
  if (!pans.length || window.innerWidth < 920) return;
  function activate(p) {
    pans.forEach(function (x) {
      var on = x === p;
      x.classList.toggle('on', on);
      x.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
  }
  pans.forEach(function (p) {
    p.addEventListener('mouseenter', function () { activate(p); });
    p.addEventListener('focus', function () { activate(p); });
    p.addEventListener('click', function () { activate(p); });
    p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(p); } });
  });
})();
