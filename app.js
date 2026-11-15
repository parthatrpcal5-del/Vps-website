'use strict';
/*
 * NOVAHOST — complete hosting platform in ONE file. AUTO-BUILD style:
 * first run generates views/, partials, public/css, public/js, database, seed data.
 *
 *   npm i express ejs express-session sqlite3 bcryptjs helmet express-rate-limit multer
 *   node app.js            (REBUILD=1 node app.js  -> regenerate all views/css/js)
 *
 * ENV: PORT, NODE_ENV=production, ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const express = require('express'), session = require('express-session'), sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs'), helmet = require('helmet'), rateLimit = require('express-rate-limit'), multer = require('multer');

const ROOT = __dirname, PORT = process.env.PORT || 3000, PROD = process.env.NODE_ENV === 'production';
const VERCEL = !!process.env.VERCEL, WORK = VERCEL ? '/tmp/novahost' : ROOT; // Vercel: read-only disk, build into /tmp
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ================================================================
 * 1. AUTO-BUILD ASSETS  (views, partials, css, js)
 * ================================================================ */
const BASE_CSS = `
:root{--bg:#050507;--bg2:#0b0b10;--card:#101018;--card2:#171724;--line:#24243a;--tx:#f2f3f8;--mut:#8b8ca3;--a:#7c5cff;--a2:#00d4ff;--ok:#22c55e;--warn:#f59e0b;--bad:#ef4444;--r:16px;--sh:0 10px 40px rgba(0,0,0,.55)}
[data-theme=light]{--bg:#f5f6fb;--bg2:#fff;--card:#fff;--card2:#f0f1f8;--line:#e0e2ee;--tx:#14152a;--mut:#62647c;--sh:0 10px 30px rgba(20,21,42,.12)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--tx);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}
a{color:inherit;text-decoration:none}img{max-width:100%;border-radius:12px}
h1,h2,h3{line-height:1.2;letter-spacing:-.02em}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 20px;border-radius:12px;border:1px solid var(--line);background:var(--card2);color:var(--tx);font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:.25s}
.btn:hover{transform:translateY(-2px);border-color:var(--a)}
.btn.p{background:linear-gradient(135deg,var(--a),var(--a2));border:0;color:#fff;box-shadow:0 8px 24px rgba(124,92,255,.35)}
.btn.p:hover{box-shadow:0 12px 32px rgba(0,212,255,.35)}
.btn.d{background:rgba(239,68,68,.12);color:var(--bad);border-color:rgba(239,68,68,.3)}
.btn.sm{padding:7px 12px;font-size:13px;border-radius:10px}.btn.block{width:100%}
input,select,textarea{width:100%;padding:12px 14px;background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:12px;font:inherit;transition:.2s;outline:0}
input:focus,select:focus,textarea:focus{border-color:var(--a);box-shadow:0 0 0 3px rgba(124,92,255,.22)}
input[type=checkbox]{width:auto;margin-right:8px}
label{display:block;font-size:13px;color:var(--mut);margin:14px 0 6px;font-weight:600}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:22px;transition:.3s}
.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;background:var(--card2);border:1px solid var(--line)}
.badge.ok{color:var(--ok);background:rgba(34,197,94,.1)}.badge.warn{color:var(--warn);background:rgba(245,158,11,.1)}.badge.bad{color:var(--bad);background:rgba(239,68,68,.1)}
.tbl-w{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--card)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:13px 16px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
tr:last-child td{border:0}tbody tr:hover{background:var(--card2)}
.flash{padding:12px 16px;border-radius:12px;margin:14px 0;border:1px solid var(--line);background:var(--card);animation:slide .4s}
.flash.ok{border-color:var(--ok);color:var(--ok)}.flash.err{border-color:var(--bad);color:var(--bad)}
.grid{display:grid;gap:18px}.g2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.g3{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.muted{color:var(--mut)}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.sp{justify-content:space-between}.sm{font-size:13px}
.reveal{opacity:0;transform:translateY(24px);transition:.7s cubic-bezier(.2,.7,.2,1)}.reveal.in{opacity:1;transform:none}
@keyframes slide{from{opacity:0;transform:translateY(-10px)}}
@keyframes float{50%{transform:translateY(-16px)}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.reveal{opacity:1;transform:none}}
`;
const SITE_CSS = BASE_CSS + `
.announce{background:linear-gradient(90deg,var(--a),var(--a2));color:#fff;text-align:center;padding:8px 12px;font-size:13px;font-weight:600}
.nav{position:sticky;top:0;z-index:50;background:rgba(5,5,7,.75);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
[data-theme=light] .nav{background:rgba(255,255,255,.82)}
.navin{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:19px}
.lg{font-style:normal;background:linear-gradient(135deg,var(--a),var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent;font-size:24px}
.links{display:flex;align-items:center;gap:6px}
.links>a{padding:8px 12px;border-radius:10px;color:var(--mut);font-weight:600;transition:.2s}
.links>a:hover{color:var(--tx);background:var(--card2)}
.dot{background:var(--bad);color:#fff;border-radius:99px;padding:1px 7px;font-size:11px}
.burger{display:none;background:0;border:0;width:42px;height:42px;cursor:pointer;flex-direction:column;justify-content:center;gap:5px;align-items:center}
.burger span{width:22px;height:2px;background:var(--tx);display:block}
.hero{position:relative;overflow:hidden;padding:90px 0 60px;text-align:center}
.orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.35;animation:float 9s ease-in-out infinite}
.o1{width:420px;height:420px;background:var(--a);top:-120px;left:-80px}.o2{width:380px;height:380px;background:var(--a2);right:-100px;top:40px;animation-delay:-4s}
.hero-in{position:relative}
.pill{display:inline-block;padding:7px 16px;border:1px solid var(--line);border-radius:99px;background:var(--card);font-size:13px;color:var(--mut);margin-bottom:22px}
.hero h1{font-size:clamp(34px,6vw,68px);font-weight:800}
.grad{background:linear-gradient(120deg,var(--a),var(--a2),var(--a));background-size:200%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shift 6s linear infinite}
@keyframes shift{to{background-position:200%}}
.lead{max-width:640px;margin:20px auto;color:var(--mut);font-size:18px}
.cta{justify-content:center;margin-top:26px}
.hstats{display:flex;gap:34px;justify-content:center;margin-top:46px;flex-wrap:wrap}.hstats b{font-size:28px;display:block}.hstats span{color:var(--mut);font-size:13px}
.sec{padding:50px 20px}.sec h2{font-size:clamp(24px,4vw,36px);margin-bottom:10px}.head{margin-bottom:24px}
.meter{margin:16px 0}.bar{height:10px;background:var(--card2);border-radius:99px;overflow:hidden;margin-top:6px}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--a),var(--a2));border-radius:99px;transition:width 1.2s}
.tabs,.terms{display:flex;gap:8px;overflow-x:auto;padding:6px 0 10px;scrollbar-width:none}
.tabs a,.terms button{white-space:nowrap;padding:9px 16px;border-radius:99px;border:1px solid var(--line);background:var(--card);color:var(--mut);font-family:inherit;font-weight:600;cursor:pointer;font-size:14px;transition:.2s}
.tabs a.on,.terms button.on{background:linear-gradient(135deg,var(--a),var(--a2));color:#fff;border-color:transparent}
.terms i{font-style:normal;font-size:11px;opacity:.9}
.pc,.hv{position:relative;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:12px;transition:.35s}
.pc:hover,.hv:hover{transform:translateY(-6px);border-color:var(--a);box-shadow:0 18px 50px rgba(124,92,255,.2)}
.ribbon{position:absolute;top:16px;right:16px;background:linear-gradient(135deg,var(--a),var(--a2));color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px}
.price b{font-size:34px}.price small{color:var(--mut)}
.spec{list-style:none;display:grid;gap:6px;color:var(--mut);font-size:14px}
.ico{font-size:34px}
.split{display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:start}
.sticky{position:sticky;top:84px}
input[type=range]{padding:0;height:6px;accent-color:var(--a);background:var(--card2);border:0;margin:8px 0}
.quote{font-size:36px;font-weight:800}
.auth{max-width:430px;margin:50px auto}
.foot{border-top:1px solid var(--line);margin-top:60px;padding:40px 0;background:var(--bg2)}
.foot a{display:block;color:var(--mut);padding:3px 0}.foot a:hover{color:var(--tx)}
.msg{padding:14px;border-radius:14px;margin:10px 0;background:var(--card2);border:1px solid var(--line);white-space:pre-line}.msg.adm{border-color:var(--a)}
.pre{white-space:pre-line}
@media print{.nav,.foot,.announce,.noprint{display:none!important}body{background:#fff;color:#000}}
@media(max-width:820px){
 .burger{display:flex}
 .links{position:fixed;inset:64px 0 0 0;flex-direction:column;align-items:stretch;padding:20px;background:var(--bg);transform:translateX(100%);transition:.35s;overflow:auto;gap:8px;z-index:49}
 .links.open{transform:none}.links>a,.links .btn{padding:14px;font-size:16px}
 .split{grid-template-columns:1fr}.sticky{position:static}.hero{padding:60px 0 30px}
}`;
const ADMIN_CSS = BASE_CSS + `
.topbar{display:none;position:sticky;top:0;z-index:60;height:58px;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(5,5,7,.88);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
[data-theme=light] .topbar{background:rgba(255,255,255,.9)}
.burger{background:0;border:0;color:var(--tx);font-size:26px;cursor:pointer;width:42px;height:42px}
.logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px}
.lg{font-style:normal;background:linear-gradient(135deg,var(--a),var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent;font-size:24px}
.shell{display:flex;min-height:100vh}
.sidebar{width:250px;flex:none;background:var(--bg2);border-right:1px solid var(--line);padding:20px 14px;position:sticky;top:0;height:100vh;overflow:auto;display:flex;flex-direction:column;gap:4px}
.sidebar .logo{padding:6px 10px 18px}
.sidebar a,.sidebar button.lnk{display:flex;gap:12px;align-items:center;padding:11px 14px;border-radius:12px;color:var(--mut);font-family:inherit;font-size:15px;font-weight:600;transition:.2s;background:0;border:0;cursor:pointer;width:100%;text-align:left}
.sidebar a:hover,.sidebar button.lnk:hover{background:var(--card2);color:var(--tx);transform:translateX(3px)}
.sidebar a.on{background:linear-gradient(135deg,rgba(124,92,255,.22),rgba(0,212,255,.12));color:var(--tx);box-shadow:inset 3px 0 var(--a)}
.sidebar .sep{flex:1}
.content{flex:1;min-width:0;padding:30px;animation:slide .5s}
.ph{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}.ph h1{font-size:26px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;margin-bottom:24px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;position:relative;overflow:hidden;transition:.3s}
.stat:hover{transform:translateY(-4px);border-color:var(--a)}
.stat b{font-size:30px;display:block}.stat span{color:var(--mut);font-size:13px}
.stat:after{content:"";position:absolute;right:-30px;top:-30px;width:90px;height:90px;border-radius:50%;background:var(--a);opacity:.14}
.form{max-width:780px}.fg{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.fg .full{grid-column:1/-1}
.msg{padding:14px;border-radius:14px;margin:10px 0;background:var(--card2);border:1px solid var(--line);white-space:pre-line}.msg.adm{border-color:var(--a)}
.ov{display:none}
@media(max-width:860px){
 .topbar{display:flex}
 .sidebar{position:fixed;left:0;top:0;z-index:70;transform:translateX(-100%);transition:.35s;box-shadow:var(--sh)}
 .sidebar.open{transform:none}
 .ov.open{display:block;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:65}
 .content{padding:18px 14px}.fg{grid-template-columns:1fr}
 .rt thead{display:none}.rt tr{display:block;border-bottom:1px solid var(--line);padding:10px}
 .rt td{display:flex;justify-content:space-between;gap:12px;border:0;padding:6px 8px;white-space:normal}
 .rt td:before{content:attr(data-l);color:var(--mut);font-size:12px;font-weight:700;text-transform:uppercase}
}`;

const APP_JS = `(function(){
var d=document;function $(s,r){return (r||d).querySelector(s)}function $$(s,r){return [].slice.call((r||d).querySelectorAll(s))}
function fmt(n){return (Math.round(n*100)/100).toString()}
var b=$('#burger'),ov=$('#ov');
function nav(){var m=$('#menu')||$('.sidebar');if(!m)return;m.classList.toggle('open');if(ov)ov.classList.toggle('open',m.classList.contains('open'))}
if(b)b.addEventListener('click',nav);if(ov)ov.addEventListener('click',nav);
var tb=$('#themeBtn');if(tb)tb.addEventListener('click',function(){var h=d.documentElement,t=h.getAttribute('data-theme')==='light'?'dark':'light';h.setAttribute('data-theme',t);d.cookie='theme='+t+';path=/;max-age=31536000;samesite=lax'});
d.addEventListener('submit',function(e){var c=e.target.getAttribute('data-confirm');if(c&&!confirm(c))e.preventDefault()});
d.addEventListener('click',function(e){if(e.target.closest('[data-print]'))window.print()});
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.08});$$('.reveal').forEach(function(el){io.observe(el)})}else{$$('.reveal').forEach(function(el){el.classList.add('in')})}
setTimeout(function(){$$('.bar i[data-w]').forEach(function(i){i.style.width=i.dataset.w+'%'})},200);
var T=$('#terms');if(T)T.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;$$('button',T).forEach(function(k){k.classList.remove('on')});x.classList.add('on');var m=+x.dataset.m,dc=+x.dataset.d;
$$('.amt').forEach(function(a){a.textContent=a.dataset.cur+fmt(+a.dataset.base*(1-dc/100))});$$('a.cfg').forEach(function(a){a.href=a.dataset.href+'?term='+m})});
$$('[data-quote]').forEach(function(f){function calc(){var m=+f.term.value,q=f.qty?(+f.qty.value||1):1,dc=m==1?0:(+f.dataset['d'+m]||0),u;
if(f.dataset.base){u=+f.dataset.base}else{var c=+f.cpu.value,r=+f.ram.value,k=+f.disk.value;u=c*f.dataset.rc+r*f.dataset.rr+k*f.dataset.rd;
var o={cpu:c+' vCores',ram:r+' GB',disk:k+' GB',share:(Math.round(r/f.dataset.nr*1000)/10)+'% of node RAM',mo:f.dataset.cur+fmt(u)};$$('[data-out]',f.closest('.split')||d).forEach(function(el){el.textContent=o[el.dataset.out]})}
var t=u*m*q*(1-dc/100);$$('.qt',f.closest('.split')||f).forEach(function(el){el.textContent=f.dataset.cur+fmt(t)})}
f.addEventListener('input',calc);calc()});
var fl=$('.flash');if(fl)setTimeout(function(){fl.style.transition='.5s';fl.style.opacity=0},6000);
})();`;

const INTRO_JS = `(function(){
var root=document.documentElement,force=location.search.indexOf('build=1')>-1;
var reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches,seen=false;
try{seen=sessionStorage.getItem('nvBuilt')==='1'}catch(e){}
if(location.pathname!=='/'||reduced||(seen&&!force))return;
root.classList.add('intro');
var fail=setTimeout(function(){root.classList.remove('intro')},30000);
function go(){
var d=document;
var targets=[].slice.call(d.querySelectorAll('.announce,.nav,main>section,.foot'));
if(!targets.length){root.classList.remove('intro');return}
var NAMES=['Ava','Kai','Mia','Leo','Zoe','Rex','Nia','Sam','Eli','Jax','Uma','Ray'];
var COLS=['#7c5cff','#00d4ff','#22c55e','#f59e0b','#ef4444','#ec4899','#14b8a6','#a3e635','#f97316','#3b82f6','#e879f9','#facc15'];
var PAL=[['#7c5cff','#00d4ff'],['#22c55e','#a3e635'],['#f97316','#ec4899'],['#3b82f6','#14b8a6'],['#ef4444','#f59e0b'],['#e879f9','#7c5cff'],['#14b8a6','#22c55e']];
var RAD=['10px','16px','24px','6px'];
var cur=[],timers=[],stopped=false;
function put(o,x,y,instant){o.x=x;o.y=y;if(instant)o.el.style.transition='none';o.el.style.transform='translate('+x+'px,'+y+'px)';if(instant){void o.el.offsetWidth;o.el.style.transition=''}}
NAMES.forEach(function(n,i){var c=d.createElement('div');c.className='cur';c.style.setProperty('--c',COLS[i]);
c.innerHTML='<svg width="18" height="22" viewBox="0 0 18 22"><path d="M1 1l15 9-6.5 1.8L6.6 20z" fill="currentColor" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg><span></span>';
c.lastChild.textContent=n;c.style.opacity=0;d.body.appendChild(c);
var o={el:c,busy:false,x:0,y:0};put(o,Math.random()*innerWidth,scrollY+Math.random()*innerHeight,true);cur.push(o);
setTimeout(function(){c.style.opacity=1},150+i*110)});
var hud=d.createElement('div');hud.id='ibhud';
hud.innerHTML='<b>⚡ Auto-building</b><span id="ibtx">Starting…</span><i><u id="ibbar"></u></i><button type="button" id="ibskip">Skip</button>';
d.body.appendChild(hud);
function setTxt(t,p){d.getElementById('ibtx').textContent=t;d.getElementById('ibbar').style.width=p+'%'}
function sel(el,label,ms){var r=el.getBoundingClientRect(),b=d.createElement('div');b.className='sel';
b.style.left=(r.left+scrollX)+'px';b.style.top=(r.top+scrollY)+'px';b.style.width=r.width+'px';b.style.height=r.height+'px';
var t=d.createElement('em');t.textContent=label;b.appendChild(t);d.body.appendChild(b);
setTimeout(function(){b.classList.add('out');setTimeout(function(){b.remove()},400)},ms)}
function moveTo(o,el,cb){var r=el.getBoundingClientRect();
var x=r.left+scrollX+20+Math.random()*Math.max(10,r.width-60),y=r.top+scrollY+10+Math.random()*Math.max(10,Math.min(r.height,320)-30);
o.busy=true;put(o,x,y);
setTimeout(function(){if(stopped)return;o.el.classList.add('click');setTimeout(function(){o.el.classList.remove('click')},300);if(cb)cb();o.busy=false},1150)}
function label(el){var c=el.classList;if(c.contains('nav'))return 'Header';if(c.contains('announce'))return 'Announcement bar';if(c.contains('foot'))return 'Footer';if(c.contains('hero'))return 'Hero';var h=el.querySelector('h2');return h?h.textContent:'Section'}
function reveal(el){el.classList.add('ibd','in');[].forEach.call(el.querySelectorAll('.reveal'),function(x){x.classList.add('in')})}
function restyle(i){var p=PAL[i%PAL.length];root.style.setProperty('--a',p[0]);root.style.setProperty('--a2',p[1]);root.style.setProperty('--r',RAD[i%RAD.length])}
var N=targets.length,gap=Math.max(900,17500/N);
function step(el,i){if(stopped)return;
var main=cur[i%cur.length],r=el.getBoundingClientRect();
window.scrollTo({top:Math.max(0,r.top+scrollY-110),behavior:'smooth'});
setTxt('Building '+label(el)+'…',Math.round((i+1)/N*100));restyle(i);
moveTo(main,el,function(){sel(el,label(el),700);setTimeout(function(){if(!stopped)reveal(el)},350)});
var kids=[].slice.call(el.querySelectorAll('.btn,.card,.hv,.pc,h1,h2,.pill,.logo,.links>a')).slice(0,40);
for(var k=0;k<3;k++){(function(k){var o=cur[(i+1+k*3)%cur.length];if(o===main||!kids.length)return;
var kid=kids.splice(Math.floor(Math.random()*kids.length),1)[0];
timers.push(setTimeout(function(){if(stopped)return;moveTo(o,kid,function(){sel(kid,kid.tagName.toLowerCase(),600);kid.classList.add('ibf');setTimeout(function(){kid.classList.remove('ibf')},900)})},500+k*350))})(k)}}
targets.forEach(function(el,i){timers.push(setTimeout(function(){step(el,i)},700+i*gap))});
var wander=setInterval(function(){cur.forEach(function(o){if(!o.busy&&Math.random()<.6)put(o,Math.random()*innerWidth,scrollY+Math.random()*innerHeight)})},1100);
function finish(){if(stopped)return;stopped=true;clearInterval(wander);clearTimeout(fail);timers.forEach(clearTimeout);
targets.forEach(reveal);['--a','--a2','--r'].forEach(function(v){root.style.removeProperty(v)});
cur.forEach(function(o){o.el.style.opacity=0});hud.classList.add('out');window.scrollTo({top:0,behavior:'smooth'});
setTimeout(function(){cur.forEach(function(o){o.el.remove()});hud.remove();root.classList.remove('intro')},700);
try{sessionStorage.setItem('nvBuilt','1')}catch(e){}}
timers.push(setTimeout(finish,700+N*gap+1800));
d.getElementById('ibskip').addEventListener('click',finish);
d.addEventListener('keydown',function(e){if(e.key==='Escape')finish()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
})();`;
const INTRO_CSS = `
html.intro body{background-image:radial-gradient(circle,rgba(124,92,255,.28) 1px,transparent 1px);background-size:26px 26px}
html.intro .announce:not(.ibd),html.intro .nav:not(.ibd),html.intro main>section:not(.ibd),html.intro .foot:not(.ibd){opacity:0}
.ibd{animation:ibin .8s cubic-bezier(.2,.8,.2,1) both}
@keyframes ibin{from{opacity:0;transform:translateY(34px) scale(.97);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}
.cur{position:absolute;left:0;top:0;z-index:9999;pointer-events:none;color:var(--c);transition:transform 1.1s cubic-bezier(.6,0,.2,1),opacity .4s;will-change:transform}
.cur span{position:absolute;left:16px;top:18px;background:var(--c);color:#fff;font:700 11px/1 system-ui,sans-serif;padding:4px 8px;border-radius:99px;white-space:nowrap}
.cur svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}
.cur.click svg{animation:clk .3s}
@keyframes clk{50%{transform:scale(.65)}}
.sel{position:absolute;z-index:9998;pointer-events:none;border:2px dashed var(--a);background:rgba(124,92,255,.07);border-radius:8px;animation:selin .25s;transition:opacity .4s}
.sel.out{opacity:0}
.sel em{position:absolute;left:-2px;top:-22px;background:var(--a);color:#fff;font:700 11px/1 system-ui,sans-serif;padding:5px 8px;border-radius:6px 6px 0 0;font-style:normal}
@keyframes selin{from{opacity:0;transform:scale(1.03)}}
.ibf{box-shadow:0 0 0 3px var(--a),0 0 30px var(--a2)!important}
#ibhud{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:10000;display:flex;align-items:center;gap:12px;background:rgba(16,16,24,.92);color:#fff;border:1px solid var(--line);border-radius:99px;padding:10px 14px 10px 18px;backdrop-filter:blur(12px);font-size:13px;box-shadow:var(--sh);transition:.5s;max-width:94vw}
#ibhud.out{opacity:0;transform:translate(-50%,20px)}
#ibhud i{width:110px;height:6px;background:rgba(255,255,255,.15);border-radius:9px;overflow:hidden;display:block}
#ibhud u{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--a),var(--a2));transition:width .6s;text-decoration:none}
#ibhud button{background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:99px;padding:6px 12px;font-weight:700;cursor:pointer;font-family:inherit}
@media(max-width:600px){#ibhud i{display:none}.cur span{display:none}}
`;

const FILES = {
'public/js/intro.js': INTRO_JS,
'public/css/style.css': SITE_CSS + INTRO_CSS,
'public/css/admin.css': ADMIN_CSS,
'public/js/app.js': APP_JS,

/* ---------- user partials ---------- */
'views/partials/header.ejs': `<!DOCTYPE html>
<html lang="en" data-theme="<%= theme %>">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#050507">
<title><%= (typeof title!=='undefined'?title+' · ':'')+s.site_name %></title><link rel="stylesheet" href="/css/style.css"><script src="/js/intro.js"></script></head>
<body>
<% if(s.announcement){ %><div class="announce"><%= s.announcement %></div><% } %>
<header class="nav"><div class="wrap navin">
<a class="logo" href="/"><i class="lg">◆</i><%= s.site_name %></a>
<button class="burger" id="burger" type="button" aria-label="Menu"><span></span><span></span><span></span></button>
<nav class="links" id="menu">
<a href="/products">Plans</a><a href="/builder">Slice Builder</a><a href="/tickets">Support</a>
<% if(user){ %><a href="/orders">Orders</a><a href="/notifications">Alerts<% if(unread){ %> <b class="dot"><%= unread %></b><% } %></a><a href="/profile">Profile</a>
<% if(user.role==='admin'){ %><a href="/admin">Admin</a><% } %>
<form method="post" action="/logout"><input type="hidden" name="_csrf" value="<%= csrf %>"><button class="btn sm block">Logout</button></form>
<% }else{ %><a href="/login">Login</a><a class="btn p sm" href="/register">Get Started</a><% } %>
<a href="/cart">🛒 Cart (<%= cartCount %>)</a>
<button class="btn sm" id="themeBtn" type="button" aria-label="Toggle theme">◐ Theme</button>
</nav></div></header>
<main>
<% if(flash){ %><div class="wrap"><div class="flash <%= flash.t %>"><%= flash.m %></div></div><% } %>
`,
'views/partials/footer.ejs': `</main>
<footer class="foot"><div class="wrap grid g3">
<div><div class="logo"><i class="lg">◆</i><%= s.site_name %></div><p class="muted" style="margin-top:10px"><%= s.tagline %></p></div>
<div><h4>Hosting</h4><% navCats.forEach(function(c){ %><a href="/products?cat=<%= c.slug %>"><%= c.icon %> <%= c.name %></a><% }) %></div>
<div><h4>Company</h4><a href="/builder">Slice Builder</a><a href="/tickets">Support Tickets</a><a href="/?build=1">↻ Replay auto-build</a><% if(s.discord_url){ %><a href="<%= s.discord_url %>" rel="noopener" target="_blank">Discord</a><% } %><a href="mailto:<%= s.support_email %>"><%= s.support_email %></a></div>
</div><div class="wrap muted sm" style="margin-top:26px">© <%= new Date().getFullYear() %> <%= s.site_name %>. All prices in <%= s.currency %>.</div></footer>
<script src="/js/app.js"></script></body></html>`,
'views/partials/card.ejs': `<article class="pc reveal">
<% if(p.badge){ %><span class="ribbon"><%= p.badge %></span><% } %>
<% if(p.image){ %><img src="<%= p.image %>" alt="" loading="lazy"><% } %>
<h3><%= p.name %></h3><p class="muted sm"><%= (p.description||'').slice(0,100) %></p>
<div class="price"><b class="amt" data-base="<%= p.price %>" data-cur="<%= s.currency %>"><%= money(p.price) %></b><small> /mo</small></div>
<ul class="spec"><li>⚙ <%= p.cpu %> vCore</li><li>🧠 <%= p.ram %> GB RAM</li><li>💾 <%= p.storage %> GB SSD</li><% if(p.bandwidth){ %><li>🌐 <%= p.bandwidth %></li><% } %></ul>
<% if(p.stock===0){ %><span class="btn block" style="opacity:.5">Out of stock</span><% }else{ %><a class="btn p block cfg" data-href="/product/<%= p.slug %>" href="/product/<%= p.slug %>">Configure</a><% } %>
</article>`,

/* ---------- admin partials ---------- */
'views/partials/admin-header.ejs': `<!DOCTYPE html>
<html lang="en" data-theme="<%= theme %>">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#050507">
<title><%= (typeof title!=='undefined'?title+' · ':'')+'Admin · '+s.site_name %></title><link rel="stylesheet" href="/css/admin.css"></head>
<body class="admin">
<div class="topbar"><button class="burger" id="burger" type="button" aria-label="Menu">☰</button><a class="logo" href="/admin"><i class="lg">◆</i>Admin</a><button class="btn sm" id="themeBtn" type="button">◐</button></div>
<div class="shell">
`,
'views/partials/admin-sidebar.ejs': `<aside class="sidebar" id="menu">
<a class="logo" href="/admin"><i class="lg">◆</i><%= s.site_name %></a>
<% [['/admin','📊','Dashboard'],['/admin/categories','🗂️','Categories'],['/admin/products','📦','Products'],['/admin/orders','🧾','Orders'],['/admin/payments','💳','Payments'],['/admin/users','👥','Users'],['/admin/coupons','🏷️','Coupons'],['/admin/tickets','🎫','Tickets'],['/admin/settings','⚙️','Settings']].forEach(function(l){ var on=l[0]==='/admin'?path==='/admin':path.indexOf(l[0])===0; %>
<a class="<%= on?'on':'' %>" href="<%= l[0] %>"><span><%= l[1] %></span><%= l[2] %></a>
<% }) %>
<div class="sep"></div>
<a href="/">🌐 View site</a>
<form method="post" action="/logout"><input type="hidden" name="_csrf" value="<%= csrf %>"><button class="lnk">🚪 Logout</button></form>
</aside><div class="ov" id="ov"></div>
`,
'views/partials/admin-footer.ejs': `</div>
<script src="/js/app.js"></script></body></html>`,

/* ---------- user pages ---------- */
'views/pages/index.ejs': `<%- include('../partials/header') %>
<section class="hero"><div class="orb o1"></div><div class="orb o2"></div><div class="wrap hero-in">
<span class="pill">● Honest capacity · Zero overselling</span>
<h1>Real dedicated power.<br><span class="grad">Hosting that never lags.</span></h1>
<p class="lead"><%= s.tagline %></p>
<div class="row cta"><a class="btn p" href="/products">View Plans</a><a class="btn" href="/builder">Build Custom Slice</a></div>
<div class="hstats"><div><b><%= cap.cores %>C / <%= cap.ram %>GB</b><span>Master node pool</span></div><div><b>KVM</b><span>Hardware isolation</span></div><div><b>0%</b><span>Overselling</span></div><div><b>24/7</b><span>Ticket support</span></div></div>
</div></section>
<section class="wrap sec reveal"><div class="head"><h2>Live node capacity</h2><p class="muted">Orders lock automatically when the node is full, so your server never lags.</p></div>
<div class="card"><% var pc=Math.min(100,Math.round(cap.uc/cap.cores*100)), pr=Math.min(100,Math.round(cap.ur/cap.ram*100)); %>
<div class="meter"><div class="row sp"><span>CPU pool</span><span class="muted"><%= cap.uc %> / <%= cap.cores %> vCores</span></div><div class="bar"><i data-w="<%= pc %>" style="width:0"></i></div></div>
<div class="meter"><div class="row sp"><span>RAM pool</span><span class="muted"><%= cap.ur %> / <%= cap.ram %> GB</span></div><div class="bar"><i data-w="<%= pr %>" style="width:0"></i></div></div></div></section>
<section class="wrap sec"><div class="head reveal"><h2>Hosting for every workload</h2></div>
<div class="grid g3"><% cats.forEach(function(c){ %><a class="hv reveal" href="/products?cat=<%= c.slug %>"><span class="ico"><%= c.icon %></span><h3><%= c.name %></h3><p class="muted sm"><%= c.description %></p></a><% }) %></div></section>
<% if(featured.length){ %><section class="wrap sec"><div class="head reveal"><h2>Popular plans</h2></div><div class="grid g3"><% featured.forEach(function(p){ %><%- include('../partials/card',{p:p}) %><% }) %></div></section><% } %>
<section class="wrap sec"><div class="grid g3"><% [['🛡️','Hardware KVM isolation','Dedicated cores and RAM, never shared with noisy neighbours.'],['⚡','Instant provisioning','Pay, confirm, deploy — most orders go live in minutes.'],['💸','Transparent pricing','Save 5% / 10% / 15% on 3, 6 and 12 month terms automatically.'],['🧩','Custom slices','Dial in vCores, RAM and SSD with the live slice builder.'],['🎫','Real human support','Ticket system with notifications on every reply.'],['🔒','Secure by default','Encrypted passwords, CSRF protection and hardened headers.']].forEach(function(f){ %><div class="card reveal"><div class="ico"><%= f[0] %></div><h3><%= f[1] %></h3><p class="muted sm"><%= f[2] %></p></div><% }) %></div></section>
<section class="wrap sec reveal"><div class="card" style="text-align:center;padding:50px 20px"><h2>Ready to launch?</h2><p class="muted" style="margin:10px 0 22px">Create an account and deploy in minutes.</p><a class="btn p" href="/register">Create free account</a></div></section>
<%- include('../partials/footer') %>`,

'views/pages/products.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><div class="head"><h1>Select your plan</h1><p class="muted">Pick a billing term — 3, 6 and 12 month discounts apply automatically.</p></div>
<div class="tabs"><a class="<%= !cat?'on':'' %>" href="/products">All</a><% cats.forEach(function(c){ %><a class="<%= cat===c.slug?'on':'' %>" href="/products?cat=<%= c.slug %>"><%= c.icon %> <%= c.name %></a><% }) %></div>
<div class="terms" id="terms"><button type="button" class="on" data-m="1" data-d="0">1 Month</button><button type="button" data-m="3" data-d="<%= s.discount_3 %>">3 Months <i>-<%= s.discount_3 %>%</i></button><button type="button" data-m="6" data-d="<%= s.discount_6 %>">6 Months <i>-<%= s.discount_6 %>%</i></button><button type="button" data-m="12" data-d="<%= s.discount_12 %>">1 Year <i>-<%= s.discount_12 %>%</i></button></div>
<form method="get" action="/products" class="row" style="margin:12px 0 22px"><% if(cat){ %><input type="hidden" name="cat" value="<%= cat %>"><% } %><input name="q" value="<%= q %>" placeholder="Search plans…" style="max-width:320px"><button class="btn">Search</button></form>
<div class="grid g3"><% products.forEach(function(p){ %><%- include('../partials/card',{p:p}) %><% }) %></div>
<% if(!products.length){ %><div class="card muted">No plans found.</div><% } %>
</section><%- include('../partials/footer') %>`,

'views/pages/product.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><div class="split">
<div class="card"><p class="muted"><a href="/products?cat=<%= p.cat_slug %>">← <%= p.cat_name %></a></p><h1 style="margin:8px 0"><%= p.name %></h1><% if(p.badge){ %><span class="badge ok"><%= p.badge %></span><% } %>
<% if(p.image){ %><img src="<%= p.image %>" alt="" style="margin:16px 0"><% } %><p class="muted pre" style="margin:16px 0"><%= p.description %></p>
<div class="grid g2"><div class="card">⚙ <b><%= p.cpu %></b> vCores</div><div class="card">🧠 <b><%= p.ram %> GB</b> RAM</div><div class="card">💾 <b><%= p.storage %> GB</b> SSD</div><div class="card">🌐 <b><%= p.bandwidth||'Unmetered' %></b></div></div>
<% if(p.features){ %><h3 style="margin:22px 0 8px">Included</h3><ul class="spec"><% p.features.split('\\n').filter(Boolean).forEach(function(f){ %><li>✔ <%= f %></li><% }) %></ul><% } %></div>
<form class="card sticky" method="post" action="/cart/add" data-quote data-base="<%= p.price %>" data-cur="<%= s.currency %>" data-d3="<%= s.discount_3 %>" data-d6="<%= s.discount_6 %>" data-d12="<%= s.discount_12 %>">
<input type="hidden" name="_csrf" value="<%= csrf %>"><input type="hidden" name="product_id" value="<%= p.id %>">
<h3>Order this plan</h3><p class="price"><b><%= money(p.price) %></b><small> /month</small></p>
<label>Billing term</label><select name="term"><% [[1,'1 Month',0],[3,'3 Months',s.discount_3],[6,'6 Months',s.discount_6],[12,'1 Year',s.discount_12]].forEach(function(t){ %><option value="<%= t[0] %>" <%= +term===t[0]?'selected':'' %>><%= t[1] %><%= +t[2]?' — save '+t[2]+'%':'' %></option><% }) %></select>
<label>Quantity</label><input type="number" name="qty" min="1" max="10" value="1">
<p class="muted" style="margin-top:16px">Total</p><div class="quote qt"></div>
<button class="btn p block" style="margin-top:16px" <%= p.stock===0?'disabled':'' %>><%= p.stock===0?'Out of stock':'Add to cart' %></button></form>
</div></section><%- include('../partials/footer') %>`,

'views/pages/builder.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><div class="head"><h1>Custom slice builder</h1><p class="muted">Configure an exact slice of our <%= cap.cores %> core / <%= cap.ram %> GB node. Free: <%= Math.max(0,cap.cores-cap.uc) %> vCores · <%= Math.max(0,cap.ram-cap.ur) %> GB RAM.</p></div>
<div class="split"><form class="card" method="post" action="/cart/custom" data-quote data-cur="<%= s.currency %>" data-rc="<%= s.rate_core %>" data-rr="<%= s.rate_ram %>" data-rd="<%= s.rate_disk %>" data-nr="<%= cap.ram %>" data-d3="<%= s.discount_3 %>" data-d6="<%= s.discount_6 %>" data-d12="<%= s.discount_12 %>">
<input type="hidden" name="_csrf" value="<%= csrf %>">
<label>vCores — <b data-out="cpu"></b></label><input type="range" name="cpu" min="1" max="<%= cap.cores %>" value="2">
<label>ECC RAM — <b data-out="ram"></b></label><input type="range" name="ram" min="1" max="<%= cap.ram %>" value="4">
<label>SSD storage — <b data-out="disk"></b></label><input type="range" name="disk" min="10" max="500" step="10" value="40">
<label>Workload</label><select name="runtime"><% ['Custom KVM VPS (root SSH)','Discord / Telegram bot cluster','High-traffic website','Game server (PaperMC / Forge / other)','Windows RDP'].forEach(function(r){ %><option><%= r %></option><% }) %></select>
<label>Billing term</label><select name="term"><option value="1">1 Month</option><option value="3">3 Months — save <%= s.discount_3 %>%</option><option value="6">6 Months — save <%= s.discount_6 %>%</option><option value="12">1 Year — save <%= s.discount_12 %>%</option></select>
<button class="btn p block" style="margin-top:18px">Add slice to cart</button></form>
<div class="card sticky"><h3>Your slice</h3><p class="muted">Live allocation quote</p>
<ul class="spec" style="margin:14px 0"><li>⚙ <b data-out="cpu"></b></li><li>🧠 <b data-out="ram"></b> <span class="muted">(<span data-out="share"></span>)</span></li><li>💾 <b data-out="disk"></b></li><li>📅 Monthly rate: <b data-out="mo"></b></li></ul>
<p class="muted">Term total</p><div class="quote qt"></div></div></div></section><%- include('../partials/footer') %>`,

'views/pages/cart.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><h1 style="margin-bottom:20px">Your cart</h1>
<% if(!cart.lines.length){ %><div class="card">Your cart is empty. <a href="/products" style="color:var(--a2)">Browse plans →</a></div><% }else{ %>
<div class="split"><div class="grid"><% cart.lines.forEach(function(l){ %><div class="card row sp"><div><h3><%= l.name %></h3><p class="muted sm"><%= l.cfg %></p><p class="muted sm"><%= l.term %> month(s) × <%= l.qty %></p></div>
<div class="row"><b><%= money(l.price) %></b><form method="post" action="/cart/remove"><input type="hidden" name="_csrf" value="<%= csrf %>"><input type="hidden" name="i" value="<%= l.i %>"><button class="btn sm d">Remove</button></form></div></div><% }) %></div>
<div class="card sticky"><h3>Summary</h3>
<form method="post" action="/cart/coupon" class="row" style="margin:14px 0"><input type="hidden" name="_csrf" value="<%= csrf %>"><input name="code" placeholder="Coupon code" value="<%= cart.coupon?cart.coupon.code:'' %>" style="flex:1"><button class="btn sm">Apply</button></form>
<div class="row sp"><span class="muted">Subtotal</span><span><%= money(cart.subtotal) %></span></div>
<% if(cart.discount){ %><div class="row sp"><span class="muted">Discount (<%= cart.coupon.code %>)</span><span style="color:var(--ok)">-<%= money(cart.discount) %></span></div><% } %>
<div class="row sp" style="margin:12px 0"><b>Total</b><b class="quote" style="font-size:26px"><%= money(cart.total) %></b></div>
<a class="btn p block" href="/checkout">Proceed to checkout</a></div></div><% } %>
</section><%- include('../partials/footer') %>`,

'views/pages/checkout.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><h1 style="margin-bottom:20px">Checkout</h1><form method="post" action="/checkout" class="split"><input type="hidden" name="_csrf" value="<%= csrf %>">
<div class="card"><h3>Payment method</h3><% methods.forEach(function(m,i){ %><label style="color:var(--tx)"><input type="radio" name="method" value="<%= m %>" <%= i===0?'checked':'' %>> <%= m %></label><% }) %>
<p class="muted pre" style="margin:14px 0"><%= s.payment_instructions %></p><label>Order notes (optional)</label><textarea name="notes" maxlength="500" rows="3" placeholder="Server name, OS, special requests…"></textarea></div>
<div class="card sticky"><h3>Order summary</h3><% cart.lines.forEach(function(l){ %><div class="row sp muted sm" style="margin:8px 0"><span><%= l.name %> × <%= l.qty %> (<%= l.term %>mo)</span><span><%= money(l.price) %></span></div><% }) %>
<% if(cart.discount){ %><div class="row sp sm"><span>Discount</span><span>-<%= money(cart.discount) %></span></div><% } %>
<div class="row sp" style="margin:14px 0"><b>Total</b><b class="quote" style="font-size:26px"><%= money(cart.total) %></b></div><button class="btn p block">Place order</button></div></form></section>
<%- include('../partials/footer') %>`,

'views/pages/orders.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><h1 style="margin-bottom:20px">My orders</h1><div class="tbl-w"><table><thead><tr><th>#</th><th>Date</th><th>Total</th><th>Status</th><th>Payment</th><th></th></tr></thead><tbody>
<% orders.forEach(function(o){ %><tr><td>#<%= o.id %></td><td><%= o.created.slice(0,10) %></td><td><%= money(o.total) %></td><td><span class="badge"><%= o.status %></span></td><td><span class="badge <%= o.payment_status==='paid'?'ok':'warn' %>"><%= o.payment_status %></span></td><td><a class="btn sm" href="/orders/<%= o.id %>">View</a></td></tr><% }) %>
<% if(!orders.length){ %><tr><td colspan="6" class="muted">No orders yet.</td></tr><% } %></tbody></table></div></section><%- include('../partials/footer') %>`,

'views/pages/order.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><div class="row sp"><h1>Order #<%= o.id %></h1><div class="row"><span class="badge"><%= o.status %></span><span class="badge <%= o.payment_status==='paid'?'ok':'warn' %>"><%= o.payment_status %></span></div></div>
<div class="split" style="margin-top:20px"><div class="card"><h3>Items</h3><% items.forEach(function(i){ %><div class="row sp" style="margin:12px 0"><div><b><%= i.name %></b><p class="muted sm"><%= i.cfg %> · <%= i.term %>mo × <%= i.qty %></p></div><b><%= money(i.price) %></b></div><% }) %>
<hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><div class="row sp"><b>Total</b><b><%= money(o.total) %></b></div></div>
<div class="card"><h3>Payment</h3><p class="muted">Method: <%= o.payment_method %></p><% if(o.payment_status!=='paid'){ %><p class="muted pre" style="margin:12px 0"><%= s.payment_instructions %></p><% if(s.discord_url){ %><a class="btn block" href="<%= s.discord_url %>" target="_blank" rel="noopener">Open Discord</a><% } %><% } %>
<a class="btn p block" style="margin-top:12px" href="/invoice/<%= o.id %>">View invoice</a></div></div></section><%- include('../partials/footer') %>`,

'views/pages/invoice.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><div class="card" style="max-width:820px;margin:auto">
<div class="row sp"><div><h1>Invoice</h1><p class="muted"><%= inv.number %> · <%= inv.issued.slice(0,10) %></p></div><span class="badge <%= inv.status==='paid'?'ok':'warn' %>"><%= inv.status.toUpperCase() %></span></div>
<div class="grid g2" style="margin:22px 0"><div><p class="muted sm">From</p><b><%= s.site_name %></b><br><%= s.support_email %></div><div><p class="muted sm">Bill to</p><b><%= cust.name %></b><br><%= cust.email %></div></div>
<div class="tbl-w"><table><thead><tr><th>Item</th><th>Term</th><th>Qty</th><th>Amount</th></tr></thead><tbody><% items.forEach(function(i){ %><tr><td><%= i.name %><br><span class="muted sm"><%= i.cfg %></span></td><td><%= i.term %> mo</td><td><%= i.qty %></td><td><%= money(i.price) %></td></tr><% }) %></tbody></table></div>
<% if(o.discount>0){ %><p class="row sp" style="margin-top:14px"><span class="muted">Discount (<%= o.coupon %>)</span><span>-<%= money(o.discount) %></span></p><% } %>
<p class="row sp" style="margin-top:10px"><b>Total due</b><b class="quote" style="font-size:26px"><%= money(inv.amount) %></b></p>
<button class="btn noprint" type="button" data-print style="margin-top:18px">🖨 Print / Save PDF</button></div></section><%- include('../partials/footer') %>`,

'views/pages/profile.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><h1 style="margin-bottom:20px">My profile</h1><div class="grid g2">
<form class="card" method="post" action="/profile"><input type="hidden" name="_csrf" value="<%= csrf %>"><h3>Account details</h3><label>Name</label><input name="name" value="<%= user.name %>" required maxlength="60"><label>Email</label><input type="email" name="email" value="<%= user.email %>" required><button class="btn p" style="margin-top:16px">Save changes</button></form>
<form class="card" method="post" action="/profile/password"><input type="hidden" name="_csrf" value="<%= csrf %>"><h3>Change password</h3><label>Current password</label><input type="password" name="current" required autocomplete="current-password"><label>New password (min 8)</label><input type="password" name="password" required minlength="8" autocomplete="new-password"><button class="btn p" style="margin-top:16px">Update password</button></form></div></section><%- include('../partials/footer') %>`,

'views/pages/tickets.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><div class="row sp" style="margin-bottom:20px"><h1>Support tickets</h1><a class="btn p" href="/tickets/new">+ New ticket</a></div>
<div class="tbl-w"><table><thead><tr><th>#</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>
<% tickets.forEach(function(t){ %><tr><td>#<%= t.id %></td><td><%= t.subject %></td><td><%= t.priority %></td><td><span class="badge <%= t.status==='closed'?'bad':(t.status==='answered'?'ok':'warn') %>"><%= t.status %></span></td><td><%= t.created.slice(0,10) %></td><td><a class="btn sm" href="/tickets/<%= t.id %>">Open</a></td></tr><% }) %>
<% if(!tickets.length){ %><tr><td colspan="6" class="muted">No tickets yet.</td></tr><% } %></tbody></table></div></section><%- include('../partials/footer') %>`,

'views/pages/ticket-new.ejs': `<%- include('../partials/header') %>
<section class="wrap sec"><form class="card auth" style="max-width:640px" method="post" action="/tickets"><input type="hidden" name="_csrf" value="<%= csrf %>"><h2>New support ticket</h2>
<label>Subject</label><input name="subject" required maxlength="120"><label>Priority</label><select name="priority"><option>low</option><option selected>normal</option><option>high</option></select>
<label>Message</label><textarea name="message" rows="6" required maxlength="5000"></textarea><button class="btn p block" style="margin-top:16px">Submit ticket</button></form></section><%- include('../partials/footer') %>`,

'views/pages/ticket.ejs': `<%- include('../partials/header') %>
<section class="wrap sec" style="max-width:820px"><div class="row sp"><h1><%= t.subject %></h1><span class="badge"><%= t.status %></span></div>
<% msgs.forEach(function(m){ %><div class="msg <%= m.is_admin?'adm':'' %>"><b><%= m.is_admin?'Support':m.name %></b> <span class="muted sm"><%= m.created %></span><br><%= m.body %></div><% }) %>
<% if(t.status!=='closed'){ %><form class="card" method="post" action="/tickets/<%= t.id %>/reply" style="margin-top:16px"><input type="hidden" name="_csrf" value="<%= csrf %>"><textarea name="message" rows="4" required maxlength="5000" placeholder="Write a reply…"></textarea><div class="row" style="margin-top:12px"><button class="btn p">Send reply</button></div></form>
<form method="post" action="/tickets/<%= t.id %>/close" data-confirm="Close this ticket?" style="margin-top:10px"><input type="hidden" name="_csrf" value="<%= csrf %>"><button class="btn sm d">Close ticket</button></form><% } %></section><%- include('../partials/footer') %>`,

'views/pages/notifications.ejs': `<%- include('../partials/header') %>
<section class="wrap sec" style="max-width:760px"><h1 style="margin-bottom:20px">Notifications</h1>
<% notes.forEach(function(n){ %><div class="card" style="margin-bottom:12px;<%= n.read?'':'border-color:var(--a)' %>"><b><%= n.title %></b><p class="muted sm"><%= n.body %></p><p class="muted sm"><%= n.created %></p></div><% }) %>
<% if(!notes.length){ %><div class="card muted">You're all caught up.</div><% } %></section><%- include('../partials/footer') %>`,

'views/pages/login.ejs': `<%- include('../partials/header') %>
<section class="wrap"><form class="card auth" method="post" action="/login"><input type="hidden" name="_csrf" value="<%= csrf %>"><input type="hidden" name="next" value="<%= next %>">
<h2>Welcome back</h2><p class="muted">Log in to manage your servers.</p><label>Email</label><input type="email" name="email" required autocomplete="email"><label>Password</label><input type="password" name="password" required autocomplete="current-password">
<button class="btn p block" style="margin-top:18px">Log in</button><p class="muted sm" style="margin-top:14px">No account? <a href="/register" style="color:var(--a2)">Register</a></p></form></section><%- include('../partials/footer') %>`,

'views/pages/register.ejs': `<%- include('../partials/header') %>
<section class="wrap"><form class="card auth" method="post" action="/register"><input type="hidden" name="_csrf" value="<%= csrf %>">
<h2>Create your account</h2><p class="muted">Start hosting in minutes.</p><label>Name</label><input name="name" required minlength="2" maxlength="60" autocomplete="name"><label>Email</label><input type="email" name="email" required autocomplete="email"><label>Password (min 8, letters + number)</label><input type="password" name="password" required minlength="8" autocomplete="new-password">
<button class="btn p block" style="margin-top:18px">Create account</button><p class="muted sm" style="margin-top:14px">Have an account? <a href="/login" style="color:var(--a2)">Log in</a></p></form></section><%- include('../partials/footer') %>`,

'views/pages/error.ejs': `<%- include('../partials/header') %>
<section class="wrap sec" style="text-align:center;padding:90px 20px"><h1 class="grad" style="font-size:90px"><%= code %></h1><p class="muted" style="margin:14px 0 24px"><%= msg %></p><a class="btn p" href="/">Back home</a></section><%- include('../partials/footer') %>`,

/* ---------- admin pages ---------- */
'views/admin/dashboard.ejs': `<%- include('../partials/admin-header') %>
<%- include('../partials/admin-sidebar') %>
<main class="content"><div class="ph"><h1>Dashboard</h1><a class="btn p" href="/admin/products/new">+ New product</a></div>
<% if(flash){ %><div class="flash <%= flash.t %>"><%= flash.m %></div><% } %>
<div class="stats"><% st.forEach(function(x){ %><div class="stat"><b><%= x[1] %></b><span><%= x[0] %></span></div><% }) %></div>
<h3 style="margin-bottom:12px">Recent orders</h3><div class="tbl-w"><table class="rt"><thead><tr><th>#</th><th>Customer</th><th>Total</th><th>Status</th><th>Payment</th><th></th></tr></thead><tbody>
<% recent.forEach(function(o){ %><tr><td data-l="#"><%= o.id %></td><td data-l="Customer"><%= o.email %></td><td data-l="Total"><%= money(o.total) %></td><td data-l="Status"><span class="badge"><%= o.status %></span></td><td data-l="Payment"><span class="badge <%= o.payment_status==='paid'?'ok':'warn' %>"><%= o.payment_status %></span></td><td><a class="btn sm" href="/admin/orders/<%= o.id %>">Open</a></td></tr><% }) %>
<% if(!recent.length){ %><tr><td colspan="6" class="muted">No orders yet.</td></tr><% } %></tbody></table></div></main>
<%- include('../partials/admin-footer') %>`,

'views/admin/list.ejs': `<%- include('../partials/admin-header') %>
<%- include('../partials/admin-sidebar') %>
<main class="content"><div class="ph"><h1><%= title %></h1><% if(addUrl){ %><a class="btn p" href="<%= addUrl %>">+ Add new</a><% } %></div>
<% if(flash){ %><div class="flash <%= flash.t %>"><%= flash.m %></div><% } %>
<div class="tbl-w"><table class="rt"><thead><tr><% cols.forEach(function(c){ %><th><%= c[1] %></th><% }) %><th></th></tr></thead><tbody>
<% rows.forEach(function(r){ %><tr><% cols.forEach(function(c){ var v=r[c[0]]; %><td data-l="<%= c[1] %>"><% if(c[2]==='bool'){ %><span class="badge <%= v?'ok':'bad' %>"><%= v?'Yes':'No' %></span><% }else if(c[2]==='money'){ %><%= money(v) %><% }else if(c[2]==='badge'){ %><span class="badge <%= ({paid:'ok',active:'ok',answered:'ok',open:'warn',pending:'warn',unpaid:'warn',cancelled:'bad',refunded:'bad',closed:'bad'})[v]||'' %>"><%= v %></span><% }else{ %><%= v==null?'':v %><% } %></td><% }) %>
<td><div class="row"><% if(editBase){ %><a class="btn sm" href="<%= editBase %>/<%= r.id %><%= editSfx||'' %>">Open</a><% } %><% if(delBase){ %><form method="post" action="<%= delBase %>/<%= r.id %>/delete" data-confirm="Delete this item permanently?"><input type="hidden" name="_csrf" value="<%= csrf %>"><button class="btn sm d">Delete</button></form><% } %></div></td></tr><% }) %>
<% if(!rows.length){ %><tr><td colspan="<%= cols.length+1 %>" class="muted">Nothing here yet.</td></tr><% } %></tbody></table></div></main>
<%- include('../partials/admin-footer') %>`,

'views/admin/form.ejs': `<%- include('../partials/admin-header') %>
<%- include('../partials/admin-sidebar') %>
<main class="content"><div class="ph"><h1><%= title %></h1><a class="btn" href="<%= back %>">← Back</a></div>
<% if(flash){ %><div class="flash <%= flash.t %>"><%= flash.m %></div><% } %>
<% var hasFile=fields.some(function(f){return f.t==='file'}); %>
<form class="card form" method="post" action="<%= action %><%= hasFile?'?_csrf='+csrf:'' %>"<%- hasFile?' enctype="multipart/form-data"':'' %>><input type="hidden" name="_csrf" value="<%= csrf %>">
<div class="fg"><% fields.forEach(function(f){ var v=(row&&row[f.n]!=null)?row[f.n]:(f.d!=null?f.d:''); %><div class="<%= f.t==='textarea'?'full':'' %>">
<% if(f.t==='checkbox'){ %><label style="color:var(--tx);margin-top:30px"><input type="checkbox" name="<%= f.n %>" value="1" <%= (row?row[f.n]:f.d)?'checked':'' %>><%= f.l %></label>
<% }else{ %><label><%= f.l %></label>
<% if(f.t==='textarea'){ %><textarea name="<%= f.n %>" rows="5"><%= v %></textarea>
<% }else if(f.t==='select'){ %><select name="<%= f.n %>"><% f.o.forEach(function(o){ %><option value="<%= o[0] %>" <%= String(v)===String(o[0])?'selected':'' %>><%= o[1] %></option><% }) %></select>
<% }else if(f.t==='file'){ %><input type="file" name="image" accept="image/png,image/jpeg,image/webp"><% if(v){ %><img src="<%= v %>" alt="" style="max-height:80px;margin-top:8px"><% } %>
<% }else if(f.t==='password'){ %><input type="password" name="<%= f.n %>" autocomplete="new-password" minlength="8" placeholder="<%= row?'Leave blank to keep current':'' %>">
<% }else{ %><input type="<%= f.t %>" name="<%= f.n %>" value="<%= v %>" <%= f.req?'required':'' %> <%- f.t==='number'?'step="any"':'' %>><% } %><% } %></div><% }) %></div>
<button class="btn p" style="margin-top:20px">Save</button></form></main>
<%- include('../partials/admin-footer') %>`,

'views/admin/order.ejs': `<%- include('../partials/admin-header') %>
<%- include('../partials/admin-sidebar') %>
<main class="content"><div class="ph"><h1>Order #<%= o.id %></h1><a class="btn" href="/admin/orders">← Back</a></div>
<% if(flash){ %><div class="flash <%= flash.t %>"><%= flash.m %></div><% } %>
<div class="grid g2"><div class="card"><h3>Customer</h3><p><%= o.name %> · <%= o.email %></p><p class="muted sm">Placed <%= o.created %> · Method: <%= o.payment_method %></p><% if(o.notes){ %><p class="msg"><%= o.notes %></p><% } %>
<h3 style="margin-top:18px">Items</h3><% items.forEach(function(i){ %><div class="row sp" style="margin:10px 0"><div><b><%= i.name %></b><p class="muted sm"><%= i.cfg %> · <%= i.term %>mo × <%= i.qty %></p></div><b><%= money(i.price) %></b></div><% }) %>
<div class="row sp"><b>Total <%= o.coupon?'('+o.coupon+')':'' %></b><b><%= money(o.total) %></b></div></div>
<form class="card" method="post" action="/admin/orders/<%= o.id %>"><input type="hidden" name="_csrf" value="<%= csrf %>"><h3>Manage</h3>
<label>Order status</label><select name="status"><% ['pending','processing','active','cancelled','refunded'].forEach(function(x){ %><option <%= o.status===x?'selected':'' %>><%= x %></option><% }) %></select>
<label>Payment status</label><select name="payment_status"><% ['unpaid','paid','refunded'].forEach(function(x){ %><option <%= o.payment_status===x?'selected':'' %>><%= x %></option><% }) %></select>
<button class="btn p" style="margin-top:16px">Update order</button><a class="btn" style="margin-top:16px" href="/invoice/<%= o.id %>">Invoice</a></form></div></main>
<%- include('../partials/admin-footer') %>`,

'views/admin/ticket.ejs': `<%- include('../partials/admin-header') %>
<%- include('../partials/admin-sidebar') %>
<main class="content"><div class="ph"><h1>#<%= t.id %> · <%= t.subject %></h1><a class="btn" href="/admin/tickets">← Back</a></div>
<% if(flash){ %><div class="flash <%= flash.t %>"><%= flash.m %></div><% } %>
<p class="muted">From <%= t.name %> (<%= t.email %>) · <span class="badge"><%= t.status %></span> · <%= t.priority %></p>
<% msgs.forEach(function(m){ %><div class="msg <%= m.is_admin?'adm':'' %>"><b><%= m.is_admin?'Support':m.name %></b> <span class="muted sm"><%= m.created %></span><br><%= m.body %></div><% }) %>
<form class="card" method="post" action="/admin/tickets/<%= t.id %>" style="margin-top:16px"><input type="hidden" name="_csrf" value="<%= csrf %>"><label>Reply</label><textarea name="message" rows="4" maxlength="5000"></textarea>
<label>Set status</label><select name="status"><% ['open','answered','closed'].forEach(function(x){ %><option <%= t.status===x?'selected':'' %>><%= x %></option><% }) %></select><button class="btn p" style="margin-top:16px">Send / update</button></form></main>
<%- include('../partials/admin-footer') %>`
};

async function build() {
  const entries = Object.entries(FILES), force = process.env.REBUILD === '1';
  console.log('\n  ⚡ AUTO-BUILD — generating project structure\n');
  fs.mkdirSync(path.join(WORK, 'data'), { recursive: true });
  fs.mkdirSync(path.join(WORK, 'public', 'uploads'), { recursive: true });
  let i = 0;
  for (const [rel, txt] of entries) {
    const p = path.join(WORK, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
    const ex = fs.existsSync(p); if (!ex || force) fs.writeFileSync(p, txt);
    const n = Math.round(++i / entries.length * 20);
    console.log('  [' + '█'.repeat(n) + '░'.repeat(20 - n) + '] ' + (ex && !force ? 'kept  ' : 'built ') + rel);
    if (!VERCEL) await sleep(25);
  }
  console.log('\n  ✔ ' + entries.length + ' files ready\n');
}

/* ================================================================
 * 2. DATABASE (parameterised queries only)
 * ================================================================ */
fs.mkdirSync(path.join(WORK, 'data'), { recursive: true });
const db = new sqlite3.Database(path.join(WORK, 'data', 'hosting.db'));
const run = (q, p = []) => new Promise((res, rej) => db.run(q, p, function (e) { e ? rej(e) : res({ id: this.lastID, changes: this.changes }); }));
const get = (q, p = []) => new Promise((res, rej) => db.get(q, p, (e, r) => e ? rej(e) : res(r)));
const all = (q, p = []) => new Promise((res, rej) => db.all(q, p, (e, r) => e ? rej(e) : res(r)));

const DEF = {
  site_name: 'NovaHost', tagline: 'Boutique hosting with real dedicated resources. Game servers, VPS, VDS, RDP, bots and websites — capped nodes, zero overselling.',
  announcement: '🚀 Launch offer: use code WELCOME10 for 10% off your first order', currency: '₹', support_email: 'support@example.com', discord_url: '',
  rate_core: '70', rate_ram: '40', rate_disk: '2.5', discount_3: '5', discount_6: '10', discount_12: '15', node_cores: '6', node_ram: '24', enforce_cap: '1',
  payment_methods: 'Discord Ticket,UPI,Bank Transfer', payment_instructions: 'Open a ticket or join our Discord with your order number to complete payment.\nYour order activates as soon as payment is confirmed.',
  webhook_secret: '', registration_open: '1', maintenance: '0'
};

async function initDb() {
  await run('PRAGMA foreign_keys=ON'); await run('PRAGMA journal_mode=WAL');
  const T = [
    'CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,sess TEXT NOT NULL,expire INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY,v TEXT)',
    "CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',active INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL DEFAULT (datetime('now')))",
    "CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,icon TEXT DEFAULT '📦',description TEXT DEFAULT '',sort INTEGER DEFAULT 0,active INTEGER DEFAULT 1)",
    "CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,description TEXT DEFAULT '',cpu REAL DEFAULT 1,ram REAL DEFAULT 1,storage REAL DEFAULT 10,bandwidth TEXT DEFAULT '',price REAL NOT NULL,stock INTEGER DEFAULT -1,badge TEXT DEFAULT '',features TEXT DEFAULT '',image TEXT DEFAULT '',active INTEGER DEFAULT 1,featured INTEGER DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS coupons(id INTEGER PRIMARY KEY,code TEXT UNIQUE NOT NULL,type TEXT NOT NULL DEFAULT 'percent',value REAL NOT NULL,max_uses INTEGER DEFAULT 0,used INTEGER DEFAULT 0,expires TEXT DEFAULT '',active INTEGER DEFAULT 1)",
    "CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,total REAL NOT NULL,discount REAL DEFAULT 0,coupon TEXT,status TEXT DEFAULT 'pending',payment_method TEXT,payment_status TEXT DEFAULT 'unpaid',txn TEXT,notes TEXT DEFAULT '',created TEXT NOT NULL DEFAULT (datetime('now')))",
    'CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,product_id INTEGER,name TEXT,price REAL,qty INTEGER,term INTEGER,cpu REAL DEFAULT 0,ram REAL DEFAULT 0,cfg TEXT DEFAULT \'\')',
    "CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,user_id INTEGER NOT NULL,number TEXT UNIQUE,amount REAL,status TEXT DEFAULT 'unpaid',issued TEXT NOT NULL DEFAULT (datetime('now')))",
    "CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,subject TEXT,priority TEXT DEFAULT 'normal',status TEXT DEFAULT 'open',created TEXT NOT NULL DEFAULT (datetime('now')))",
    "CREATE TABLE IF NOT EXISTS ticket_messages(id INTEGER PRIMARY KEY,ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,user_id INTEGER,body TEXT,is_admin INTEGER DEFAULT 0,created TEXT NOT NULL DEFAULT (datetime('now')))",
    "CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT,body TEXT,read INTEGER DEFAULT 0,created TEXT NOT NULL DEFAULT (datetime('now')))"
  ];
  for (const t of T) await run(t);
  for (const [k, v] of Object.entries(DEF)) await run('INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)', [k, v]);
  if (!(await get('SELECT id FROM categories LIMIT 1'))) {
    const C = [['Game Hosting', 'game-hosting', '🎮', 'Minecraft, FiveM and more with instant setup.'], ['VPS Hosting', 'vps-hosting', '🖥️', 'KVM VPS with pinned cores and root access.'], ['VDS Hosting', 'vds-hosting', '⚡', 'Dedicated-core virtual servers for heavy loads.'], ['RDP Hosting', 'rdp-hosting', '🪟', 'Windows remote desktops, always online.'], ['Bot Hosting', 'bot-hosting', '🤖', 'Discord and Telegram bots, 24/7 uptime.'], ['Website Hosting', 'website-hosting', '🌐', 'Fast SSD hosting for sites and web apps.']];
    for (let i = 0; i < C.length; i++) await run('INSERT INTO categories(name,slug,icon,description,sort) VALUES(?,?,?,?,?)', [...C[i], i]);
    const P = [[1, 'Minecraft Starter', 1, 2, 20, 149, 'Popular', 1], [1, 'Minecraft Pro', 2, 4, 40, 349, '', 1], [2, 'Core VPS', 2, 4, 40, 399, 'Best value', 1], [2, 'Plus VPS', 4, 8, 80, 799, '', 0], [3, 'Dedicated Core VDS', 4, 16, 160, 1499, '', 1], [4, 'Windows RDP', 2, 4, 60, 499, '', 0], [5, 'Bot Lite', 1, 1, 5, 79, 'Cheap', 0], [6, 'Web Starter', 1, 2, 20, 129, '', 0]];
    for (const p of P) await run('INSERT INTO products(category_id,name,slug,description,cpu,ram,storage,bandwidth,price,badge,features,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [p[0], p[1], slug(p[1]), 'Dedicated resources, hardware KVM isolation and enterprise SSD storage.', p[2], p[3], p[4], 'Unmetered', p[5], p[6], 'Instant setup\nDDoS protection\nFull control panel\n24/7 ticket support', p[7]]);
    await run("INSERT INTO coupons(code,type,value,max_uses) VALUES('WELCOME10','percent',10,0)");
  }
  if (!(await get("SELECT id FROM users WHERE role='admin' LIMIT 1"))) {
    const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase(), pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    await run("INSERT INTO users(name,email,password,role) VALUES('Admin',?,?,'admin')", [email, await bcrypt.hash(pw, 12)]);
    console.log('  🔑 ADMIN LOGIN  ' + email + '  /  ' + pw + '   (change it after first login)\n');
  }
}

/* ================================================================
 * 3. HELPERS
 * ================================================================ */
const A = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const str = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);
const num = (v, min, max) => { const n = Number(v); return v !== '' && v != null && Number.isFinite(n) && n >= min && n <= max ? n : null; };
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || crypto.randomBytes(3).toString('hex'); }
const isEmail = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
const flash = (req, t, m) => { req.session.flash = { t, m }; };
const safeNext = n => (typeof n === 'string' && /^\/[^/\\]/.test(n)) ? n : '/orders';
let chain = Promise.resolve();
const lock = fn => { const r = chain.then(fn); chain = r.catch(() => {}); return r; };
const DUMMY = bcrypt.hashSync('timing-dummy-password', 12);
const TERMS = [1, 3, 6, 12];
const termDisc = (S, m) => m === 1 ? 0 : Number(S['discount_' + m] || 0);
const calc = (unit, m, qty, S) => Math.round(unit * m * qty * (1 - termDisc(S, m) / 100) * 100) / 100;

let SC = null;
async function loadS() { if (SC) return SC; const r = await all('SELECT k,v FROM settings'); const o = Object.assign({}, DEF); r.forEach(x => o[x.k] = x.v); return (SC = o); }

async function notify(uid, title, body) { await run('INSERT INTO notifications(user_id,title,body) VALUES(?,?,?)', [uid, title, body]); }
async function notifyAdmins(title, body) { for (const a of await all("SELECT id FROM users WHERE role='admin'")) await notify(a.id, title, body); }

async function capacity(S) {
  const r = await get("SELECT COALESCE(SUM(i.cpu*i.qty),0) c,COALESCE(SUM(i.ram*i.qty),0) r FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status IN ('pending','processing','active') AND o.payment_status<>'refunded'");
  return { cores: +S.node_cores, ram: +S.node_ram, uc: r.c, ur: r.r };
}
async function findCoupon(code) {
  const c = await get('SELECT * FROM coupons WHERE code=? AND active=1', [String(code || '').toUpperCase()]);
  if (!c || (c.expires && c.expires < new Date().toISOString().slice(0, 10)) || (c.max_uses > 0 && c.used >= c.max_uses)) return null; return c;
}
async function resolveCart(req, S) {
  const lines = [];
  for (const [i, it] of (req.session.cart || []).entries()) {
    if (it.t === 'p') {
      const p = await get('SELECT * FROM products WHERE id=? AND active=1', [it.pid]); if (!p) continue;
      lines.push({ i, pid: p.id, name: p.name, term: it.term, qty: it.qty, cpu: p.cpu, ram: p.ram, stock: p.stock, cfg: p.cpu + ' vCore / ' + p.ram + ' GB / ' + p.storage + ' GB', price: calc(p.price, it.term, it.qty, S) });
    } else lines.push({ i, pid: null, name: 'Custom Slice', term: it.term, qty: 1, cpu: it.cpu, ram: it.ram, stock: -1, cfg: it.cpu + ' vCore / ' + it.ram + ' GB / ' + it.disk + ' GB — ' + it.rt, price: calc(it.cpu * S.rate_core + it.ram * S.rate_ram + it.disk * S.rate_disk, it.term, 1, S) });
  }
  const subtotal = Math.round(lines.reduce((a, l) => a + l.price, 0) * 100) / 100;
  const coupon = req.session.coupon ? await findCoupon(req.session.coupon) : null;
  const discount = !coupon ? 0 : Math.min(subtotal, coupon.type === 'percent' ? Math.round(subtotal * coupon.value) / 100 : coupon.value);
  return { lines, subtotal, discount, coupon, total: Math.round((subtotal - discount) * 100) / 100 };
}

/* ================================================================
 * 4. APP, SECURITY MIDDLEWARE
 * ================================================================ */
const app = express();
app.disable('x-powered-by'); if (PROD) app.set('trust proxy', 1);
app.set('view engine', 'ejs'); app.set('views', path.join(WORK, 'views'));
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"], upgradeInsecureRequests: PROD ? [] : null } } }));
app.use(rateLimit({ windowMs: 60000, limit: 300, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60000, limit: 15, standardHeaders: true, legacyHeaders: false, handler: (req, res) => { flash(req, 'err', 'Too many attempts. Try again in 15 minutes.'); res.redirect(req.path); } });
app.use(express.static(path.join(WORK, 'public'), { maxAge: PROD ? '7d' : 0 }));

/* payment gateway webhook (HMAC-signed, raw body, no CSRF) */
app.post('/webhook/payment', express.json({ limit: '50kb', verify: (r, s, b) => { r.rawBody = b; } }), A(async (req, res) => {
  const S = await loadS(); if (!S.webhook_secret) return res.status(503).json({ error: 'webhook disabled' });
  const sig = Buffer.from(String(req.get('x-signature') || '')), exp = Buffer.from(crypto.createHmac('sha256', S.webhook_secret).update(req.rawBody || '').digest('hex'));
  if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) return res.status(401).json({ error: 'bad signature' });
  const id = num(req.body.order_id, 1, 1e12); if (!id || req.body.status !== 'paid') return res.status(400).json({ error: 'bad payload' });
  const o = await get('SELECT * FROM orders WHERE id=?', [id]); if (!o) return res.status(404).json({ error: 'not found' });
  await markPaid(o, str(req.body.txn, 80)); res.json({ ok: true });
}));
async function markPaid(o, txn) {
  await run("UPDATE orders SET payment_status='paid',status=CASE WHEN status='pending' THEN 'processing' ELSE status END,txn=? WHERE id=?", [txn || null, o.id]);
  await run("UPDATE invoices SET status='paid' WHERE order_id=?", [o.id]);
  await notify(o.user_id, 'Payment received', 'Order #' + o.id + ' is paid and being provisioned.');
}

app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

class SQLStore extends session.Store {
  get(sid, cb) { db.get('SELECT sess FROM sessions WHERE sid=? AND expire>?', [sid, Date.now()], (e, r) => { if (e) return cb(e); try { cb(null, r ? JSON.parse(r.sess) : null); } catch (x) { cb(x); } }); }
  set(sid, s, cb) { db.run('INSERT OR REPLACE INTO sessions(sid,sess,expire) VALUES(?,?,?)', [sid, JSON.stringify(s), Date.now() + ((s.cookie && s.cookie.maxAge) || 86400000)], e => cb && cb(e)); }
  destroy(sid, cb) { db.run('DELETE FROM sessions WHERE sid=?', [sid], e => cb && cb(e)); }
  touch(sid, s, cb) { db.run('UPDATE sessions SET expire=? WHERE sid=?', [Date.now() + ((s.cookie && s.cookie.maxAge) || 86400000), sid], e => cb && cb(e)); }
}
setInterval(() => db.run('DELETE FROM sessions WHERE expire<?', [Date.now()]), 3600000).unref();
const secretFile = path.join(WORK, 'data', '.secret');
const SECRET = process.env.SESSION_SECRET || (fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8') : (() => { const s = crypto.randomBytes(48).toString('hex'); fs.writeFileSync(secretFile, s, { mode: 0o600 }); return s; })());
app.use(session({ name: 'sid', secret: SECRET, store: new SQLStore(), resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 7 * 86400000 } }));

function csrfCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const t = String((req.body && req.body._csrf) || req.query._csrf || req.get('x-csrf-token') || ''), a = Buffer.from(t), b = Buffer.from(req.session.csrf || '-');
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  const e = new Error('Invalid or missing security token. Reload the page and try again.'); e.status = 403; next(e);
}

app.use(A(async (req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  const S = await loadS();
  req.user = req.session.uid ? await get('SELECT id,name,email,role,active FROM users WHERE id=?', [req.session.uid]) : null;
  if (req.user && !req.user.active) { req.user = null; delete req.session.uid; }
  const L = res.locals, m = /(?:^|;\s*)theme=(light|dark)/.exec(req.headers.cookie || '');
  L.s = S; L.user = req.user; L.csrf = req.session.csrf; L.flash = req.session.flash || null; delete req.session.flash;
  L.theme = m ? m[1] : 'dark'; L.path = req.path; L.money = v => S.currency + (Math.round(v * 100) / 100);
  L.cartCount = (req.session.cart || []).length; L.unread = req.user ? (await get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', [req.user.id])).n : 0;
  L.navCats = await all('SELECT * FROM categories WHERE active=1 ORDER BY sort,id');
  if (S.maintenance === '1' && !(req.user && req.user.role === 'admin') && !/^\/(login|logout)/.test(req.path)) return res.status(503).render('pages/error', { title: 'Maintenance', code: 503, msg: 'We are performing maintenance. Back soon.' });
  next();
}));
app.use(csrfCheck);

const requireAuth = (req, res, next) => req.user ? next() : (flash(req, 'err', 'Please log in first'), res.redirect('/login?next=' + encodeURIComponent(req.originalUrl)));
const requireAdmin = (req, res, next) => { if (!req.user) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl)); if (req.user.role !== 'admin') { const e = new Error('Admins only'); e.status = 403; return next(e); } next(); };

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const up = multer({ storage: multer.diskStorage({ destination: path.join(WORK, 'public', 'uploads'), filename: (q, f, cb) => cb(null, crypto.randomBytes(14).toString('hex') + EXT[f.mimetype]) }), limits: { fileSize: 2 * 1024 * 1024, files: 1 }, fileFilter: (q, f, cb) => EXT[f.mimetype] ? cb(null, true) : cb(new Error('Only PNG, JPG or WEBP images are allowed')) });
function sigOk(file) { const b = Buffer.alloc(12); const fd = fs.openSync(file.path, 'r'); fs.readSync(fd, b, 0, 12, 0); fs.closeSync(fd); return (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0xff && b[1] === 0xd8) || (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'); }

/* ================================================================
 * 5. PUBLIC / CUSTOMER ROUTES
 * ================================================================ */
app.get('/', A(async (req, res) => {
  res.render('pages/index', { cats: res.locals.navCats, featured: await all('SELECT * FROM products WHERE active=1 AND featured=1 ORDER BY id LIMIT 6'), cap: await capacity(res.locals.s) });
}));
app.get('/products', A(async (req, res) => {
  const cat = str(req.query.cat, 60), q = str(req.query.q, 60), a = [];
  let sql = 'SELECT p.* FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active=1 AND c.active=1';
  if (cat) { sql += ' AND c.slug=?'; a.push(cat); }
  if (q) { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; a.push('%' + q + '%', '%' + q + '%'); }
  res.render('pages/products', { title: 'Plans', cats: res.locals.navCats, cat, q, products: await all(sql + ' ORDER BY c.sort,p.price', a) });
}));
app.get('/product/:slug', A(async (req, res, next) => {
  const p = await get('SELECT p.*,c.name cat_name,c.slug cat_slug FROM products p JOIN categories c ON c.id=p.category_id WHERE p.slug=? AND p.active=1', [str(req.params.slug, 80)]);
  if (!p) return next(); res.render('pages/product', { title: p.name, p, term: TERMS.includes(+req.query.term) ? +req.query.term : 1 });
}));
app.get('/builder', A(async (req, res) => res.render('pages/builder', { title: 'Slice Builder', cap: await capacity(res.locals.s) })));

app.get('/cart', A(async (req, res) => res.render('pages/cart', { title: 'Cart', cart: await resolveCart(req, res.locals.s) })));
app.post('/cart/add', A(async (req, res) => {
  const p = await get('SELECT * FROM products WHERE id=? AND active=1', [num(req.body.product_id, 1, 1e12)]), term = TERMS.includes(+req.body.term) ? +req.body.term : 1, qty = num(req.body.qty, 1, 10);
  if (!p || !qty || p.stock === 0) { flash(req, 'err', 'Plan unavailable'); return res.redirect('/products'); }
  const cart = req.session.cart = req.session.cart || [], ex = cart.find(x => x.t === 'p' && x.pid === p.id && x.term === term);
  if (ex) ex.qty = Math.min(10, ex.qty + qty); else if (cart.length < 20) cart.push({ t: 'p', pid: p.id, term, qty });
  flash(req, 'ok', p.name + ' added to cart'); res.redirect('/cart');
}));
app.post('/cart/custom', A(async (req, res) => {
  const S = res.locals.s, cpu = num(req.body.cpu, 1, +S.node_cores), ram = num(req.body.ram, 1, +S.node_ram), disk = num(req.body.disk, 10, 1000), term = TERMS.includes(+req.body.term) ? +req.body.term : 1, rt = str(req.body.runtime, 60);
  if (!cpu || !ram || !disk || !rt) { flash(req, 'err', 'Invalid slice configuration'); return res.redirect('/builder'); }
  const cart = req.session.cart = req.session.cart || []; if (cart.length < 20) cart.push({ t: 'c', cpu, ram, disk, term, rt });
  flash(req, 'ok', 'Custom slice added to cart'); res.redirect('/cart');
}));
app.post('/cart/remove', (req, res) => { const i = num(req.body.i, 0, 100); if (i !== null && req.session.cart) req.session.cart.splice(i, 1); res.redirect('/cart'); });
app.post('/cart/coupon', A(async (req, res) => {
  const code = str(req.body.code, 40).toUpperCase();
  if (!code) delete req.session.coupon; else if (await findCoupon(code)) { req.session.coupon = code; flash(req, 'ok', 'Coupon applied'); } else flash(req, 'err', 'Invalid or expired coupon');
  res.redirect('/cart');
}));

/* auth */
app.get('/login', (req, res) => req.user ? res.redirect('/orders') : res.render('pages/login', { title: 'Login', next: safeNext(req.query.next) }));
app.post('/login', authLimiter, A(async (req, res) => {
  const email = str(req.body.email, 254).toLowerCase(), u = await get('SELECT * FROM users WHERE email=?', [email]);
  const ok = await bcrypt.compare(String(req.body.password || '').slice(0, 200), u ? u.password : DUMMY);
  if (!u || !ok || !u.active) { flash(req, 'err', 'Invalid email or password'); return res.redirect('/login'); }
  const cart = req.session.cart; await new Promise((r, j) => req.session.regenerate(e => e ? j(e) : r()));
  req.session.uid = u.id; req.session.csrf = crypto.randomBytes(24).toString('hex'); req.session.cart = cart || [];
  res.redirect(u.role === 'admin' && !req.body.next ? '/admin' : safeNext(req.body.next));
}));
app.get('/register', (req, res) => res.render('pages/register', { title: 'Register' }));
app.post('/register', authLimiter, A(async (req, res) => {
  const S = res.locals.s, name = str(req.body.name, 60), email = str(req.body.email, 254).toLowerCase(), pw = String(req.body.password || '');
  const err = S.registration_open !== '1' ? 'Registration is closed' : name.length < 2 ? 'Name is too short' : !isEmail(email) ? 'Invalid email' : (pw.length < 8 || pw.length > 100 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) ? 'Password needs 8+ characters with letters and a number' : (await get('SELECT id FROM users WHERE email=?', [email])) ? 'Email already registered' : null;
  if (err) { flash(req, 'err', err); return res.redirect('/register'); }
  const r = await run('INSERT INTO users(name,email,password) VALUES(?,?,?)', [name, email, await bcrypt.hash(pw, 12)]);
  const cart = req.session.cart; await new Promise((a, b) => req.session.regenerate(e => e ? b(e) : a()));
  req.session.uid = r.id; req.session.csrf = crypto.randomBytes(24).toString('hex'); req.session.cart = cart || [];
  await notify(r.id, 'Welcome to ' + S.site_name, 'Your account is ready. Browse plans to get started.'); res.redirect('/products');
}));
app.post('/logout', (req, res) => req.session.destroy(() => { res.clearCookie('sid'); res.redirect('/'); }));

/* checkout + orders */
app.get('/checkout', requireAuth, A(async (req, res) => {
  const cart = await resolveCart(req, res.locals.s); if (!cart.lines.length) return res.redirect('/cart');
  res.render('pages/checkout', { title: 'Checkout', cart, methods: res.locals.s.payment_methods.split(',').map(x => x.trim()).filter(Boolean) });
}));
app.post('/checkout', requireAuth, A(async (req, res) => {
  const S = res.locals.s, methods = S.payment_methods.split(',').map(x => x.trim()).filter(Boolean), method = str(req.body.method, 40), notes = str(req.body.notes, 500);
  const out = await lock(async () => {
    const c = await resolveCart(req, S); if (!c.lines.length) return { err: 'Your cart is empty' };
    if (!methods.includes(method)) return { err: 'Choose a payment method' };
    for (const l of c.lines) if (l.pid && l.stock !== -1 && l.stock < l.qty) return { err: l.name + ' is out of stock' };
    if (S.enforce_cap === '1') {
      const cap = await capacity(S), nc = c.lines.reduce((a, l) => a + l.cpu * l.qty, 0), nr = c.lines.reduce((a, l) => a + l.ram * l.qty, 0);
      if (cap.uc + nc > cap.cores || cap.ur + nr > cap.ram) return { err: 'Node capacity reached — order locked to prevent overselling' };
    }
    const o = await run('INSERT INTO orders(user_id,total,discount,coupon,payment_method,notes) VALUES(?,?,?,?,?,?)', [req.user.id, c.total, c.discount, c.coupon ? c.coupon.code : null, method, notes]);
    for (const l of c.lines) {
      await run('INSERT INTO order_items(order_id,product_id,name,price,qty,term,cpu,ram,cfg) VALUES(?,?,?,?,?,?,?,?,?)', [o.id, l.pid, l.name, l.price, l.qty, l.term, l.cpu, l.ram, l.cfg]);
      if (l.pid && l.stock > 0) await run('UPDATE products SET stock=stock-? WHERE id=?', [l.qty, l.pid]);
    }
    if (c.coupon) await run('UPDATE coupons SET used=used+1 WHERE id=?', [c.coupon.id]);
    await run('INSERT INTO invoices(order_id,user_id,number,amount) VALUES(?,?,?,?)', [o.id, req.user.id, 'INV-' + new Date().getFullYear() + '-' + String(o.id).padStart(5, '0'), c.total]);
    return { id: o.id };
  });
  if (out.err) { flash(req, 'err', out.err); return res.redirect('/cart'); }
  req.session.cart = []; delete req.session.coupon;
  await notify(req.user.id, 'Order #' + out.id + ' placed', 'Complete payment via ' + method + ' to activate your services.');
  await notifyAdmins('New order #' + out.id, req.user.email + ' placed an order.'); flash(req, 'ok', 'Order placed! Complete payment to activate.'); res.redirect('/orders/' + out.id);
}));
app.get('/orders', requireAuth, A(async (req, res) => res.render('pages/orders', { title: 'My orders', orders: await all('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC', [req.user.id]) })));
async function ownOrder(req, id) { const o = await get('SELECT o.*,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?', [num(id, 1, 1e12)]); return o && (o.user_id === req.user.id || req.user.role === 'admin') ? o : null; }
app.get('/orders/:id', requireAuth, A(async (req, res, next) => { const o = await ownOrder(req, req.params.id); if (!o) return next(); res.render('pages/order', { title: 'Order #' + o.id, o, items: await all('SELECT * FROM order_items WHERE order_id=?', [o.id]) }); }));
app.get('/invoice/:id', requireAuth, A(async (req, res, next) => {
  const o = await ownOrder(req, req.params.id); if (!o) return next();
  res.render('pages/invoice', { title: 'Invoice', o, cust: o, inv: await get('SELECT * FROM invoices WHERE order_id=?', [o.id]), items: await all('SELECT * FROM order_items WHERE order_id=?', [o.id]) });
}));

/* profile */
app.get('/profile', requireAuth, (req, res) => res.render('pages/profile', { title: 'Profile' }));
app.post('/profile', requireAuth, A(async (req, res) => {
  const name = str(req.body.name, 60), email = str(req.body.email, 254).toLowerCase();
  if (name.length < 2 || !isEmail(email)) flash(req, 'err', 'Invalid name or email');
  else if (await get('SELECT id FROM users WHERE email=? AND id<>?', [email, req.user.id])) flash(req, 'err', 'Email already in use');
  else { await run('UPDATE users SET name=?,email=? WHERE id=?', [name, email, req.user.id]); flash(req, 'ok', 'Profile updated'); }
  res.redirect('/profile');
}));
app.post('/profile/password', requireAuth, A(async (req, res) => {
  const u = await get('SELECT password FROM users WHERE id=?', [req.user.id]), pw = String(req.body.password || '');
  if (!(await bcrypt.compare(String(req.body.current || ''), u.password))) flash(req, 'err', 'Current password is wrong');
  else if (pw.length < 8 || pw.length > 100) flash(req, 'err', 'New password must be 8-100 characters');
  else { await run('UPDATE users SET password=? WHERE id=?', [await bcrypt.hash(pw, 12), req.user.id]); flash(req, 'ok', 'Password changed'); }
  res.redirect('/profile');
}));

/* notifications + tickets */
app.get('/notifications', requireAuth, A(async (req, res) => {
  const notes = await all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100', [req.user.id]);
  await run('UPDATE notifications SET read=1 WHERE user_id=?', [req.user.id]); res.render('pages/notifications', { title: 'Notifications', notes });
}));
app.get('/tickets', requireAuth, A(async (req, res) => res.render('pages/tickets', { title: 'Support', tickets: await all('SELECT * FROM tickets WHERE user_id=? ORDER BY id DESC', [req.user.id]) })));
app.get('/tickets/new', requireAuth, (req, res) => res.render('pages/ticket-new', { title: 'New ticket' }));
app.post('/tickets', requireAuth, A(async (req, res) => {
  const subject = str(req.body.subject, 120), message = str(req.body.message, 5000), pr = ['low', 'normal', 'high'].includes(req.body.priority) ? req.body.priority : 'normal';
  if (subject.length < 3 || message.length < 5) { flash(req, 'err', 'Subject and message are required'); return res.redirect('/tickets/new'); }
  const t = await run('INSERT INTO tickets(user_id,subject,priority) VALUES(?,?,?)', [req.user.id, subject, pr]);
  await run('INSERT INTO ticket_messages(ticket_id,user_id,body) VALUES(?,?,?)', [t.id, req.user.id, message]);
  await notifyAdmins('New ticket #' + t.id, subject); flash(req, 'ok', 'Ticket created'); res.redirect('/tickets/' + t.id);
}));
const ownTicket = async (req, id) => { const t = await get('SELECT t.*,u.name,u.email FROM tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?', [num(id, 1, 1e12)]); return t && t.user_id === req.user.id ? t : null; };
app.get('/tickets/:id', requireAuth, A(async (req, res, next) => { const t = await ownTicket(req, req.params.id); if (!t) return next(); res.render('pages/ticket', { title: 'Ticket #' + t.id, t, msgs: await all('SELECT m.*,u.name FROM ticket_messages m LEFT JOIN users u ON u.id=m.user_id WHERE ticket_id=? ORDER BY m.id', [t.id]) }); }));
app.post('/tickets/:id/reply', requireAuth, A(async (req, res, next) => {
  const t = await ownTicket(req, req.params.id), m = str(req.body.message, 5000); if (!t) return next();
  if (t.status === 'closed' || m.length < 2) flash(req, 'err', 'Cannot post this reply');
  else { await run('INSERT INTO ticket_messages(ticket_id,user_id,body) VALUES(?,?,?)', [t.id, req.user.id, m]); await run("UPDATE tickets SET status='open' WHERE id=?", [t.id]); await notifyAdmins('Ticket #' + t.id + ' reply', t.subject); }
  res.redirect('/tickets/' + t.id);
}));
app.post('/tickets/:id/close', requireAuth, A(async (req, res, next) => { const t = await ownTicket(req, req.params.id); if (!t) return next(); await run("UPDATE tickets SET status='closed' WHERE id=?", [t.id]); res.redirect('/tickets'); }));

/* ================================================================
 * 6. ADMIN
 * ================================================================ */
const admin = express.Router();
app.use('/admin', requireAdmin, admin);
const yn = [[1, 'Yes'], [0, 'No']];
const RES = {
  categories: { t: 'categories', title: 'Categories', one: 'Category', sql: 'SELECT * FROM categories ORDER BY sort,id', cols: [['id', '#'], ['icon', 'Icon'], ['name', 'Name'], ['slug', 'Slug'], ['sort', 'Order'], ['active', 'Active', 'bool']],
    fields: async () => [{ n: 'name', l: 'Name', t: 'text', req: 1 }, { n: 'slug', l: 'Slug (auto if empty)', t: 'text' }, { n: 'icon', l: 'Icon (emoji)', t: 'text', d: '📦' }, { n: 'sort', l: 'Sort order', t: 'number', d: 0 }, { n: 'description', l: 'Description', t: 'textarea' }, { n: 'active', l: 'Active', t: 'checkbox', d: 1 }] },
  products: { t: 'products', title: 'Products', one: 'Product', sql: 'SELECT p.*,c.name cat FROM products p JOIN categories c ON c.id=p.category_id ORDER BY p.id DESC', cols: [['id', '#'], ['name', 'Name'], ['cat', 'Category'], ['price', 'Price', 'money'], ['cpu', 'vCores'], ['ram', 'RAM'], ['stock', 'Stock'], ['active', 'Active', 'bool']],
    fields: async () => [{ n: 'category_id', l: 'Category', t: 'select', o: (await all('SELECT id,name FROM categories ORDER BY sort')).map(c => [c.id, c.name]) }, { n: 'name', l: 'Name', t: 'text', req: 1 }, { n: 'slug', l: 'Slug (auto if empty)', t: 'text' }, { n: 'price', l: 'Monthly price', t: 'number', req: 1 }, { n: 'stock', l: 'Stock (-1 = unlimited, 0 = sold out)', t: 'number', min: -1, d: -1 }, { n: 'cpu', l: 'vCores', t: 'number', d: 1 }, { n: 'ram', l: 'RAM (GB)', t: 'number', d: 1 }, { n: 'storage', l: 'SSD (GB)', t: 'number', d: 10 }, { n: 'bandwidth', l: 'Bandwidth label', t: 'text', d: 'Unmetered' }, { n: 'badge', l: 'Badge (e.g. Popular)', t: 'text' }, { n: 'description', l: 'Description', t: 'textarea' }, { n: 'features', l: 'Features (one per line)', t: 'textarea' }, { n: 'image', l: 'Image', t: 'file' }, { n: 'active', l: 'Active', t: 'checkbox', d: 1 }, { n: 'featured', l: 'Featured on homepage', t: 'checkbox', d: 0 }] },
  coupons: { t: 'coupons', title: 'Coupons', one: 'Coupon', sql: 'SELECT * FROM coupons ORDER BY id DESC', cols: [['id', '#'], ['code', 'Code'], ['type', 'Type'], ['value', 'Value'], ['used', 'Used'], ['max_uses', 'Max'], ['expires', 'Expires'], ['active', 'Active', 'bool']],
    fields: async () => [{ n: 'code', l: 'Code', t: 'text', req: 1 }, { n: 'type', l: 'Type', t: 'select', o: [['percent', 'Percent %'], ['flat', 'Flat amount']] }, { n: 'value', l: 'Value', t: 'number', req: 1 }, { n: 'max_uses', l: 'Max uses (0 = unlimited)', t: 'number', d: 0 }, { n: 'expires', l: 'Expires (YYYY-MM-DD, optional)', t: 'text' }, { n: 'active', l: 'Active', t: 'checkbox', d: 1 }] },
  users: { t: 'users', title: 'Users', one: 'User', sql: 'SELECT id,name,email,role,active,created FROM users ORDER BY id DESC', cols: [['id', '#'], ['name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['active', 'Active', 'bool'], ['created', 'Joined']],
    fields: async () => [{ n: 'name', l: 'Name', t: 'text', req: 1 }, { n: 'email', l: 'Email', t: 'text', req: 1 }, { n: 'role', l: 'Role', t: 'select', o: [['user', 'Customer'], ['admin', 'Admin']] }, { n: 'password', l: 'Password', t: 'password' }, { n: 'active', l: 'Active (untick to ban)', t: 'checkbox', d: 1 }] }
};
async function parseRes(R, req, id) {
  const vals = {}, errs = [];
  for (const x of await R.fields()) {
    let v = req.body[x.n];
    if (x.t === 'checkbox') { vals[x.n] = v ? 1 : 0; continue; }
    if (x.t === 'file') { if (req.file) vals[x.n] = '/uploads/' + req.file.filename; continue; }
    if (x.t === 'password') { if (v) { if (String(v).length < 8) errs.push('Password min 8 characters'); else vals.password = await bcrypt.hash(String(v).slice(0, 100), 12); } else if (!id) errs.push('Password required'); continue; }
    if (x.t === 'number') { const n = num(v, x.min != null ? x.min : 0, 1e9); if (n === null) errs.push(x.l + ' is invalid'); else vals[x.n] = n; continue; }
    v = str(v, x.t === 'textarea' ? 4000 : 200); if (x.req && !v) { errs.push(x.l + ' is required'); continue; }
    if (x.t === 'select' && !x.o.some(o => String(o[0]) === v)) { errs.push(x.l + ' is invalid'); continue; }
    vals[x.n] = v;
  }
  if ('slug' in vals) vals.slug = slug(vals.slug || vals.name);
  if (vals.code) vals.code = vals.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (vals.email) { vals.email = vals.email.toLowerCase(); if (!isEmail(vals.email)) errs.push('Email is invalid'); }
  return { vals, errs };
}

admin.get('/', A(async (req, res) => {
  const n = async q => (await get(q)).n, rev = (await get("SELECT COALESCE(SUM(total),0) n FROM orders WHERE payment_status='paid'")).n;
  const st = [['Revenue (paid)', res.locals.money(rev)], ['Orders', await n('SELECT COUNT(*) n FROM orders')], ['Pending payment', await n("SELECT COUNT(*) n FROM orders WHERE payment_status='unpaid' AND status<>'cancelled'")], ['Customers', await n("SELECT COUNT(*) n FROM users WHERE role='user'")], ['Products', await n('SELECT COUNT(*) n FROM products')], ['Open tickets', await n("SELECT COUNT(*) n FROM tickets WHERE status<>'closed'")]];
  res.render('admin/dashboard', { title: 'Dashboard', st, recent: await all('SELECT o.*,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 8') });
}));
const orderCols = [['id', '#'], ['email', 'Customer'], ['total', 'Total', 'money'], ['payment_method', 'Method'], ['status', 'Status', 'badge'], ['payment_status', 'Payment', 'badge'], ['created', 'Date']];
admin.get('/orders', A(async (req, res) => res.render('admin/list', { title: 'Orders', cols: orderCols, rows: await all('SELECT o.*,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 500'), addUrl: null, editBase: '/admin/orders', editSfx: '', delBase: null })));
admin.get('/payments', A(async (req, res) => res.render('admin/list', { title: 'Payments', cols: orderCols, rows: await all("SELECT o.*,u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.status<>'cancelled' ORDER BY (o.payment_status='unpaid') DESC,o.id DESC LIMIT 500"), addUrl: null, editBase: '/admin/orders', editSfx: '', delBase: null })));
admin.get('/orders/:id', A(async (req, res, next) => {
  const o = await get('SELECT o.*,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?', [num(req.params.id, 1, 1e12)]); if (!o) return next();
  res.render('admin/order', { title: 'Order #' + o.id, o, items: await all('SELECT * FROM order_items WHERE order_id=?', [o.id]) });
}));
admin.post('/orders/:id', A(async (req, res, next) => {
  const o = await get('SELECT * FROM orders WHERE id=?', [num(req.params.id, 1, 1e12)]); if (!o) return next();
  const st = ['pending', 'processing', 'active', 'cancelled', 'refunded'], ps = ['unpaid', 'paid', 'refunded'];
  if (!st.includes(req.body.status) || !ps.includes(req.body.payment_status)) { flash(req, 'err', 'Invalid status'); return res.redirect('/admin/orders/' + o.id); }
  await run('UPDATE orders SET status=?,payment_status=? WHERE id=?', [req.body.status, req.body.payment_status, o.id]);
  if (req.body.payment_status === 'paid' && o.payment_status !== 'paid') await markPaid(o, o.txn);
  else { await run('UPDATE invoices SET status=? WHERE order_id=?', [req.body.payment_status === 'paid' ? 'paid' : 'unpaid', o.id]); if (req.body.status !== o.status) await notify(o.user_id, 'Order #' + o.id + ' is now ' + req.body.status, 'Check your orders page for details.'); }
  flash(req, 'ok', 'Order updated'); res.redirect('/admin/orders/' + o.id);
}));
admin.get('/tickets', A(async (req, res) => res.render('admin/list', { title: 'Tickets', cols: [['id', '#'], ['subject', 'Subject'], ['email', 'User'], ['priority', 'Priority'], ['status', 'Status', 'badge'], ['created', 'Created']], rows: await all("SELECT t.*,u.email FROM tickets t JOIN users u ON u.id=t.user_id ORDER BY (t.status='closed'),t.id DESC LIMIT 500"), addUrl: null, editBase: '/admin/tickets', editSfx: '', delBase: null })));
admin.get('/tickets/:id', A(async (req, res, next) => {
  const t = await get('SELECT t.*,u.name,u.email FROM tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?', [num(req.params.id, 1, 1e12)]); if (!t) return next();
  res.render('admin/ticket', { title: 'Ticket #' + t.id, t, msgs: await all('SELECT m.*,u.name FROM ticket_messages m LEFT JOIN users u ON u.id=m.user_id WHERE ticket_id=? ORDER BY m.id', [t.id]) });
}));
admin.post('/tickets/:id', A(async (req, res, next) => {
  const t = await get('SELECT * FROM tickets WHERE id=?', [num(req.params.id, 1, 1e12)]); if (!t) return next();
  const m = str(req.body.message, 5000); let st = ['open', 'answered', 'closed'].includes(req.body.status) ? req.body.status : t.status;
  if (m) { await run('INSERT INTO ticket_messages(ticket_id,user_id,body,is_admin) VALUES(?,?,?,1)', [t.id, req.user.id, m]); if (st === 'open') st = 'answered'; await notify(t.user_id, 'Reply on ticket #' + t.id, t.subject); }
  await run('UPDATE tickets SET status=? WHERE id=?', [st, t.id]); flash(req, 'ok', 'Ticket updated'); res.redirect('/admin/tickets/' + t.id);
}));

const SETF = [['site_name', 'Site name', 'text'], ['tagline', 'Tagline', 'textarea'], ['announcement', 'Top announcement bar (blank = hidden)', 'text'], ['currency', 'Currency symbol', 'text'], ['support_email', 'Support email', 'text'], ['discord_url', 'Discord invite URL', 'text'], ['rate_core', 'Slice builder: price per vCore / month', 'number'], ['rate_ram', 'Slice builder: price per GB RAM / month', 'number'], ['rate_disk', 'Slice builder: price per GB SSD / month', 'number'], ['discount_3', '3-month discount %', 'number'], ['discount_6', '6-month discount %', 'number'], ['discount_12', '12-month discount %', 'number'], ['node_cores', 'Node total vCores', 'number'], ['node_ram', 'Node total RAM (GB)', 'number'], ['enforce_cap', 'Lock orders when node is full', 'checkbox'], ['payment_methods', 'Payment methods (comma separated)', 'text'], ['payment_instructions', 'Payment instructions', 'textarea'], ['webhook_secret', 'Payment webhook secret (POST /webhook/payment, header x-signature = HMAC-SHA256 hex of body)', 'text'], ['registration_open', 'Allow new registrations', 'checkbox'], ['maintenance', 'Maintenance mode (admins still allowed)', 'checkbox']];
admin.get('/settings', A(async (req, res) => {
  const S = await loadS(), row = Object.assign({}, S); SETF.filter(f => f[2] === 'checkbox').forEach(f => row[f[0]] = Number(S[f[0]]));
  res.render('admin/form', { title: 'Settings', back: '/admin', action: '/admin/settings', row, fields: SETF.map(f => ({ n: f[0], l: f[1], t: f[2] })) });
}));
admin.post('/settings', A(async (req, res) => {
  for (const [k, , t] of SETF) {
    let v = req.body[k];
    if (t === 'checkbox') v = v ? '1' : '0'; else if (t === 'number') { const n = num(v, 0, 1e9); if (n === null) { flash(req, 'err', k + ' must be a number'); return res.redirect('/admin/settings'); } v = String(n); } else v = str(v, t === 'textarea' ? 1000 : 300);
    await run('INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)', [k, v]);
  }
  SC = null; flash(req, 'ok', 'Settings saved'); res.redirect('/admin/settings');
}));

/* generic CRUD: categories, products, coupons, users */
const R = (req, res, next) => { const r = RES[req.params.r]; if (!r) return next('route'); req.R = r; next(); };
admin.get('/:r', R, A(async (req, res) => { const r = req.R, b = '/admin/' + req.params.r; res.render('admin/list', { title: r.title, cols: r.cols, rows: await all(r.sql), addUrl: b + '/new', editBase: b, editSfx: '/edit', delBase: b }); }));
admin.get('/:r/new', R, A(async (req, res) => res.render('admin/form', { title: 'New ' + req.R.one, back: '/admin/' + req.params.r, action: '/admin/' + req.params.r, row: null, fields: await req.R.fields() })));
admin.get('/:r/:id/edit', R, A(async (req, res, next) => {
  const row = await get('SELECT * FROM ' + req.R.t + ' WHERE id=?', [num(req.params.id, 1, 1e12)]); if (!row) return next();
  res.render('admin/form', { title: 'Edit ' + req.R.one, back: '/admin/' + req.params.r, action: '/admin/' + req.params.r + '/' + row.id, row, fields: await req.R.fields() });
}));
async function saveRes(req, res, id) {
  const r = req.R, back = '/admin/' + req.params.r;
  if (req.file && !sigOk(req.file)) { fs.unlink(req.file.path, () => {}); req.file = null; flash(req, 'err', 'Uploaded file is not a valid image'); return res.redirect(id ? back + '/' + id + '/edit' : back + '/new'); }
  const { vals, errs } = await parseRes(r, req, id);
  if (id && r.t === 'users' && +id === req.user.id && (vals.role !== 'admin' || !vals.active)) errs.push('You cannot demote or ban yourself');
  if (errs.length) { flash(req, 'err', errs[0]); return res.redirect(id ? back + '/' + id + '/edit' : back + '/new'); }
  const keys = Object.keys(vals);
  try {
    if (id) await run('UPDATE ' + r.t + ' SET ' + keys.map(k => k + '=?').join(',') + ' WHERE id=?', [...keys.map(k => vals[k]), id]);
    else await run('INSERT INTO ' + r.t + '(' + keys.join(',') + ') VALUES(' + keys.map(() => '?').join(',') + ')', keys.map(k => vals[k]));
    flash(req, 'ok', r.one + ' saved');
  } catch (e) { flash(req, 'err', /UNIQUE/.test(e.message) ? 'That slug / code / email already exists' : 'Database error'); return res.redirect(id ? back + '/' + id + '/edit' : back + '/new'); }
  res.redirect(back);
}
admin.post('/:r', R, up.single('image'), A((req, res) => saveRes(req, res, null)));
admin.post('/:r/:id', R, up.single('image'), A((req, res) => saveRes(req, res, num(req.params.id, 1, 1e12))));
admin.post('/:r/:id/delete', R, A(async (req, res) => {
  const id = num(req.params.id, 1, 1e12);
  if (req.R.t === 'users' && id === req.user.id) flash(req, 'err', 'You cannot delete yourself');
  else { await run('DELETE FROM ' + req.R.t + ' WHERE id=?', [id]); flash(req, 'ok', req.R.one + ' deleted'); }
  res.redirect('/admin/' + req.params.r);
}));

/* ================================================================
 * 7. ERRORS + START
 * ================================================================ */
function fail(req, res, code, msg) {
  const data = { title: 'Error', code, msg };
  res.status(code).render('pages/error', data, (e, html) => e ? res.type('text').send('Error ' + code + ': ' + msg) : res.send(html));
}
app.use((req, res) => fail(req, res, 404, 'Page not found.'));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const code = err.status || (err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError' ? 400 : 500);
  if (code >= 500) console.error(err);
  fail(req, res, code, code >= 500 && PROD ? 'Something went wrong. Please try again.' : err.message);
});

const ready = (async () => { await build(); await initDb(); })();
if (VERCEL) {
  // Vercel serverless: export a handler (no listen)
  module.exports = async (req, res) => { try { await ready; } catch (e) { console.error(e); return res.status(500).end('Startup failed'); } app(req, res); };
} else {
  ready.then(() => app.listen(PORT, () => console.log('  🚀 ' + (PROD ? 'Production' : 'Dev') + ' server running → http://localhost:' + PORT + '\n  🛠  Admin panel → http://localhost:' + PORT + '/admin\n')))
    .catch(e => { console.error('Startup failed:', e); process.exit(1); });
}
