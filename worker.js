// Web Michala Leška – sekciu „Aktuálna ponuka“ automaticky dopĺňa z profilu na bosen.sk.
// Raz denne (cron) sa načíta profil makléra, ponuky sa uložia do KV a stránka ich zobrazí.
// Keď sa ponuku nepodarí načítať, zostane posledná známa ponuka (alebo ponuka priamo v index.html).
import page from './index.html';

const PROFIL = 'https://www.bosen.sk/makler/119-michal-lesko';
const BOSEN = 'https://www.bosen.sk';
const KV_KLUC = 'ponuka';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/' && url.pathname !== '/index.html') {
      return new Response('Stránka sa nenašla', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    let data = null;
    try {
      data = await env.PONUKA.get(KV_KLUC, 'json');
    } catch (e) {
      console.error('KV get zlyhal', e);
    }
    // Prvé spustenie (prázdne KV): načítaj ponuku hneď, aby sa zobrazila aktuálna.
    if (!data) {
      try {
        data = await obnovPonuku(env);
      } catch (e) {
        console.error('Načítanie ponuky zlyhalo, zobrazujem statickú ponuku', e);
      }
    }

    const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' };
    const response = new Response(page, { headers });
    if (!data || !data.items || !data.items.length) return response;

    const items = data.items;
    const nPredaj = items.filter((i) => i.typ === 'predaj').length;
    const nPrenajom = items.filter((i) => i.typ === 'prenajom').length;
    const filtre =
      `<button class="filter active" data-filter="all" onclick="filterCards(this)">Všetko (${items.length})</button>` +
      (nPredaj ? `<button class="filter" data-filter="predaj" onclick="filterCards(this)">Predaj (${nPredaj})</button>` : '') +
      (nPrenajom ? `<button class="filter" data-filter="prenajom" onclick="filterCards(this)">Prenájom (${nPrenajom})</button>` : '');

    return new HTMLRewriter()
      .on('div.cards', { element(el) { el.setInnerContent('\n' + items.map(karta).join('\n') + '\n', { html: true }); } })
      .on('div.filters', { element(el) { el.setInnerContent(filtre, { html: true }); } })
      .transform(response);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(obnovPonuku(env));
  },
};

// Načíta všetky strany „Moja ponuka“ z profilu, uloží do KV a vráti dáta.
async function obnovPonuku(env) {
  const items = [];
  const videne = new Set();
  let url = PROFIL;
  for (let strana = 0; strana < 8 && url; strana++) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; leskomichal-web/1.0)', 'accept-language': 'sk' } });
    if (!res.ok) throw new Error(`bosen.sk vrátil HTTP ${res.status}`);
    const html = await res.text();
    const sekcia = vyrezSekciu(html);
    if (!sekcia) break;
    let nove = 0;
    for (const item of parsujKarty(sekcia)) {
      if (videne.has(item.odkaz)) continue;
      videne.add(item.odkaz);
      items.push(item);
      nove++;
    }
    const dalsia = sekcia.match(/id="nextPageLink" value="([^"]+)"/);
    url = nove && dalsia ? BOSEN + dalsia[1].replace(/&amp;/g, '&').replace(/#.*$/, '') : null;
  }
  // Ochrana: ak sa nenačítala ani jedna ponuka (napr. bosen.sk zmenil stránku), staré dáta neprepisuj.
  if (!items.length) throw new Error('Na profile sa nenašla žiadna ponuka');
  const data = { aktualizovane: new Date().toISOString(), items };
  await env.PONUKA.put(KV_KLUC, JSON.stringify(data));
  console.log(`Ponuka aktualizovaná: ${items.length} nehnuteľností`);
  return data;
}

// Časť stránky od nadpisu „Moja ponuka“ po ďalší nadpis sekcie (predané nehnuteľnosti sa nezahrnú).
function vyrezSekciu(html) {
  const m = /<h3>\s*Moja ponuka\s*<\/h3>/i.exec(html);
  if (!m) return null;
  const koniec = html.indexOf('<h3>', m.index + m[0].length);
  return html.slice(m.index, koniec === -1 ? undefined : koniec);
}

function parsujKarty(sekcia) {
  const out = [];
  const re = /<article class="[^"]*property_box[^"]*">([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(sekcia))) {
    const a = m[1];
    const href = (a.match(/href="([^"]+)"/) || [])[1];
    if (!href) continue;
    const nazovRaw = text((a.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1]);
    if (/rezervovan|predan/i.test(nazovRaw)) continue;
    const stitok = text((a.match(/pbct_01">([\s\S]*?)<\/li>/) || [])[1]);
    const tagy = [...a.matchAll(/<li class="d-inline pb_tag0(\d)">([\s\S]*?)<\/li>/g)].map((t) => [t[1], text(t[2]).replace(/,\s*$/, '')]);
    const tag = (n) => (tagy.find((t) => t[0] === String(n)) || [])[1] || '';
    const cena = text((a.match(/class="ob_price">([\s\S]*?)<\/div>/) || [])[1]);
    const img = (a.match(/<img src="([^"]+)"/) || [])[1] || '';
    const typ = /pren[aá]jom/i.test(stitok + ' ' + nazovRaw) ? 'prenajom' : 'predaj';
    const nazov = upravNazov(nazovRaw);
    const lokalita = tag(1);
    const ulica = tag(2).replace(/,?\s*\d{3}\s?\d{2}\s.*$/, '');
    // Výmera môže byť v rôznych štítkoch (pb_tag04, pb_tag05…) – berie sa prvý, ktorý končí na m2.
    const plochaTag = tagy.map((t) => t[1]).find((v) => /^\d[\d\s.,]*\s*m2$/i.test(v)) || '';
    const plocha = plochaTag.replace(/\s*m2$/i, '').replace('.', ',');
    const izby = (nazovRaw.match(/(\d(?:[,.]5)?)\s*-?\s*(?:i\b|izb|izieb)/i) || [])[1];
    const pozemok = (nazovRaw.match(/pozemok\s*(\d[\d\s]*)\s*m/i) || [])[1];
    const druh = /\b(dom|domy|bungalov|chata|chalupa|rekrea|vila)\b/i.test(nazovRaw) ? 'Rodinný dom'
      : /byt|izb|\b\d\s*i\b|garsón|apartm|novostavba/i.test(nazovRaw) ? 'Byt'
      : /pozem/i.test(nazovRaw) ? 'Pozemok'
      : /garáž|garaz/i.test(nazovRaw) ? 'Garáž'
      : /kancel|priestor|obchod|sklad/i.test(nazovRaw) ? 'Nebytový priestor' : 'Nehnuteľnosť';
    const features = [];
    if (izby) features.push(`⌂ ${izby.replace('.', ',')} ${izbySlovo(izby)}`);
    if (plocha) features.push(`▱ ${plocha} m²`);
    if (pozemok) features.push(`▧ ${tisice(pozemok)} m² pozemok`);
    else if (lokalita) features.push(lokalita.replace(/^Bratislava-/, ''));
    out.push({
      typ,
      druh,
      nazov,
      adresa: [ulica, lokalita].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', '),
      features,
      cena: cena.replace(/\s*€\s*\/\s*mesiac/i, ' €/mes.').replace(/\s+/g, ' ').trim(),
      img: img ? BOSEN + img.replace(/^https?:\/\/www\.bosen\.sk/, '') : '',
      odkaz: BOSEN + href.replace(/^https?:\/\/www\.bosen\.sk/, ''),
    });
  }
  return out;
}

function karta(p, i) {
  const badge = i === 0 ? 'Novinka' : p.typ === 'prenajom' ? 'Prenájom' : p.druh;
  const meta = `${p.druh} · ${p.typ === 'prenajom' ? 'Prenájom' : 'Predaj'}`;
  const img = p.img
    ? `<img src="${esc(p.img)}" alt="${esc(p.nazov)}" loading="lazy">`
    : '';
  return `      <article class="card" data-type="${p.typ}"><div class="card-img">${img}<span class="badge">${esc(badge)}</span>` +
    `<button class="heart" aria-label="Pridať do obľúbených" onclick="this.textContent=this.textContent==='♡'?'♥':'♡'">♡</button></div>` +
    `<div class="card-body"><div class="card-meta">${esc(meta)}</div><h3>${esc(p.nazov)}</h3><div class="address">${esc(p.adresa)}</div>` +
    `<div class="features">${p.features.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` +
    `<div class="price-row"><span class="price">${esc(p.cena)}</span><a class="detail" href="${esc(p.odkaz)}" target="_blank" rel="noopener">Detail na BOSEN ↗</a></div></div></article>`;
}

function upravNazov(s) {
  let t = s
    .replace(/^\s*BOSEN\s*[|I]\s*/i, '')
    .replace(/^(na\s+prenájom|na\s+predaj|predaj|prenájom)\s*[:-]?\s*/i, '')
    .replace(/(\d)\s?m2\b/gi, '$1 m²')
    .trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, '') + '…' : t;
}

function tisice(n) {
  return String(n).replace(/\s/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function izbySlovo(n) {
  const x = parseFloat(String(n).replace(',', '.'));
  return x >= 5 ? 'izieb' : x >= 2 ? 'izby' : 'izba';
}

function text(s) {
  if (!s) return '';
  return decode(s.replace(/<sup>2<\/sup>/g, '2').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
