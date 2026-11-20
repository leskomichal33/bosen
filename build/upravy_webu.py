#!/usr/bin/env python3
"""Úpravy vygenerovaných stránok webu (spúšťať po make_lang.py, opakovane bezpečné).

  python3 build/upravy_webu.py        (z koreňa repozitára)

Robí:
  - novú hlavičku (na mobile/tablete kompaktná lišta + rozbaľovacie menu) a nový úvod (hero)
  - zameranie na Bratislavu a Bratislavský kraj (texty, popisy pre Google)
  - náhľad odkazu (Open Graph), štruktúrované údaje (JSON-LD)
  - písma z vlastného servera (/fonts/) namiesto Google Fonts – web nepoužíva cookies ani služby tretích strán
  - odkaz na stránku Cookies v päte
  - podstránky: /cookies/ (4 jazyky) a /predaj-nehnutelnosti-bratislava/ (SK)
"""
import html
import json
import os
import re

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = 'https://bosen.leskomichal33.workers.dev'
TEL = '+421944040684'
TEL_TXT = '+421 944 040 684'

JAZYKY = {
    'sk': dict(subor='index.html', home='/', html_lang='sk', og_locale='sk_SK', kod='SK',
        role='realitný maklér', navlabel='Hlavná navigácia',
        nav=[('#predaj', 'Predaj'), ('#prenajom', 'Prenájom'), ('#o-mne', 'O mne'), ('#recenzie', 'Recenzie'), ('#kontakt', 'Kontakt')],
        ocenenie_nav='Ocenenie online', meet='Dohodnúť stretnutie', call='Zavolať', menu='Otvoriť menu', menu_close='Zavrieť menu',
        avatar='Realitný maklér · BOSEN Group',
        eyebrow='Bratislava · Bratislavský kraj',
        h1='Môžete sa<br>na mňa <span class="hero-em">spoľahnúť.</span>',
        sub='Predaj a prenájom bytov, domov a víl v Bratislave a okolí. Postarám sa o všetko – od správnej ceny až po odovzdanie kľúčov.',
        cta1='Bezplatná konzultácia', cta2='Ocenenie online za 2 min',
        trust=[('5,0 ★', 'moje hodnotenie'), ('4,9 ★', 'BOSEN Group na Google'), ('2. miesto', 'najlepší maklér BOSEN 2026')],
        alt='Michal Leško, realitný maklér BOSEN',
        title='Michal Leško – realitný maklér BOSEN | Predaj a prenájom nehnuteľností Bratislava',
        desc='Michal Leško, realitný maklér BOSEN Group. Predaj a prenájom bytov, domov a víl v Bratislave a Bratislavskom kraji. Bezplatná konzultácia: +421 944 040 684.',
        cookies='Cookies',
        nahrady=[
            ('BOSEN Group · Malacky', 'BOSEN Group · Bratislavský kraj'),
            ('napríklad „byt Malacky predaj“', 'napríklad „predaj bytu Bratislava“'),
            ('>Bratislavský kraj, Malacky okres<', '>Bratislava a Bratislavský kraj<'),
        ]),
    'en': dict(subor='index_en.html', home='/en/', html_lang='en', og_locale='en_GB', kod='EN',
        role='real estate agent', navlabel='Main navigation',
        nav=[('#predaj', 'Sales'), ('#prenajom', 'Rentals'), ('#o-mne', 'About me'), ('#recenzie', 'Reviews'), ('#kontakt', 'Contact')],
        ocenenie_nav='Online valuation', meet='Book a meeting', call='Call', menu='Open menu', menu_close='Close menu',
        avatar='Real estate agent · BOSEN Group',
        eyebrow='Bratislava · Bratislava Region',
        h1='You can<br>count <span class="hero-em">on me.</span>',
        sub='Sales and rentals of apartments, houses and villas in Bratislava and the surrounding area. I take care of everything – from the right price to handing over the keys.',
        cta1='Free consultation', cta2='Online valuation in 2 min',
        trust=[('5.0 ★', 'my rating'), ('4.9 ★', 'BOSEN Group on Google'), ('2nd place', 'best agent at BOSEN 2026')],
        alt='Michal Leško, BOSEN real estate agent',
        title='Michal Leško – BOSEN real estate agent | Property sales and rentals in Bratislava',
        desc='Michal Leško, real estate agent at BOSEN Group. Sales and rentals of apartments, houses and villas in Bratislava and the Bratislava Region. Free consultation: +421 944 040 684.',
        cookies='Cookies',
        nahrady=[
            ('BOSEN Group · Malacky', 'BOSEN Group · Bratislava Region'),
            ('e.g. “apartment for sale Malacky”', 'e.g. “apartment for sale Bratislava”'),
            ('>Bratislava Region, Malacky District<', '>Bratislava and the Bratislava Region<'),
        ]),
    'de': dict(subor='index_de.html', home='/de/', html_lang='de', og_locale='de_DE', kod='DE',
        role='Immobilienmakler', navlabel='Hauptnavigation',
        nav=[('#predaj', 'Verkauf'), ('#prenajom', 'Vermietung'), ('#o-mne', 'Über mich'), ('#recenzie', 'Bewertungen'), ('#kontakt', 'Kontakt')],
        ocenenie_nav='Online-Bewertung', meet='Termin vereinbaren', call='Anrufen', menu='Menü öffnen', menu_close='Menü schließen',
        avatar='Immobilienmakler · BOSEN Group',
        eyebrow='Bratislava · Region Bratislava',
        h1='Sie können sich<br>auf mich <span class="hero-em">verlassen.</span>',
        sub='Verkauf und Vermietung von Wohnungen, Häusern und Villen in Bratislava und Umgebung. Ich kümmere mich um alles – vom richtigen Preis bis zur Schlüsselübergabe.',
        cta1='Kostenlose Beratung', cta2='Online-Bewertung in 2 Min.',
        trust=[('5,0 ★', 'meine Bewertung'), ('4,9 ★', 'BOSEN Group bei Google'), ('2. Platz', 'bester Makler BOSEN 2026')],
        alt='Michal Leško, Immobilienmakler BOSEN',
        title='Michal Leško – Immobilienmakler BOSEN | Verkauf und Vermietung von Immobilien in Bratislava',
        desc='Michal Leško, Immobilienmakler der BOSEN Group. Verkauf und Vermietung von Wohnungen, Häusern und Villen in Bratislava und der Region Bratislava. Kostenlose Beratung: +421 944 040 684.',
        cookies='Cookies',
        nahrady=[
            ('BOSEN Group · Malacky', 'BOSEN Group · Region Bratislava'),
            ('z. B. „Wohnung Malacky kaufen“', 'z. B. „Wohnung Bratislava kaufen“'),
            ('>Region Bratislava, Bezirk Malacky<', '>Bratislava und Region Bratislava<'),
        ]),
    'uk': dict(subor='index_uk.html', home='/ua/', html_lang='uk', og_locale='uk_UA', kod='UA',
        role='ріелтор', navlabel='Головна навігація',
        nav=[('#predaj', 'Продаж'), ('#prenajom', 'Оренда'), ('#o-mne', 'Про мене'), ('#recenzie', 'Відгуки'), ('#kontakt', 'Контакти')],
        ocenenie_nav='Онлайн-оцінка', meet='Домовитися про зустріч', call='Зателефонувати', menu='Відкрити меню', menu_close='Закрити меню',
        avatar='Ріелтор · BOSEN Group',
        eyebrow='Братислава · Братиславський край',
        h1='Ви можете<br>розраховувати <span class="hero-em">на мене.</span>',
        sub='Продаж та оренда квартир, будинків і вілл у Братиславі та околицях. Я подбаю про все – від правильної ціни до передачі ключів.',
        cta1='Безкоштовна консультація', cta2='Онлайн-оцінка за 2 хв',
        trust=[('5,0 ★', 'мій рейтинг'), ('4,9 ★', 'BOSEN Group у Google'), ('2 місце', 'найкращий ріелтор BOSEN 2026')],
        alt='Michal Leško, ріелтор BOSEN',
        title='Michal Leško – ріелтор BOSEN | Продаж та оренда нерухомості в Братиславі',
        desc='Michal Leško, ріелтор BOSEN Group. Продаж та оренда квартир, будинків і вілл у Братиславі та Братиславському краї. Безкоштовна консультація: +421 944 040 684.',
        cookies='Файли cookie',
        nahrady=[
            ('BOSEN Group · Malacky', 'BOSEN Group · Братиславський край'),
            ('наприклад «квартира Малацки продаж»', 'наприклад «квартира Братислава продаж»'),
            ('>Братиславський край, округ Малацки<', '>Братислава та Братиславський край<'),
        ]),
}
PORADIE = ['sk', 'en', 'de', 'uk']
NAZVY_JAZYKOV = {'sk': 'Slovenčina', 'en': 'English', 'de': 'Deutsch', 'uk': 'Українська'}


def esc(t):
    return html.escape(t, quote=True)


# ---------------------------------------------------------------- CSS
CSS = r"""
html{scroll-behavior:smooth}
[id]{scroll-margin-top:84px}
.site-header{position:sticky;top:0;z-index:50;background:#141312;border-bottom:1px solid rgba(247,245,240,.1)}
.sh-bar{max-width:1360px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:10px;min-height:52px}
.sh-brand{display:flex;align-items:center;gap:10px;margin-right:auto;min-width:0}
.sh-sig{display:block;height:28px;width:auto}
.sh-name{display:flex;flex-direction:column;line-height:1.15;white-space:nowrap}
.sh-name strong{font-size:15px;letter-spacing:-.01em}
.sh-name span{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#cfc8bb}
.sh-bosen{display:none;height:26px;width:auto;padding-left:14px;border-left:1px solid rgba(247,245,240,.25)}
.sh-links,.sh-lang,.sh-cta{display:none}
.sh-lang{align-items:center;gap:6px;font-size:12.5px;font-weight:700;letter-spacing:.1em}
.sh-lang a,.sh-lang span[aria-current]{padding:6px 4px}
.sh-lang a{opacity:.72}.sh-lang a:hover{opacity:1}
.sh-lang span[aria-current]{color:#d7b56d}
.sh-ico{flex:0 0 auto;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(247,245,240,.22);background:transparent;color:#f7f5f0;cursor:pointer;padding:0}
.sh-ico svg{width:20px;height:20px}
.sh-menu .x{display:none}.site-header.open .sh-menu .x{display:block}.site-header.open .sh-menu .b{display:none}
.sh-panel{border-top:1px solid rgba(247,245,240,.1);max-height:calc(100vh - 64px);overflow:auto}
.sh-panel[hidden]{display:none}
.sh-pin{max-width:1360px;margin:0 auto;padding:8px 20px 24px;display:flex;flex-direction:column;gap:18px}
.sh-plinks{display:flex;flex-direction:column}
.sh-plinks a{display:flex;justify-content:space-between;align-items:center;padding:15px 0;font-size:20px;font-weight:700;letter-spacing:-.02em;border-bottom:1px solid rgba(247,245,240,.1)}
.sh-plinks a::after{content:"→";color:#d7b56d;font-weight:500}
.sh-plang{display:flex;gap:8px;font-size:14px;font-weight:700;letter-spacing:.1em}
.sh-plang a,.sh-plang span{flex:1;text-align:center;padding:11px 0;border:1px solid rgba(247,245,240,.22)}
.sh-plang span[aria-current]{background:#d7b56d;color:#141312;border-color:#d7b56d}
.sh-ptel{font-size:16px;font-weight:700;text-align:center;padding:4px 0}
.btn-gold,.btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 24px;font-size:15px;font-weight:700;box-sizing:border-box;text-align:center}
.dk a.btn-gold,a.btn-gold{background:#d7b56d;color:#141312}
.dk a.btn-gold:hover,a.btn-gold:hover{background:#e6c886;color:#141312}
.dk a.btn-ghost{border:1px solid rgba(247,245,240,.45);color:#f7f5f0}
.dk a.btn-ghost:hover{border-color:#d7b56d;color:#d7b56d}
.hero{position:relative;background:#141312;color:#f7f5f0;overflow:hidden}
.hero-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:75% 60%}
.hero-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,19,18,.80) 0%,rgba(20,19,18,.90) 100%)}
.hero-in{position:relative;max-width:1360px;margin:0 auto;padding:28px 20px 40px;display:grid;gap:40px;align-items:end}
.hero-who{display:flex;align-items:center;gap:12px;margin-bottom:26px}
.hero-who img{width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid #d7b56d;flex:0 0 auto}
.hero-who span{display:flex;flex-direction:column;gap:2px;line-height:1.25}
.hero-who strong{font-size:16px}
.hero-who span span{font-size:13px;color:#cfc8bb}
.hero-eyebrow{margin:0;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#d7b56d}
.hero-h1{margin:14px 0 0;font-weight:800;font-size:clamp(42px,11.5vw,108px);line-height:.94;letter-spacing:-.055em;overflow-wrap:anywhere}
html[lang=uk] .hero-h1,html[lang=de] .hero-h1{font-size:clamp(34px,9.4vw,96px)}
.hero-em{font-family:Newsreader,Georgia,serif;font-style:italic;font-weight:400;letter-spacing:-.03em;color:#d7b56d}
.hero-sub{margin:20px 0 0;max-width:560px;font-size:16.5px;line-height:1.6;color:#e7e1d5}
.hero-ctas{margin-top:28px;display:grid;gap:10px}
.hero-trust{list-style:none;margin:30px 0 0;padding:18px 0 0;border-top:1px solid rgba(247,245,240,.18);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.hero-trust li{display:flex;flex-direction:column;gap:4px;min-width:0}
.hero-trust strong{font-size:18px;letter-spacing:-.02em;color:#f7f5f0;white-space:nowrap}
.hero-trust span{font-size:12.5px;line-height:1.35;color:#cfc8bb}
.hero-photo{display:none;margin:0}
.volby>div>a{padding:28px 20px!important;border-right:0!important;border-bottom:1px solid #ddd6c8}
.volby>div>a:last-child{border-bottom:0}
@media (min-width:480px){.sh-sig{height:32px}.sh-name strong{font-size:16px}}
@media (min-width:600px){
 .sh-bar{padding:12px 24px;gap:14px}.sh-bosen{display:block}
 .hero-in{padding:48px 32px 60px}
 .hero-ctas{display:flex;flex-wrap:wrap;gap:12px}
 .hero-sub{font-size:18px}
 .hero-trust{max-width:640px;gap:24px}
 .hero-trust strong{font-size:22px}.hero-trust span{font-size:13.5px}
 .volby>div>a{padding:36px 32px!important}
}
@media (min-width:760px){.volby>div>a{border-bottom:0}.volby>div>a:first-child{border-right:1px solid #ddd6c8!important}}
@media (min-width:900px){
 .hero-shade{background:linear-gradient(90deg,rgba(20,19,18,.92) 0%,rgba(20,19,18,.72) 45%,rgba(20,19,18,.25) 100%)}
 .hero-in{grid-template-columns:minmax(0,1fr) 320px;padding:72px 32px 80px;gap:56px}
 .hero-who{display:none}
 .hero-photo{display:block;position:relative;isolation:isolate}
 .hero-photo img{display:block;width:100%;height:auto;aspect-ratio:1/1;object-fit:cover;object-position:50% 0}
 .hero-photo::after{content:"";position:absolute;inset:14px -14px -14px 14px;border:1px solid rgba(215,181,109,.55);z-index:-1}
 .hero-eyebrow{font-size:13px}
}
@media (min-width:1180px){
 .sh-bar{padding:14px 32px;gap:20px}
 .sh-links{display:flex;gap:6px 22px;font-size:15px;font-weight:600}
 .sh-lang{display:inline-flex}
 .sh-cta{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;font-size:15px;font-weight:700}
 .dk a.sh-cta{background:#d7b56d;color:#141312}.dk a.sh-cta:hover{background:#e6c886;color:#141312}
 .sh-mob{display:none}
 .sh-panel{display:none!important}
 .hero-in{grid-template-columns:minmax(0,1fr) 400px;padding:96px 32px 104px;gap:80px}
}
@media (min-width:1180px) and (max-width:1320px){.sh-bosen{display:none}}
"""

IKONA_TEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>'
IKONA_MENU = ('<svg class="b" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
              '<svg class="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>')

MENU_JS = """<script id="menu-js">
(function(){var h=document.getElementById('hlavicka');if(!h)return;var b=h.querySelector('.sh-menu'),p=document.getElementById('sh-panel');
function set(o){h.classList.toggle('open',o);b.setAttribute('aria-expanded',o?'true':'false');b.setAttribute('aria-label',o?b.dataset.close:b.dataset.open);p.hidden=!o;}
b.addEventListener('click',function(){set(p.hidden);});
p.addEventListener('click',function(e){if(e.target.closest('a'))set(false);});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!p.hidden){set(false);b.focus();}});
window.addEventListener('resize',function(){if(window.innerWidth>=1180&&!p.hidden)set(false);});})();
</script>"""


def odkaz_jazyka(cesta_pre, aktualny, trieda=''):
    """Prepínač jazykov; cesta_pre(kod) vráti URL tej istej stránky v danom jazyku."""
    casti = []
    for k in PORADIE:
        if k == aktualny:
            casti.append(f'<span aria-current="page">{JAZYKY[k]["kod"]}</span>')
        else:
            casti.append(f'<a href="{cesta_pre(k)}" hreflang="{k}" lang="{k}" aria-label="{NAZVY_JAZYKOV[k]}">{JAZYKY[k]["kod"]}</a>')
    return f'<span class="{trieda}">' + ''.join(casti) + '</span>'


def hlavicka(j, cesta_pre, na_domovskej=True):
    L = JAZYKY[j]
    pre = '' if na_domovskej else L['home']
    oc = L['home'] + 'ocenenie/'
    linky = ''.join(f'<a href="{pre}{h}">{esc(t)}</a>' for h, t in L['nav'])
    plinky = ''.join(f'<a href="{pre}{h}">{esc(t)}</a>' for h, t in L['nav']) + f'<a href="{oc}">{esc(L["ocenenie_nav"])}</a>'
    return f'''<!-- HLAVIČKA -->
<header class="dk site-header" id="hlavicka">
  <div class="sh-bar">
    <a class="sh-brand" href="{pre}#domov" aria-label="Michal Leško – {esc(L['role'])}"><img class="sh-sig" src="/img/podpis-svetly.png" alt="" width="322" height="119"><span class="sh-name"><strong>Michal Leško</strong><span>{esc(L['role'])}</span></span><img class="sh-bosen" src="/img/bosen-logo-biele.png" alt="Bosen Group Real Estate" width="900" height="224"></a>
    <nav class="sh-links" aria-label="{esc(L['navlabel'])}">{linky}</nav>
    {odkaz_jazyka(cesta_pre, j, 'sh-lang lang-switch')}
    <a class="sh-cta" href="{pre}#kontakt">{esc(L['meet'])}</a>
    <a class="sh-ico sh-mob" href="tel:{TEL}" aria-label="{esc(L['call'])} {TEL_TXT}">{IKONA_TEL}</a>
    <button class="sh-ico sh-mob sh-menu" type="button" aria-expanded="false" aria-controls="sh-panel" aria-label="{esc(L['menu'])}" data-open="{esc(L['menu'])}" data-close="{esc(L['menu_close'])}">{IKONA_MENU}</button>
  </div>
  <div class="sh-panel" id="sh-panel" hidden>
    <div class="sh-pin">
      <nav class="sh-plinks" aria-label="{esc(L['navlabel'])}">{plinky}</nav>
      {odkaz_jazyka(cesta_pre, j, 'sh-plang')}
      <a class="btn-gold" href="{pre}#kontakt">{esc(L['meet'])} <span aria-hidden="true">→</span></a>
      <a class="sh-ptel" href="tel:{TEL}">{TEL_TXT}</a>
    </div>
  </div>
</header>
'''


def hero(j):
    L = JAZYKY[j]
    trust = ''.join(f'<li><strong>{esc(a)}</strong><span>{esc(b)}</span></li>' for a, b in L['trust'])
    return f'''<!-- HERO -->
<section id="domov" class="dk hero">
  <img class="hero-bg" src="/img/pozadie.jpg" alt="" width="1640" height="624" fetchpriority="high">
  <div class="hero-shade" aria-hidden="true"></div>
  <div class="hero-in">
    <div class="hero-txt">
      <div class="hero-who"><img src="/img/avatar-michal.jpg" alt="" width="52" height="52"><span><strong>Michal Leško</strong><span>{esc(L['avatar'])}</span></span></div>
      <p class="hero-eyebrow">{esc(L['eyebrow'])}</p>
      <h1 class="hero-h1">{L['h1']}</h1>
      <p class="hero-sub">{esc(L['sub'])}</p>
      <div class="hero-ctas"><a class="btn-gold" href="#kontakt">{esc(L['cta1'])} <span aria-hidden="true">→</span></a><a class="btn-ghost" href="{L['home']}ocenenie/">{esc(L['cta2'])}</a></div>
      <ul class="hero-trust">{trust}</ul>
    </div>
    <figure class="hero-photo"><img src="/img/portret-michal.jpg" alt="{esc(L['alt'])}" width="500" height="500"></figure>
  </div>
</section>

'''


def seo_hlava(j, url, title, desc, extra_ld=None):
    L = JAZYKY[j]
    ld = {
        '@context': 'https://schema.org', '@type': 'RealEstateAgent', '@id': WEB + '/#michal-lesko',
        'name': 'Michal Leško', 'description': L['desc'], 'url': WEB + L['home'],
        'image': WEB + '/img/portret-michal.jpg', 'logo': WEB + '/img/og.jpg',
        'telephone': TEL, 'email': 'lesko@bosen.sk',
        'areaServed': [{'@type': 'City', 'name': 'Bratislava'}, {'@type': 'AdministrativeArea', 'name': 'Bratislavský kraj'}],
        'parentOrganization': {'@type': 'Organization', 'name': 'BOSEN Group', 'url': 'https://www.bosen.sk/'},
        'sameAs': ['https://www.instagram.com/michal_lemi_lesko/', 'https://www.bosen.sk/makler/119-michal-lesko'],
        'availableLanguage': ['sk', 'en', 'de', 'uk'],
    }
    bloky = [ld] + ([extra_ld] if extra_ld else [])
    jsonld = ''.join('<script type="application/ld+json">' + json.dumps(b, ensure_ascii=False).replace('</', '<\\/') + '</script>' for b in bloky)
    alt_loc = ''.join(f'<meta property="og:locale:alternate" content="{JAZYKY[k]["og_locale"]}">' for k in PORADIE if k != j)
    return (f'<!-- SEO -->\n'
            f'<meta property="og:type" content="website"><meta property="og:site_name" content="Michal Leško · BOSEN Group">'
            f'<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">'
            f'<meta property="og:url" content="{url}"><meta property="og:image" content="{WEB}/img/og.jpg">'
            f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
            f'<meta property="og:image:alt" content="Michal Leško – {esc(L["role"])} · BOSEN Group">'
            f'<meta property="og:locale" content="{L["og_locale"]}">{alt_loc}'
            f'<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#141312">\n'
            f'{jsonld}\n<!-- /SEO -->\n')


PISMA = '<link rel="preload" href="/fonts/manrope-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/fonts/fonts.css">'
GOOGLE_PISMA = re.compile(r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*(<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\s*)?<link href="https://fonts\.googleapis\.com/css2[^"]*" rel="stylesheet">')


def vlastne_pisma(t):
    return GOOGLE_PISMA.sub(PISMA, t)


def uprav_index(j):
    L = JAZYKY[j]
    cesta = os.path.join(KOREN, L['subor'])
    t = open(cesta, encoding='utf-8').read()

    # 1) hlavička + hero
    a = t.index('<!-- HLAVIČKA -->')
    b = t.index('<!-- DVE VOĽBY')
    t = t[:a] + hlavicka(j, lambda k: JAZYKY[k]['home']) + '\n' + hero(j) + t[b:]

    # 2) staré CSS hlavičky (z make_lang.py) preč, nové CSS
    t = re.sub(r'@media \(max-width:820px\)\{\n \.site-header\{[^\n]*\n[^\n]*\n[^\n]*\n \.hero-inner\{[^\n]*\n\}\n', '', t)
    t = re.sub(r'<style>@media \(min-width: 1000px\)\{\.site-header nav\{[^<]*</style>\n', '', t)
    t = re.sub(r'<style id="hlavicka-css">.*?</style>\n', '', t, flags=re.S)
    t = t.replace('</head>', '<style id="hlavicka-css">' + CSS.strip() + '</style>\n</head>', 1)

    # 3) písma z vlastného servera
    t = vlastne_pisma(t)

    # 4) title, popis, náhľad odkazu, štruktúrované údaje
    t = re.sub(r'<title>[^<]*</title>', f'<title>{esc(L["title"])}</title>', t, count=1)
    t = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(L["desc"])}">', t, count=1)
    t = re.sub(r'<!-- SEO -->.*?<!-- /SEO -->\n', '', t, flags=re.S)
    t = t.replace('<link rel="preload" href="/fonts/', seo_hlava(j, WEB + L['home'], L['title'], L['desc']) + '<link rel="preload" href="/fonts/', 1)

    # 5) zameranie na Bratislavu
    for stare, nove in L['nahrady']:
        t = t.replace(stare, nove)

    # 6) dve voľby pod úvodom – trieda pre mobilné CSS
    t = re.sub(r'(<!-- DVE VOĽBY: PREDAJ / PRENÁJOM -->\n<nav) (aria-label)', r'\1 class="volby" \2', t)

    # 7) päta: odkaz na Cookies (+ SK: stránka o predaji v Bratislave)
    if 'data-cookies' not in t:
        t = t.replace('<a href="https://www.bosen.sk/ochrana-osobnych-udajov">',
                      f'<a data-cookies href="{L["home"]}cookies/">{esc(L["cookies"])}</a><a href="https://www.bosen.sk/ochrana-osobnych-udajov">', 1)
    if j == 'sk' and 'data-seo-ba' not in t:
        t = t.replace('<a data-cookies', '<a data-seo-ba href="/predaj-nehnutelnosti-bratislava/">Predaj nehnuteľností Bratislava</a><a data-cookies', 1)

    # 8) skript menu
    t = re.sub(r'<script id="menu-js">.*?</script>\n', '', t, flags=re.S)
    t = t.replace('</body>', MENU_JS + '\n</body>', 1)

    open(cesta, 'w', encoding='utf-8').write(t)
    zvysok = re.findall(r'[^<>]{0,40}(?:Malacky okres|Malacky District|Bezirk Malacky|округ Малацки)[^<>]{0,20}', t)
    print(f'{L["subor"]}: hotovo' + (f' – POZOR, ostalo: {zvysok}' if zvysok else ''))


# ---------------------------------------------------------------- podstránky
PODSTRANKA_CSS = r"""
body{margin:0;background:#efece5}
a{color:#141312;text-decoration:none}a:hover{color:#7a5c1f}
.dk a{color:#f7f5f0}.dk a:hover{color:#d7b56d}
a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid #d7b56d;outline-offset:3px}
.wrap{font-family:Manrope,system-ui,sans-serif;color:#141312;background:#efece5;min-width:320px}
.page-hero{background:#141312;color:#f7f5f0}
.page-hero .in{max-width:960px;margin:0 auto;padding:48px 20px 52px}
.eyebrow{margin:0;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#d7b56d}
.page-hero h1{margin:14px 0 0;font-weight:800;font-size:clamp(36px,7vw,72px);line-height:.98;letter-spacing:-.05em}
.page-hero h1 em{font-family:Newsreader,Georgia,serif;font-weight:400;letter-spacing:-.03em;color:#d7b56d}
.page-hero p.lead{margin:20px 0 0;max-width:640px;font-size:17px;line-height:1.65;color:#e7e1d5}
.page-hero .ctas{margin-top:26px;display:flex;flex-wrap:wrap;gap:12px}
main.obsah{max-width:960px;margin:0 auto;padding:48px 20px 72px}
main.obsah h2{margin:56px 0 0;font-size:clamp(28px,4vw,40px);font-weight:800;letter-spacing:-.04em;line-height:1.05}
main.obsah h2:first-child{margin-top:0}
main.obsah p,main.obsah li{font-size:16.5px;line-height:1.7;color:#3d3a35}
main.obsah p{margin:16px 0 0}
main.obsah a{color:#7a5c1f;text-decoration:underline;text-underline-offset:3px}
.karty{list-style:none;margin:24px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px}
.karty li{background:#f7f5f0;border:1px solid #ddd6c8;padding:22px 22px 24px}
.karty strong{display:block;font-size:18px;letter-spacing:-.02em;color:#141312;margin-bottom:6px}
.lokality{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:20px 0 0;padding:0}
.lokality li{border:1px solid #c9c1b2;padding:7px 12px;font-size:14.5px;line-height:1.3}
.faq{border-top:1px solid #c9c1b2;margin-top:20px}
.faq details{border-bottom:1px solid #c9c1b2}
.faq summary{cursor:pointer;list-style:none;padding:18px 0;font-size:18px;font-weight:700;letter-spacing:-.02em;display:flex;justify-content:space-between;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:#7a5c1f;font-weight:500}
.faq details[open] summary::after{content:"×"}
.faq details p{margin:0 0 18px}
.zaver{margin-top:56px;background:#141312;color:#f7f5f0;padding:32px 24px}
.zaver h2{margin:0!important;color:#f7f5f0}
.zaver p{color:#e7e1d5!important}
.zaver .ctas{margin-top:22px;display:flex;flex-wrap:wrap;gap:12px}
.pata{background:#141312;color:#b9b2a6;padding:28px 0;font-size:14.5px}
.pata .in{max-width:1360px;margin:0 auto;padding:0 20px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px 28px}
.pata a{color:#f7f5f0}
@media (min-width:600px){.page-hero .in{padding:72px 32px 76px}main.obsah{padding:64px 32px 96px}.zaver{padding:44px 40px}.pata .in{padding:0 32px}}
"""


def podstranka(j, cesta, title, desc, telo, alternativy=None, extra_ld=None):
    """Celá HTML stránka so spoločnou hlavičkou. alternativy = {kod_jazyka: cesta} pre hreflang."""
    L = JAZYKY[j]
    url = WEB + cesta
    alt = ''
    if alternativy:
        alt = ''.join(f'<link rel="alternate" hreflang="{k}" href="{WEB}{p}">' for k, p in alternativy.items())
        alt += f'<link rel="alternate" hreflang="x-default" href="{WEB}{alternativy["sk"]}">'
        cesta_pre = lambda k: alternativy.get(k, JAZYKY[k]['home'])
    else:
        cesta_pre = lambda k: cesta if k == j else JAZYKY[k]['home']
    pata = (f'<footer class="dk pata"><div class="in"><span>© 2026 Michal Leško · BOSEN Group</span>'
            f'<span style="display:flex;flex-wrap:wrap;gap:18px"><a href="{L["home"]}cookies/">{esc(L["cookies"])}</a>'
            f'<a href="https://www.bosen.sk/ochrana-osobnych-udajov">{"Ochrana osobných údajov" if j=="sk" else "Privacy policy" if j=="en" else "Datenschutz" if j=="de" else "Захист персональних даних"} ↗</a>'
            f'<a href="tel:{TEL}">{TEL_TXT}</a></span></div></footer>')
    return (f'<!doctype html>\n<html lang="{L["html_lang"]}">\n<head>\n<meta charset="utf-8">\n'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f'<title>{esc(title)}</title>\n<link rel="canonical" href="{url}">{alt}\n'
            f'<meta name="description" content="{esc(desc)}">\n'
            + seo_hlava(j, url, title, desc, extra_ld) + PISMA +
            f'\n<style>{PODSTRANKA_CSS.strip()}</style>\n<style id="hlavicka-css">{CSS.strip()}</style>\n</head>\n<body>\n<div class="wrap">\n'
            + hlavicka(j, cesta_pre, na_domovskej=False) + telo + pata + '\n</div>\n' + MENU_JS + '\n</body>\n</html>\n')


COOKIES = {
    'sk': ('Cookies a súkromie', 'Cookies a <em>súkromie.</em>',
           'Tento web nepoužíva žiadne cookies. Preto sa vás nepýtame na súhlas a nezobrazujeme lištu s nastaveniami.',
           [('Žiadne cookies, žiadne sledovanie', 'Nepoužívam analytické, marketingové ani reklamné cookies, sledovacie kódy (napr. Google Analytics, Facebook Pixel) ani nič, čo by si do vášho prehliadača ukladalo údaje.'),
            ('Všetko zo stránky samotnej', 'Písma, fotky a skripty sa načítavajú priamo z tohto webu. Fotky ponúk sa zobrazujú zo stránky www.bosen.sk, ktorá pri nich cookies nenastavuje.'),
            ('Formuláre', 'Údaje z kontaktného formulára a z ocenenia nehnuteľnosti použijem iba na to, aby som vám odpovedal. Spracúvajú sa podľa zásad ochrany osobných údajov BOSEN Group.'),
            ('Odkazy na iné weby', 'Odkazy na Instagram, Google alebo bosen.sk vedú na iné stránky, ktoré majú vlastné pravidlá pre cookies.')],
           'Ak by som v budúcnosti začal používať cookies, ktoré si vyžadujú súhlas, web sa vás naň najprv opýta.',
           'Zásady ochrany osobných údajov BOSEN Group', 'Späť na hlavnú stránku',
           'Tento web nepoužíva cookies ani sledovacie nástroje. Prečítajte si, aké údaje sa na webe Michala Leška spracúvajú.'),
    'en': ('Cookies and privacy', 'Cookies and <em>privacy.</em>',
           'This website does not use any cookies. That is why we do not ask for your consent or show a cookie banner.',
           [('No cookies, no tracking', 'I do not use analytics, marketing or advertising cookies, tracking codes (such as Google Analytics or Facebook Pixel) or anything else that stores data in your browser.'),
            ('Everything from this website', 'Fonts, photos and scripts are loaded directly from this website. Listing photos are displayed from www.bosen.sk, which does not set cookies for them.'),
            ('Forms', 'I only use the details from the contact form and the property valuation to reply to you. They are processed under the BOSEN Group privacy policy.'),
            ('Links to other websites', 'Links to Instagram, Google or bosen.sk lead to other websites, which have their own cookie rules.')],
           'If I ever start using cookies that require consent, the website will ask you first.',
           'BOSEN Group privacy policy', 'Back to the home page',
           'This website uses no cookies or tracking tools. Read what data is processed on Michal Leško’s website.'),
    'de': ('Cookies und Datenschutz', 'Cookies und <em>Datenschutz.</em>',
           'Diese Website verwendet keine Cookies. Deshalb fragen wir nicht nach Ihrer Einwilligung und zeigen kein Cookie-Banner.',
           [('Keine Cookies, kein Tracking', 'Ich verwende keine Analyse-, Marketing- oder Werbe-Cookies, keine Tracking-Codes (z. B. Google Analytics oder Facebook Pixel) und nichts, was Daten in Ihrem Browser speichert.'),
            ('Alles von dieser Website', 'Schriften, Fotos und Skripte werden direkt von dieser Website geladen. Fotos der Angebote werden von www.bosen.sk angezeigt, die dafür keine Cookies setzt.'),
            ('Formulare', 'Die Angaben aus dem Kontaktformular und der Immobilienbewertung verwende ich nur, um Ihnen zu antworten. Sie werden gemäß der Datenschutzerklärung der BOSEN Group verarbeitet.'),
            ('Links zu anderen Websites', 'Links zu Instagram, Google oder bosen.sk führen zu anderen Websites mit eigenen Cookie-Regeln.')],
           'Sollte ich künftig Cookies verwenden, die eine Einwilligung erfordern, fragt die Website Sie zuerst.',
           'Datenschutzerklärung der BOSEN Group', 'Zurück zur Startseite',
           'Diese Website verwendet keine Cookies und keine Tracking-Tools. Lesen Sie, welche Daten auf der Website von Michal Leško verarbeitet werden.'),
    'uk': ('Файли cookie та конфіденційність', 'Файли cookie та <em>конфіденційність.</em>',
           'Цей вебсайт не використовує жодних файлів cookie. Тому ми не просимо вашої згоди і не показуємо банер cookie.',
           [('Без cookie, без відстеження', 'Я не використовую аналітичні, маркетингові чи рекламні cookie, коди відстеження (наприклад, Google Analytics чи Facebook Pixel) або будь-що, що зберігає дані у вашому браузері.'),
            ('Усе з цього сайту', 'Шрифти, фото та скрипти завантажуються безпосередньо з цього сайту. Фото пропозицій показуються з www.bosen.sk, який не встановлює для них cookie.'),
            ('Форми', 'Дані з контактної форми та з оцінки нерухомості я використовую лише для того, щоб вам відповісти. Вони обробляються згідно з політикою захисту персональних даних BOSEN Group.'),
            ('Посилання на інші сайти', 'Посилання на Instagram, Google або bosen.sk ведуть на інші сайти, які мають власні правила щодо cookie.')],
           'Якщо в майбутньому я почну використовувати cookie, що потребують згоди, сайт спершу запитає вас.',
           'Політика захисту персональних даних BOSEN Group', 'Повернутися на головну сторінку',
           'Цей сайт не використовує cookie та інструменти відстеження. Дізнайтеся, які дані обробляються на сайті Michal Leško.'),
}
SUBORY_COOKIES = {'sk': 'cookies.html', 'en': 'cookies_en.html', 'de': 'cookies_de.html', 'uk': 'cookies_uk.html'}


def cookies():
    alt = {k: JAZYKY[k]['home'] + 'cookies/' for k in PORADIE}
    for j in PORADIE:
        title, h1, lead, body, zaver, zasady, spat, desc = COOKIES[j]
        karty = ''.join(f'<li><strong>{esc(a)}</strong>{esc(b)}</li>' for a, b in body)
        telo = (f'<section class="dk page-hero"><div class="in"><p class="eyebrow">Michal Leško · BOSEN Group</p><h1>{h1}</h1>'
                f'<p class="lead">{esc(lead)}</p></div></section>\n'
                f'<main class="obsah"><ul class="karty" style="margin-top:0">{karty}</ul>'
                f'<p>{esc(zaver)}</p>'
                f'<p><a href="https://www.bosen.sk/ochrana-osobnych-udajov">{esc(zasady)} ↗</a></p>'
                f'<p><a href="{JAZYKY[j]["home"]}">{esc(spat)}</a></p></main>\n')
        open(os.path.join(KOREN, SUBORY_COOKIES[j]), 'w', encoding='utf-8').write(
            podstranka(j, alt[j], f'{title} – Michal Leško, BOSEN', desc, telo, alternativy=alt))
    print('cookies: hotovo (4 jazyky)')


def bratislava():
    cesta = '/predaj-nehnutelnosti-bratislava/'
    title = 'Predaj bytu, domu a vily v Bratislave – realitný maklér Michal Leško, BOSEN'
    desc = 'Predávate byt, rodinný dom alebo vilu v Bratislave či v Bratislavskom kraji? Bezplatné ocenenie, marketing, obhliadky a bezpečný prevod. Michal Leško, BOSEN Group.'
    faq = [
        ('Koľko stojí ocenenie nehnuteľnosti?', 'Ocenenie je bezplatné a nezáväzné. Orientačnú cenu si môžete zistiť online za 2 minúty, presnejšiu vám poviem po obhliadke nehnuteľnosti.'),
        ('Ako určíte správnu cenu?', 'Porovnám vašu nehnuteľnosť s podobnými ponukami a predajmi v okolí a zohľadním jej stav, polohu, dispozíciu aj vybavenie. Cenu vám odporučím tak, aby ste nepredali lacno, ale ani nečakali na kupujúceho zbytočne dlho.'),
        ('S kým budem počas predaja komunikovať?', 'Iba so mnou. Od prvého rozhovoru až po podpis a odovzdanie kľúčov viete, kde sa nachádzame a čo bude nasledovať.'),
        ('Predávate aj mimo Bratislavy?', 'Áno. Zameriavam sa na Bratislavu a jej okolie, ale pomôžem vám s predajom kdekoľvek v Bratislavskom kraji.'),
    ]
    faq_ld = {'@context': 'https://schema.org', '@type': 'FAQPage',
              'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}
    sluzby = [
        ('Bezplatné ocenenie', 'Cenu odporučím podľa lokality, stavu a porovnateľných nehnuteľností v okolí.'),
        ('Príprava a prezentácia', 'Profesionálne fotky a video, zábery z dronu, 3D virtuálna prehliadka, pôdorys aj home staging, aby vaša nehnuteľnosť vynikla.'),
        ('Marketing, ktorý nájde kupujúceho', 'Topovanie na realitných portáloch, reklama na Facebooku, Instagrame a Google a ponuka najprv vlastnej databáze záujemcov. Pre cudzincov aj v angličtine.'),
        ('Obhliadky a vyjednávanie', 'Obhliadky vediem ja. Kupujúcich preverím a vyjednám pre vás čo najlepšie podmienky.'),
        ('Zmluvy a financovanie', 'Zmluvy, bezpečný prevod aj hypotéka kupujúceho. Právne a hypotekárne poradenstvo zabezpečuje zázemie BOSEN Group.'),
        ('Odovzdanie', 'Som pri vás až po posledný podpis a odovzdanie kľúčov.'),
    ]
    lokality_ba = ['Staré Mesto', 'Ružinov', 'Nové Mesto', 'Karlova Ves', 'Dúbravka', 'Lamač', 'Záhorská Bystrica', 'Devín', 'Rača', 'Vajnory', 'Petržalka', 'Jarovce', 'Rusovce', 'Čunovo', 'Podunajské Biskupice', 'Vrakuňa']
    lokality_okolie = ['Stupava', 'Marianka', 'Borinka', 'Svätý Jur', 'Pezinok', 'Limbach', 'Senec', 'Chorvátsky Grob', 'Ivanka pri Dunaji', 'Bernolákovo', 'Dunajská Lužná', 'Rovinka', 'Most pri Bratislave', 'Malacky a okolie']
    karty = ''.join(f'<li><strong>{esc(a)}</strong>{esc(b)}</li>' for a, b in sluzby)
    faq_html = ''.join(f'<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faq)
    telo = f'''<section class="dk page-hero"><div class="in">
<p class="eyebrow">Bratislava · Bratislavský kraj</p>
<h1>Predaj bytu, domu a vily <em>v Bratislave.</em></h1>
<p class="lead">Som realitný maklér BOSEN Group a zameriavam sa na Bratislavu a jej okolie – mestské byty, rodinné domy, vily aj novostavby. Predám vašu nehnuteľnosť za správnu cenu a postarám sa o všetko od ocenenia až po odovzdanie kľúčov.</p>
<div class="ctas"><a class="btn-gold" href="/#kontakt">Bezplatná konzultácia <span aria-hidden="true">→</span></a><a class="btn-ghost" href="/ocenenie/">Ocenenie online za 2 min</a></div>
</div></section>
<main class="obsah">
<h2>Čo pre vás urobím</h2>
<p>Pri predaji v Bratislave nestačí dať inzerát na portál. Kupujúci porovnávajú desiatky ponúk, preto musí vaša nehnuteľnosť zaujať na prvý pohľad a mať správne nastavenú cenu.</p>
<ul class="karty">{karty}</ul>
<h2>Kde predávam</h2>
<p>Pôsobím vo všetkých mestských častiach Bratislavy:</p>
<ul class="lokality">{''.join(f'<li>{esc(x)}</li>' for x in lokality_ba)}</ul>
<p>A v okolí Bratislavy a v celom Bratislavskom kraji, napríklad:</p>
<ul class="lokality">{''.join(f'<li>{esc(x)}</li>' for x in lokality_okolie)}</ul>
<h2>Ako predaj prebieha</h2>
<ul class="karty">
<li><strong>1. Najprv sa porozprávame</strong>Zistím, prečo predávate, čo je pre vás dôležité a aký máte plán. Bez tlaku a bez záväzkov.</li>
<li><strong>2. Pripravím plán na mieru</strong>Ocenenie, príprava a marketing nehnuteľnosti, obhliadky a všetky dôležité detaily.</li>
<li><strong>3. Bezpečne až do cieľa</strong>Zmluvy, financovanie kupujúceho aj odovzdanie. Som pri vás až po posledný podpis.</li>
</ul>
<p>Aktuálne nehnuteľnosti, ktoré predávam a prenajímam, nájdete <a href="/#predaj">na hlavnej stránke</a>.</p>
<h2>Časté otázky</h2>
<div class="faq">{faq_html}</div>
<section class="dk zaver">
<h2>Chcete vedieť, koľko má vaša nehnuteľnosť hodnotu?</h2>
<p>Zavolajte mi alebo napíšte. Prvá konzultácia aj ocenenie sú zdarma a nezáväzné.</p>
<div class="ctas"><a class="btn-gold" href="tel:{TEL}">Zavolať {TEL_TXT}</a><a class="btn-ghost" href="/#kontakt">Napísať správu</a></div>
</section>
</main>
'''
    open(os.path.join(KOREN, 'predaj-bratislava.html'), 'w', encoding='utf-8').write(
        podstranka('sk', cesta, title, desc, telo, extra_ld=faq_ld))
    print('predaj-bratislava: hotovo')


def ocenenie():
    for subor, nahrady in [
        ('ocenenie.html', [('napr. Malacky, Bratislava-Ružinov', 'napr. Bratislava-Ružinov, Stupava')]),
        ('ocenenie-preklady.js', [('napr. Malacky, Bratislava-Ružinov', 'napr. Bratislava-Ružinov, Stupava'),
                                  ('e.g. Malacky, Bratislava-Ružinov', 'e.g. Bratislava-Ružinov, Stupava'),
                                  ('z. B. Malacky, Bratislava-Ružinov', 'z. B. Bratislava-Ružinov, Stupava'),
                                  ('напр. Malacky, Bratislava-Ružinov', 'напр. Bratislava-Ružinov, Stupava')]),
    ]:
        p = os.path.join(KOREN, subor)
        t = open(p, encoding='utf-8').read()
        for a, b in nahrady:
            t = t.replace(a, b)
        if subor == 'ocenenie.html':
            t = vlastne_pisma(t)
        open(p, 'w', encoding='utf-8').write(t)
    print('ocenenie: hotovo')


if __name__ == '__main__':
    for j in PORADIE:
        uprav_index(j)
    cookies()
    bratislava()
    ocenenie()
