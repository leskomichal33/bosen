# Generovanie webu (build)

Web sa navrhuje v dizajn artefakte (Main.dc.html) a odtiaľ sa prevádza na statické stránky.

1. `node evaldata.js <Main.dc.html> data.json` – vytiahne dáta (texty, odkazy) z dizajnu
2. `python3 convert.py <Main.dc.html> data.json /tmp/sk_base.html` – slovenská stránka (obrázky → /img/, FAQ, formulár)
3. `python3 make_lang.py /tmp/sk_base.html ..` – vyrobí index.html (SK), index_en.html, index_de.html, index_uk.html
   - preklady: en.json, de.json, uk.json (slovenský text → preklad)
   - pridá prepínač SK | EN | DE | UA, hreflang, CSS hlavičky a zarovnanie kariet marketingu
4. `python3 build/upravy_webu.py` (z koreňa repozitára) – nová hlavička s mobilným menu a úvod, zameranie na Bratislavu,
   náhľad odkazu (Open Graph), štruktúrované údaje, písma z /fonts/ (bez Google Fonts), podstránky /cookies/ (4 jazyky)
   a /predaj-nehnutelnosti-bratislava/. Skript sa dá spúšťať opakovane.
5. Kontrola: `grep -c '_blob' ../index.html` musí byť 0, nepreložené texty vypíše make_lang.py

Cesty v skriptoch smerujú na pracovné priečinky (/home/claude/build, /home/claude/design) – pri ďalšom použití ich uprav.
