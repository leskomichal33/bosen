// Web Michala Leška – sekciu „Aktuálna ponuka“ automaticky dopĺňa z profilu na bosen.sk.
// Raz denne (cron) sa načíta profil makléra, ponuky sa uložia do KV a stránka ich zobrazí.
// Keď sa ponuku nepodarí načítať, zostane posledná známa ponuka (alebo ponuka priamo v index.html).
import page from './index.html';
import pageEn from './index_en.html';
import pageDe from './index_de.html';
import pageUk from './index_uk.html';
import { ocenenieFetch, ocenenieCron, jeOcenenie, kontaktFetch } from './ocenenie.js';
import imgHero from './img/hero.jpg';
import imgPortret from './img/portret.jpg';
import imgPortretMichal from './img/portret-michal.jpg';
import imgOcenenie from './img/ocenenie.jpg';
import imgPodpisSvetly from './img/podpis-svetly.png';
import imgPodpisTmavy from './img/podpis-tmavy.png';
import imgFotoPredaj from './img/foto-predaj.jpg';
import imgFotoPrenajom from './img/foto-prenajom.jpg';
import imgFotoOmne from './img/foto-omne.jpg';
import imgFotoKontakt from './img/foto-kontakt.jpg';
import imgLogoBiele from './img/bosen-logo-biele.png';
import img_pozadie_jpg from './img/pozadie.jpg';
import img_pozadie_motto_jpg from './img/pozadie-motto.jpg';
import img_krok_1_jpg from './img/krok-1.jpg';
import img_krok_2_jpg from './img/krok-2.jpg';
import img_krok_3_jpg from './img/krok-3.jpg';
import img_krok_4_jpg from './img/krok-4.jpg';
import img_krok_5_jpg from './img/krok-5.jpg';
import img_krok_6_jpg from './img/krok-6.jpg';
import img_krok_7_jpg from './img/krok-7.jpg';
import img_krok_8_jpg from './img/krok-8.jpg';
import img_krok_9_jpg from './img/krok-9.jpg';

const PROFIL = 'https://www.bosen.sk/makler/119-michal-lesko';
const BOSEN = 'https://www.bosen.sk';
const KV_KLUC = 'ponuka';
// Verzia uložených dát – 4 = názvy inzerátov majú preklad do EN, DE a UK
// Zvýšenie verzie vynúti okamžité načítanie ponuky pri najbližšej návšteve webu (bez čakania na ranný cron).
const VERZIA_DAT = 6;
// Preklady názvov uložené od tejto verzie sú platné a znova sa neprekladajú
const PREKLADY_OD_VERZIE = 5;
const STRANKY = { sk: page, en: pageEn, de: pageDe, uk: pageUk };

// Obrázky webu (fotky a certifikát), servírované priamo z Workera
const OBRAZKY = {
  '/img/hero.jpg': imgHero,
  '/img/portret.jpg': imgPortret,
  '/img/portret-michal.jpg': imgPortretMichal,
  '/img/ocenenie.jpg': imgOcenenie,
  '/img/podpis-svetly.png': imgPodpisSvetly,
  '/img/podpis-tmavy.png': imgPodpisTmavy,
  '/img/foto-predaj.jpg': imgFotoPredaj,
  '/img/foto-prenajom.jpg': imgFotoPrenajom,
  '/img/foto-omne.jpg': imgFotoOmne,
  '/img/foto-kontakt.jpg': imgFotoKontakt,
  '/img/bosen-logo-biele.png': imgLogoBiele,
  '/img/pozadie.jpg': img_pozadie_jpg,
  '/img/pozadie-motto.jpg': img_pozadie_motto_jpg,
  '/img/krok-1.jpg': img_krok_1_jpg,
  '/img/krok-2.jpg': img_krok_2_jpg,
  '/img/krok-3.jpg': img_krok_3_jpg,
  '/img/krok-4.jpg': img_krok_4_jpg,
  '/img/krok-5.jpg': img_krok_5_jpg,
  '/img/krok-6.jpg': img_krok_6_jpg,
  '/img/krok-7.jpg': img_krok_7_jpg,
  '/img/krok-8.jpg': img_krok_8_jpg,
  '/img/krok-9.jpg': img_krok_9_jpg,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Ocenenie nehnuteľností: /ocenenie/, /en/ocenenie/, /de/ocenenie/, /ua/ocenenie/ (stará /ocenenie-test/ presmeruje)
    if (jeOcenenie(url.pathname)) return ocenenieFetch(request, env, ctx, url);
    // Kontaktný formulár z hlavnej stránky
    if (url.pathname === '/api/kontakt' && request.method === 'POST') return kontaktFetch(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }
    if (OBRAZKY[url.pathname]) {
      return new Response(OBRAZKY[url.pathname], {
        headers: { 'content-type': url.pathname.endsWith('.png') ? 'image/png' : 'image/jpeg', 'cache-control': 'public, max-age=604800' },
      });
    }
    // Jazykové verzie: slovenská na „/“, anglická „/en/“, nemecká „/de/“, ukrajinská „/ua/“
    if (['/en', '/de', '/ua'].includes(url.pathname)) {
      return Response.redirect(url.origin + url.pathname + '/', 301);
    }
    const CESTY = { en: 'en', de: 'de', ua: 'uk' };
    const m = url.pathname.match(/^\/(en|de|ua)\/(index\.html)?$/);
    const lang = m ? CESTY[m[1]] : 'sk';
    if (lang === 'sk' && url.pathname !== '/' && url.pathname !== '/index.html') {
      return new Response('Stránka sa nenašla / Page not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
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
    const response = new Response(STRANKY[lang], { headers });
    // Staršie uložené dáta bez prekladov: obnov ich na pozadí (preloží názvy pre EN a DE)
    if (data && data.verzia !== VERZIA_DAT && ctx) ctx.waitUntil(obnovPonuku(env).catch((e) => console.error('Obnova zlyhala', e)));
    if (!data || !data.items || !data.items.length) return response;

    // Dve samostatné ponuky: pilier Predaj (svetlé karty) a pilier Prenájom (tmavé karty)
    const predaj = data.items.filter((i) => i.typ === 'predaj');
    const prenajom = data.items.filter((i) => i.typ === 'prenajom');
    const obsah = (list, tmave) => list.length
      ? '\n' + list.map((p, i) => karta(p, i, tmave, lang)).join('\n') + '\n'
      : prazdna(tmave, lang);

    return new HTMLRewriter()
      .on('div[data-ponuka="predaj"]', { element(el) { el.setInnerContent(obsah(predaj, false), { html: true }); } })
      .on('div[data-ponuka="prenajom"]', { element(el) { el.setInnerContent(obsah(prenajom, true), { html: true }); } })
      .transform(response);
  },

  async scheduled(event, env, ctx) {
    // každých 15 minút: polohy lokalít pre ocenenie; o 4:00 UTC: ponuka z bosen.sk
    if (event.cron === '*/15 * * * *') ctx.waitUntil(ocenenieCron(env).catch((e) => console.error('Geo cron', e)));
    else ctx.waitUntil(obnovPonuku(env));
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
  await prelozNazvy(env, items);
  const data = { aktualizovane: new Date().toISOString(), verzia: VERZIA_DAT, items };
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

// Karta nehnuteľnosti v dizajne webu: svetlá (pilier Predaj) alebo tmavá (pilier Prenájom)
function karta(p, i, tmave, lang = 'sk') {
  const t = TEXTY[lang] || TEXTY.sk;
  const nazov = (lang !== 'sk' && p.preklad && p.preklad[lang]) || p.nazov;
  const s = tmave
    ? { bg: '#1f1e1c', line: '#3b3833', muted: '#b9b2a6', price: '#d7b56d', badgeBg: '#d7b56d', badgeFg: '#141312', badge: t.prenajom, link: '' }
    : { bg: '#f7f5f0', line: '#ddd6c8', muted: '#5b5751', price: '#7a5c1f', badgeBg: '#141312', badgeFg: '#f7f5f0', badge: t.predaj, link: ' color: #141312;' };
  const fakty = p.features
    .filter((f) => /^[⌂▱▧]/.test(f))
    .map((f) => f.replace(/^[⌂▱▧]\s*/, '').replace(/^(.+)\s+pozemok$/, 'pozemok $1'))
    .map((f) => prelozFakt(f, lang))
    .join(' · ');
  const cena = prelozCenu(p.cena, lang);
  const no = String(i + 1).padStart(2, '0');
  const img = p.img
    ? `<img src="${esc(p.img)}" alt="${esc(nazov)}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block">`
    : '';
  return `<article style="background: ${s.bg}; border: 1px solid ${s.line}; display: flex; flex-direction: column">` +
    `<div style="position: relative; height: 236px; overflow: hidden">${img}` +
    `<span style="position: absolute; left: 14px; top: 14px; background: ${s.badgeBg}; color: ${s.badgeFg}; padding: 7px 10px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase">${s.badge}</span>` +
    `<span style="position: absolute; right: 14px; bottom: 12px; color: #ffffff; font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-shadow: 0 1px 6px rgba(0,0,0,0.6)">${no}</span></div>` +
    `<div style="padding: 20px 20px 22px; display: flex; flex-direction: column; gap: 10px; flex: 1">` +
    `<div style="display: flex; justify-content: space-between; gap: 12px; font-size: 14px; color: ${s.muted}"><span>${esc(p.adresa)}</span><strong style="color: ${s.price}; font-size: 15px; white-space: nowrap">${esc(cena)}</strong></div>` +
    `<h4 style="margin: 0; font-size: 21px; line-height: 1.2; letter-spacing: -0.03em; font-weight: 700">${esc(nazov)}</h4>` +
    `<div style="margin-top: auto; padding-top: 14px; border-top: 1px solid ${s.line}; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 14px; color: ${s.muted}"><span>${esc(fakty)}</span>` +
    `<a href="${esc(p.odkaz)}" target="_blank" rel="noopener" style="font-weight: 700; font-size: 15px;${s.link}">${t.detail} ↗</a></div></div></article>`;
}

function prazdna(tmave, lang = 'sk') {
  const t = TEXTY[lang] || TEXTY.sk;
  return `<p style="margin: 0; padding: 28px; border: 1px dashed ${tmave ? '#3b3833' : '#c9c1b2'}; font-size: 16px; color: ${tmave ? '#b9b2a6' : '#5b5751'}">` +
    `${t.prazdna} <a href="tel:+421944040684">+421 944 040 684</a>.</p>`;
}

// Texty kariet ponuky v jednotlivých jazykoch
const TEXTY = {
  sk: { predaj: 'V predaji', prenajom: 'Prenájom', detail: 'Detail', prazdna: 'Momentálne tu nemám žiadnu ponuku. Zavolajte mi na' },
  en: { predaj: 'For sale', prenajom: 'For rent', detail: 'Details', prazdna: 'There are no listings here at the moment. Call me on' },
  de: { predaj: 'Zu verkaufen', prenajom: 'Zu vermieten', detail: 'Details', prazdna: 'Derzeit gibt es hier keine Angebote. Rufen Sie mich an:' },
  uk: { predaj: 'У продажу', prenajom: 'Оренда', detail: 'Детальніше', prazdna: 'Наразі тут немає пропозицій. Зателефонуйте мені:' },
};

// Údaje z bosen.sk („2 izby“, „pozemok 1 246 m²“, „59,84 m²“) v jazyku stránky
function prelozFakt(f, lang) {
  if (lang === 'en') {
    return f
      .replace(/^(\d+(?:,5)?) (?:izby|izieb)$/, (m, n) => `${n.replace(',', '.')} rooms`)
      .replace(/^(\d+(?:,5)?) izba$/, (m, n) => `${n.replace(',', '.')} room`)
      .replace(/^pozemok (.+)$/, (m, v) => `plot ${v.replace(/(\d) (\d{3})/g, '$1,$2')}`)
      .replace(/^(\d+),(\d+) m²$/, '$1.$2 m²');
  }
  if (lang === 'uk') {
    return f
      .replace(/^(\d+(?:,5)?) izba$/, '$1 кімната')
      .replace(/^([234](?:,5)?) izby$/, '$1 кімнати')
      .replace(/^(\d+(?:,5)?) (?:izby|izieb)$/, '$1 кімнат')
      .replace(/^pozemok (.+)$/, 'ділянка $1')
      .replace(/ m²$/, ' м²');
  }
  if (lang === 'de') {
    return f
      .replace(/^(\d+(?:,5)?) (?:izby|izieb|izba)$/, '$1 Zimmer')
      .replace(/^pozemok (.+)$/, (m, v) => `Grundstück ${v.replace(/(\d) (\d{3})/g, '$1.$2')}`);
  }
  return f;
}

// Cena „429 000 €“ / „650 €/mes.“ v jazyku stránky
function prelozCenu(c, lang) {
  if (lang === 'sk') return c;
  if (lang === 'uk') return c.replace(/\/mes\.?$/, '/міс.');
  const mes = /\/mes\.?$/.test(c);
  const cislo = c.replace(/€.*$/, '').trim().replace(/\s/g, '');
  if (!/^\d+$/.test(cislo)) return c;
  if (lang === 'en') return `€${cislo.replace(/(\d)(?=(\d{3})+$)/g, '$1,')}${mes ? '/month' : ''}`;
  return `${cislo.replace(/(\d)(?=(\d{3})+$)/g, '$1.')} €${mes ? '/Monat' : ''}`;
}

// Názvy inzerátov z bosen.sk sú po slovensky – preložíme ich cez Workers AI do EN a DE.
// Už preložené názvy sa berú z uložených dát, takže sa prekladajú iba nové inzeráty.
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
async function prelozNazvy(env, items) {
  let stare = {};
  try {
    const predtym = await env.PONUKA.get(KV_KLUC, 'json');
    const platne = predtym && predtym.verzia >= PREKLADY_OD_VERZIE ? predtym.items : [];
    for (const it of platne || []) {
      if (it.preklad && it.preklad.en && it.preklad.de && it.preklad.uk) stare[it.nazov] = it.preklad;
    }
  } catch (e) { /* bez cache */ }
  for (const it of items) {
    if (stare[it.nazov]) { it.preklad = stare[it.nazov]; continue; }
    if (!env.AI) continue;
    try {
      it.preklad = await prelozNazov(env, it.nazov);
      stare[it.nazov] = it.preklad;
    } catch (e) {
      console.error('Preklad názvu zlyhal', it.nazov, e);
    }
  }
}

async function prelozNazov(env, nazov) {
  const res = await env.AI.run(AI_MODEL, {
    messages: [
      { role: 'system', content: 'You translate Slovak real-estate listing titles for a realtor website. ' +
        'Return ONLY a JSON object {"en": "...", "de": "...", "uk": "..."} with a natural, concise English, German and Ukrainian title. ' +
        'Translate all ordinary words (e.g. "čarovné miesto" -> "magical place" / "zauberhafter Ort"). ' +
        'Keep only proper names of streets, towns, districts, regions, parks and buildings in Slovak, but always in their basic nominative form ' +
        '(e.g. "pri Zámockom parku" -> "near Zámocký park" / "am Zámocký park", "na Záhorí" -> "in Záhorie", "v Senci" -> "in Senec"); ' +
        'in Ukrainian keep those proper names in Latin script too (e.g. "біля Zámocký park", "у Senec"). ' +
        'Keep all numbers and units (m², €); write thousands with a separator (1,246 m² in English, 1.246 m² in German, 1 246 м² in Ukrainian). ' +
        '"izb"/"izbový"/"izieb" means rooms (e.g. "5 izb dom" -> "5-room house" / "5-Zimmer-Haus" / "5-кімнатний будинок"). ' +
        'Glossary: "zariadený" = furnished / möbliert / мебльований; "rodinný dom" = family house / Einfamilienhaus / приватний будинок; ' +
        '"novostavba" = new build / Neubau / новобудова; "tehlový" = brick / Ziegel- / цегляний; "klimatizovaný" = air-conditioned / klimatisiert / з кондиціонером. ' +
        'Ukrainian must be grammatically correct (adjective agrees with noun, e.g. "3-кімнатна квартира з кондиціонером"). ' +
        'Do not add information that is not in the title. No quotes around the whole title, no explanations.' },
      { role: 'user', content: nazov },
    ],
    max_tokens: 300,
    temperature: 0.2,
  });
  const out = typeof res.response === 'string' ? res.response : JSON.stringify(res.response || '');
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI nevrátila JSON: ' + out.slice(0, 120));
  const j = JSON.parse(m[0]);
  const cisty = (s) => String(s || '').trim().replace(/^["„“]+|["“”]+$/g, '');
  if (!cisty(j.en) || !cisty(j.de) || !cisty(j.uk)) throw new Error('Neúplný preklad');
  return { en: cisty(j.en), de: cisty(j.de), uk: cisty(j.uk) };
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
