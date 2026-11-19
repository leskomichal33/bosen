"""Zo slovenského index.html vyrobí SK, EN a DE verziu s prepínačom jazyka SK | EN | DE.
Použitie: make_lang.py <zdroj_sk.html> <výstupný_priečinok>"""
import json, re, html, sys, os
from html.parser import HTMLParser

SRC, OUT = sys.argv[1], sys.argv[2]
BASE = 'https://bosen.leskomichal33.workers.dev'
JAZYKY = [('sk', '/', 'Slovenčina'), ('en', '/en/', 'English'), ('de', '/de/', 'Deutsch'), ('uk', '/ua/', 'Українська')]
STITKY = {'uk': 'UA'}
SUBORY = {'sk': 'index.html', 'en': 'index_en.html', 'de': 'index_de.html', 'uk': 'index_uk.html'}
sk = open(SRC, encoding='utf-8').read()

FORM = {
    'en': {'value="Predávam"': 'value="Selling"', 'value="Prenajímam"': 'value="Renting out"',
           "'Dopyt z webu — '": "'Website enquiry — '", "'Čo riešim: '": "'Need: '",
           "'Meno: '": "'Name: '", "'Kontakt: '": "'Contact: '", "'Ďakujem, správu som dostal.'": "'Thank you, I have received your message.'", "'Ozvem sa vám najneskôr nasledujúci pracovný deň.'": "'I will get back to you by the next working day at the latest.'"},
    'de': {'value="Predávam"': 'value="Verkaufen"', 'value="Prenajímam"': 'value="Vermieten"',
           "'Dopyt z webu — '": "'Anfrage über die Website — '", "'Čo riešim: '": "'Anliegen: '",
           "'Meno: '": "'Name: '", "'Kontakt: '": "'Kontakt: '", "'Ďakujem, správu som dostal.'": "'Vielen Dank, ich habe Ihre Nachricht erhalten.'", "'Ozvem sa vám najneskôr nasledujúci pracovný deň.'": "'Ich melde mich spätestens am nächsten Werktag.'"},
    'uk': {'value="Predávam"': 'value="Продаю"', 'value="Prenajímam"': 'value="Здаю в оренду"',
           "'Dopyt z webu — '": "'Запит з вебсайту — '", "'Čo riešim: '": "'Тема: '",
           "'Meno: '": "'Ім\\'я: '", "'Kontakt: '": "'Контакт: '", "'Ďakujem, správu som dostal.'": "'Дякую, ваше повідомлення отримано.'", "'Ozvem sa vám najneskôr nasledujúci pracovný deň.'": "'Я відповім вам не пізніше наступного робочого дня.'"},
}


def switcher(lang):
    on = 'color: #d7b56d; border-bottom: 1px solid #d7b56d'
    off = 'opacity: 0.75'
    casti = []
    for kod, cesta, nazov in JAZYKY:
        if kod == lang:
            casti.append(f'<span aria-current="page" style="{on}">{STITKY.get(kod, kod.upper())}</span>')
        else:
            casti.append(f'<a href="{cesta}" hreflang="{kod}" lang="{kod}" aria-label="{nazov}" style="{off}">{STITKY.get(kod, kod.upper())}</a>')
    sep = '<span aria-hidden="true" style="opacity: 0.4">|</span>'
    return f'<span class="lang-switch" style="display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; letter-spacing: 0.1em">{sep.join(casti)}</span>'


def add_common(page, lang):
    tel = '<a href="tel:+421944040684" style="font-size: 15px; font-weight: 700">+421 944 040 684</a>'
    assert page.count(tel) == 1, 'tel v hlavičke'
    page = page.replace(tel, switcher(lang) + '\n    ' + tel)
    cesta = dict((k, c) for k, c, _ in JAZYKY)
    alt = f'<link rel="canonical" href="{BASE}{cesta[lang]}">\n'
    alt += ''.join(f'<link rel="alternate" hreflang="{k}" href="{BASE}{c}">\n' for k, c, _ in JAZYKY)
    alt += f'<link rel="alternate" hreflang="x-default" href="{BASE}/">\n'
    # Hlavička na počítači: prepínač jazykov + dlhšie nemecké menu sa musia zmestiť do jedného riadku
    css = ('<style>@media (min-width: 1000px){.site-header nav{max-width:1440px!important;gap:16px 24px!important}'
           '.site-header .navlinks{gap:8px 20px!important}}'
           '@media (min-width: 1000px) and (max-width: 1599px){.site-header nav>a[href^="tel:"]{display:none!important}'
           '.site-header nav{gap:16px 20px!important}.site-header .navlinks{gap:8px 16px!important}}'
           '@media (min-width: 1000px) and (max-width: 1399px){.site-header .navlinks{font-size:14px!important}}</style>\n')
    page = page.replace('</head>', css + '</head>', 1)
    # Marketing predaja: nadpisy kariet v jednej rovine, 5. karta (Spolupráca a širší dosah) na celú šírku
    mkt = '<div style="margin-top: 44px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px">'
    assert page.count(mkt) == 1, 'marketing grid'
    page = page.replace(mkt, mkt.replace('<div ', '<div class="mkt-grid" '))
    css2 = ('<style>.mkt-grid>article{text-align:center}'
            '.mkt-grid>article>div:first-child{flex-direction:column!important;align-items:center!important;gap:8px!important}'
            '.mkt-grid>article:nth-child(5){grid-column:1/-1}'
            '.mkt-grid>article:nth-child(5)>ul{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));column-gap:32px}'
            '@media (min-width: 700px){.mkt-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}'
            '.mkt-grid>article:not(:nth-child(5)){display:grid!important;grid-row:span 2;grid-template-rows:subgrid;row-gap:18px!important}'
            '.mkt-grid>article:not(:nth-child(5))>div:first-child{align-self:center}'
            '.mkt-grid>article:not(:nth-child(5))>ul{align-self:center}}'
            '@media (min-width: 1100px){.mkt-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}</style>\n')
    page = page.replace('</head>', css2 + '</head>', 1)
    return page.replace('<meta name="description"', alt + '<meta name="description"', 1)


def preloz(page, lang):
    tr = json.load(open(f'/home/claude/build/{lang}.json', encoding='utf-8'))
    for s in sorted(tr, key=len, reverse=True):
        e = tr[s]
        for cs, ce in {(s, e), (html.escape(s, quote=True), html.escape(e, quote=True))}:
            page = re.sub(r'(>\s*)' + re.escape(cs) + r'(\s*<)', lambda m: m.group(1) + ce + m.group(2), page)
            page = re.sub(r'((?:alt|placeholder|aria-label|title|content)=")' + re.escape(cs) + '"', lambda m: m.group(1) + ce + '"', page)
    page = page.replace('<html lang="sk">', f'<html lang="{lang}">', 1)
    titul = tr['Michal Leško – realitný maklér BOSEN | Predaj a prenájom nehnuteľností']
    page = re.sub(r'<title>[^<]*</title>', '<title>' + html.escape(titul) + '</title>', page, count=1)
    for a, b in FORM[lang].items():
        page = page.replace(a, b)
    # odkazy na ocenenie nehnuteľností v jazyku stránky (/en/ocenenie/ …)
    page = page.replace('href="/ocenenie/"', 'href="' + dict((k, c) for k, c, _ in JAZYKY)[lang] + 'ocenenie/"')
    # ceny predaja v statických kartách: „429 000 €“
    if lang == 'en':
        page = re.sub(r'>(\d{1,3}(?: \d{3})+) €<', lambda m: '>€' + m.group(1).replace(' ', ',') + '<', page)
    elif lang == 'de':
        page = re.sub(r'>(\d{1,3}(?: \d{3})+) €<', lambda m: '>' + m.group(1).replace(' ', '.') + ' €<', page)
    # kontrola nepreložených textov
    class P(HTMLParser):
        def __init__(s): super().__init__(); s.skip = 0; s.t = []
        def handle_starttag(s, tag, a):
            if tag in ('script', 'style'): s.skip += 1
            for k, v in a:
                if k in ('alt', 'placeholder', 'aria-label', 'title', 'content') and v: s.t.append(v)
        def handle_endtag(s, tag):
            if tag in ('script', 'style'): s.skip -= 1
        def handle_data(s, d):
            if s.skip == 0 and d.strip(): s.t.append(d.strip())
    p = P(); p.feed(page)
    left = sorted({x for x in p.t if x in tr and tr[x] != x})
    print(f'{lang}: nepreložené {len(left)}', *left, sep='\n  ')
    return page


for kod, _, _ in JAZYKY:
    out = add_common(sk, kod)
    if kod != 'sk':
        out = preloz(out, kod)
    open(os.path.join(OUT, SUBORY[kod]), 'w', encoding='utf-8').write(out)
print('hotovo')
