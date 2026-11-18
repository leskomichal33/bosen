"""Prevedie návrh (Main.dc.html) na statický index.html pre Worker „bosen“."""
import json, re, html, sys

SRC, DATA, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(SRC, encoding='utf-8').read()
data = json.load(open(DATA, encoding='utf-8'))
ACCENT = '#d7b56d'

# Obrázky: ponuka z bosen.sk, ostatné servíruje Worker z /img/
BOSEN_IMG = 'https://www.bosen.sk/imgcache/cw/900/ch/525/'
LISTING_IMG = {
    '0d3ce6fdc870c06966be80acab6df25a': '-6af9bf079c6627939f095942.png',
    'bc0fcf59db89d932c2fca77a599b0654': '-6af63b8f39b003df7b0ce33a.jpg',
    'd0f589f6ff7efaf3396171890dc0a2fe': '-6af63d442fef8ef1070f1567.jpg',
    'a5babc0dd10c620da17caf74ac67ea4b': '-6af3b3ee32a66fe418023a90.png',
    '9551378ee064fbfc8ace0cd4c072dfb1': '-6ae1ae3e204d56a07002b4b7.jpg',
    'ac14a564a5230bb80760f7a084b4f1ff': '-6ada336a13a26b10960b3376.jpg',
    '0440c0a299b11440c6397597fb5edd2e': '-6ad9ab830e9ff5ed690743e2.png',
    '7399bea0fa86e05fa443b59c3dba78fd': '-6a327ba8b1f028243a071135.jpg',
    'adc5ba428a0a3748889b38888f75ba71': '-6a2beb6bf3c1541cb80b805a.png',
    '309558753721884231c63856c724ad9b': '-698e161945e9a54c95098f25.jpg',
    '5e37680f8d8e6a8fe2ce3d5379901c2f': '-69a0475168e8a83180011951.jpg',
}
ASSETS = {
    '/_blob/6f7302eca589cd4a7c9e44ec198de177': '/img/hero.jpg',
    '/_blob/73b5bf37217d992e89097d8eb33855cc': '/img/portret.jpg',
    '/_blob/9f4318a16a014433eb091d38b46462f2': '/img/portret-michal.jpg',
    '/_blob/140002c9729c61d1bfc310618a3245c9': '/img/ocenenie.jpg',
    '/_blob/3cf4f339d0ec5a517611cfdaafad2a53': '/img/podpis-svetly.png',
    '/_blob/a98fd893bd2775bcaff879e9debf5450': '/img/podpis-tmavy.png',
    '/_blob/2418bbe18e3da2cb2953c9188649a914': '/img/foto-predaj.jpg?v=2',
    '/_blob/42006b989847bc9bc3f7b7f96e41f8aa': '/img/foto-prenajom.jpg',
    '/_blob/8e7bd3ee9c559a62a7ac1b5b0b402334': '/img/foto-omne.jpg',
    '/_blob/cc89839ae1222f6bf833ded6a24b6a57': '/img/foto-kontakt.jpg',
    '/_blob/570b79609ac88e762244fe52a8713943': '/img/bosen-logo-biele.png',
    '/_blob/1beb6420692af1ad7075944822f6f2a1': '/img/bosen-logo-cierne.png',
    '/_blob/1c6bf7599168b6cdf52264fe1b47fd61': '/img/pozadie.jpg',
    '/_blob/82ac359bff58d29e99c58848748fac54': '/img/pozadie-motto.jpg',
    '/_blob/edf1cb19f18ac3df884cdaa45f6e5a2a': '/img/krok-1.jpg',
    '/_blob/46c37348f534df44f0506d6d2a4303c1': '/img/krok-2.jpg',
    '/_blob/e3d1e29ada4dab9faf012ddf60d2b50a': '/img/krok-3.jpg',
    '/_blob/8a9a4e92709f24b114425dbe0f99be6c': '/img/krok-4.jpg',
    '/_blob/8fa1a4e840677219f06fa69d7d12c630': '/img/krok-5.jpg',
    '/_blob/02bdbf2b47796e5f92aa113aa817f0c4': '/img/krok-6.jpg',
    '/_blob/944fc9d358cf77439ff615f162b8432a': '/img/krok-7.jpg',
    '/_blob/4d086df6ba3d2e62fb55497f47292a7d': '/img/krok-8.jpg',
    '/_blob/90224ca26bbeefdadd4755a9160efaae': '/img/krok-9.jpg',
}
for lst in ('saleListings', 'rentListings'):
    for p in data[lst]:
        p['img'] = BOSEN_IMG + LISTING_IMG[p['img'].split('/')[-1]]

helmet = re.search(r'<helmet>(.*?)</helmet>', src, re.S).group(1)
body = re.search(r'</helmet>(.*?)</x-dc>', src, re.S).group(1)
body = body.replace('{{accent}}', ACCENT)
for k, v in ASSETS.items():
    body = body.replace(k, v)


def esc(s):
    return html.escape(str(s), quote=True)


def fill(tpl, var, item):
    def rep(m):
        val = item
        for part in m.group(1).split('.')[1:]:
            val = val.get(part, '') if isinstance(val, dict) else ''
        return esc(val)
    return re.sub(r'\{\{\s*(' + re.escape(var) + r'(?:\.\w+)+)\s*\}\}', rep, tpl)


def render_loops(text, scope=None):
    """Rozvinie <sc-for> (aj vnorené) podľa dát."""
    pat = re.compile(r'<sc-for list="\{\{(\w+(?:\.\w+)?)\}\}" as="(\w+)"[^>]*>', re.S)
    out, pos = [], 0
    while True:
        m = pat.search(text, pos)
        if not m:
            out.append(text[pos:]); break
        # nájdi zodpovedajúci </sc-for>
        depth, i = 1, m.end()
        while depth:
            o = text.find('<sc-for', i); c = text.find('</sc-for>', i)
            if o != -1 and o < c:
                depth += 1; i = o + 7
            else:
                depth -= 1; i = c + 9
        inner = text[m.end():i - 9]
        src_name, var = m.group(1), m.group(2)
        if '.' in src_name:
            sv, key = src_name.split('.')
            items = scope[key] if scope else []
        else:
            items = data[src_name]
        parts = []
        for it in items:
            t = render_loops(inner, it)
            parts.append(fill(t, var, it))
        out.append(text[pos:m.start()]); out.append(''.join(parts)); pos = i
    return ''.join(out)


# FAQ → <details>
def faq_html(items, dark):
    col_q = '#f7f5f0' if dark else '#141312'
    col_a = '#e7e1d5' if dark else '#3d3a35'
    line = 'rgba(247,245,240,0.18)' if dark else '#c9c1b2'
    no_col = ACCENT if dark else '#7a5c1f'
    cls = 'faq dark' if dark else 'faq'
    r = []
    for q in items:
        r.append(
            f'<details class="{cls}" style="border-bottom: 1px solid {line}">'
            f'<summary style="padding: 24px 0; display: flex; align-items: center; gap: 22px; cursor: pointer; color: {col_q}; min-height: 44px">'
            f'<span style="font-family: \'IBM Plex Mono\', monospace; font-size: 14px; color: {no_col}">{esc(q["no"])}</span>'
            f'<span style="flex: 1; font-size: 22px; font-weight: 700; letter-spacing: -0.03em">{esc(q["q"])}</span>'
            f'<span class="ic" aria-hidden="true"></span></summary>'
            f'<p style="margin: 0 0 26px 50px; max-width: 600px; font-family: Newsreader, Georgia, serif; font-size: 20px; line-height: 1.55; color: {col_a}">{esc(q["a"])}</p>'
            f'</details>')
    return '\n'.join(r)


for name, dark in (('saleFaq', False), ('rentFaq', True)):
    m = re.search(r'<sc-for list="\{\{' + name + r'\}\}".*?</sc-for>', body, re.S)
    body = body[:m.start()] + faq_html(data[name], dark) + body[m.end():]

# Kontajnery pre automatickú ponuku (Worker ich prepíše aktuálnymi dátami)
for name, typ in (('saleListings', 'predaj'), ('rentListings', 'prenajom')):
    pat = re.compile(r'<div style="display: grid; grid-template-columns: repeat\(auto-fill, minmax\(min\(340px, 100%\), 1fr\)\); gap: 20px">(\s*<sc-for list="\{\{' + name + r'\}\}")')
    body, n = pat.subn(r'<div data-ponuka="' + typ + r'" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr)); gap: 20px">\1', body)
    assert n == 1, name

body = render_loops(body)
assert '{{' not in body and '<sc-' not in body, re.findall(r'.{40}\{\{.{40}', body)[:3]

# Mobilná hlavička, formulár
body = body.replace('<header class="dk" style="position: absolute;', '<header class="dk site-header" style="position: absolute;', 1)
body = body.replace('<div style="display: flex; flex-wrap: wrap; gap: 8px 26px; font-size: 15px; font-weight: 600">', '<div class="navlinks" style="display: flex; flex-wrap: wrap; gap: 8px 26px; font-size: 15px; font-weight: 600">', 1)
body = body.replace('<div style="position: relative; max-width: 1360px; margin: 0 auto; padding: 150px 32px 72px;', '<div class="hero-inner" style="position: relative; max-width: 1360px; margin: 0 auto; padding: 150px 32px 72px;', 1)
form_old = '<form style="'
assert body.count(form_old) == 1
body = body.replace(form_old, '<form id="kontakt-form" onsubmit="sendForm(event)" style="')
body = body.replace('<input type="radio" name="typ" checked', '<input type="radio" name="typ" value="Predávam" checked')
body = body.replace('<input type="radio" name="typ" style', '<input type="radio" name="typ" value="Prenajímam" style')
body = body.replace('Vaše meno<input type="text"', 'Vaše meno<input type="text" name="meno" autocomplete="name" required')
body = body.replace('Telefón alebo e-mail<input type="text"', 'Telefón alebo e-mail<input type="text" name="kontakt" autocomplete="tel" required')
body = body.replace('Vaša správa<textarea', 'Vaša správa<textarea name="sprava"')
body = body.replace('<button type="button" style="background: #141312; color: #f7f5f0; border: 0; padding: 17px 24px; font-size: 14px; font-weight: 700; cursor: pointer; min-height: 44px">Odoslať správu →</button>',
                    '<button type="submit" style="background: #141312; color: #f7f5f0; border: 0; padding: 17px 24px; font-size: 14px; font-weight: 700; cursor: pointer; min-height: 44px">Odoslať správu →</button>')

extra_css = '''
html{scroll-behavior:smooth}
img{max-width:100%}
.faq summary{list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq .ic{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid #8f877a;color:#141312}
.faq .ic::before{content:"+"}
.faq[open] .ic{background:#141312;color:#f7f5f0;border-color:#141312}
.faq[open] .ic::before{content:"\\00d7"}
.faq.dark .ic{color:#f7f5f0}
.faq.dark[open] .ic{background:#d7b56d;color:#141312;border-color:#d7b56d}
.faq summary:focus-visible,a:focus-visible,button:focus-visible{outline:2px solid #d7b56d;outline-offset:3px}
@media (max-width:820px){
 .site-header{position:static!important;background:#141312}
 .site-header nav{padding:16px 20px!important;gap:12px 16px!important}
 .navlinks{order:3;width:100%;gap:6px 18px!important;font-size:14px!important}
 .hero-inner{padding:48px 20px 56px!important}
}
'''
helmet = helmet.replace('</style>', extra_css + '</style>')

script = '''<script>
function sendForm(e){e.preventDefault();var f=e.target,d=new FormData(f),typ=d.get('typ')||'';
var subject=encodeURIComponent('Dopyt z webu — '+typ);
var body=encodeURIComponent(['Čo riešim: '+typ,'Meno: '+(d.get('meno')||''),'Kontakt: '+(d.get('kontakt')||''),'',(d.get('sprava')||'')].join(String.fromCharCode(10)));
window.location.href='mailto:lesko@bosen.sk?subject='+subject+'&body='+body;}
</script>'''

page = f'''<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Michal Leško – realitný maklér BOSEN | Predaj a prenájom nehnuteľností</title>
<meta name="description" content="Michal Leško, realitný maklér BOSEN Group. Predaj a prenájom nehnuteľností – Bratislavský kraj, okres Malacky, Záhorie. Bezplatná konzultácia: +421 944 040 684.">
{helmet.strip()}
</head>
<body>
{body.strip()}
{script}
</body>
</html>
'''
open(OUT, 'w', encoding='utf-8').write(page)
print('ok', len(page))
