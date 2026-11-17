// Ocenenie nehnuteľností – skúšobná verzia na /ocenenie-test/
// Spája: porovnávaciu metódu nad inzerátmi z databázy BOREA (iba čítanie), štatistiku NBS,
// mapové dáta (OpenStreetMap), AI zdôvodnenie a AI posúdenie fotiek (Workers AI),
// korekciu ponukových cien na realizované (kalibrácia podľa reálnych predajov BOSEN),
// uloženie záujemcu a tlačovú správu pre presné ocenenie.
//
// Databázu BOREA (bosen-reality-db) tento kód iba ČÍTA – žiadny zápis, skript BOREA sa nemení.

import stranka from './ocenenie.html';

const ZAKLAD = '/ocenenie-test';
const UA = 'bosen-ocenenie/1.0 (+https://bosen.leskomichal33.workers.dev)';
// Prístup k zoznamu záujemcov: kľúč pozná iba Michal, v kóde je len jeho SHA-256 odtlačok.
const ADMIN_HASH = '4b35077be6a3c66f0b91e71298c9b5fa511083faf8866d91516c58d13dd1feeb';

// NBS – priemerná ponuková cena bývania podľa krajov (€/m², ročný priemer 2025)
// a celoslovenské hodnoty za 2. štvrťrok 2026 (bývanie 3 041, byty 3 430, domy 2 163 €/m²).
const NBS_KRAJ_2025 = {
  'Bratislavský kraj': 3598, 'Trnavský kraj': 1945, 'Trenčiansky kraj': 1720, 'Nitriansky kraj': 1501,
  'Žilinský kraj': 2049, 'Banskobystrický kraj': 1693, 'Prešovský kraj': 2129, 'Košický kraj': 2469,
};
const NBS_RAST_2026 = 1.08;          // posun ročného priemeru 2025 na úroveň 2026
const NBS_FAKTOR = { byt: 3430 / 3041, dom: 2163 / 3041 };
const NBS_OBDOBIE = 'NBS, kraje 2025 a SR 2. Q 2026';

// Ponukové ceny v inzerátoch sú vyššie ako realizované. Kým nebudú doplnené reálne predaje BOSEN,
// používa sa konzervatívna korekcia; po doplnení sa vypočíta z dvojíc „inzerovaná → predaná“ cena.
const KOREKCIA_REALIZACIA = 0.97;

const STAV = {
  novostavba: { k: 1.10, t: 'novostavba' },
  kompletna: { k: 1.06, t: 'po kompletnej rekonštrukcii' },
  ciastocna: { k: 1.00, t: 'čiastočná rekonštrukcia / dobrý stav' },
  povodny: { k: 0.90, t: 'pôvodný stav' },
  narekonstrukciu: { k: 0.80, t: 'na rekonštrukciu' },
};

// ---------------------------------------------------------------------------------------------
export async function ocenenieFetch(request, env, ctx, url) {
  const cesta = url.pathname.slice(ZAKLAD.length) || '/';
  try {
    if (cesta === '/' || cesta === '/index.html') {
      return new Response(stranka, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' } });
    }
    if (cesta === '/api/odhad' && request.method === 'POST') return json(await odhad(await request.json(), env));
    if (cesta === '/api/presne' && request.method === 'POST') return json(await presne(await request.json(), env));
    if (cesta.startsWith('/sprava/')) return await sprava(cesta.slice(8), url, env);
    if (cesta === '/admin') return await admin(url, env);
    if (cesta === '/api/stav') return json(await stavDat(env));
    if (cesta === '/api/diag' && (await jeAdmin(url))) return json(await diag(url.searchParams.get('q') || 'Malacky'));
    return new Response('Nenájdené', { status: 404 });
  } catch (e) {
    console.error('Ocenenie chyba', e);
    return json({ chyba: 'Ocenenie sa nepodarilo. Skúste to znova alebo zavolajte +421 944 040 684.' }, 500);
  }
}

// Cron: postupné zisťovanie polohy lokalít z inzerátov (OpenStreetMap, max. 1 dopyt za sekundu)
export async function ocenenieCron(env) {
  if (!env.BOREA_DB) return;
  const index = (await env.PONUKA.get('geo_index', 'json')) || {};
  const { results } = await env.BOREA_DB.prepare(
    "SELECT locality, COUNT(*) n FROM listings WHERE deal = 'Predaj' AND locality IS NOT NULL AND locality <> '' GROUP BY locality ORDER BY n DESC"
  ).all();
  const chyba = results.filter((r) => !(r.locality in index)).slice(0, 20);
  for (const r of chyba) {
    index[r.locality] = await geokoduj(r.locality);
    await new Promise((s) => setTimeout(s, 1100));
  }
  if (chyba.length) await env.PONUKA.put('geo_index', JSON.stringify(index));
  console.log(`Geo index: +${chyba.length}, spolu ${Object.keys(index).length}`);
}

// ---------------------------------------------------------------------------------------------
// Automatický odhad cez AI
async function odhad(vstup, env) {
  const v = over(vstup);
  if (v.chyba) return v;
  if (!vstup.kontakt || !vstup.suhlas) return { chyba: 'Vyplňte telefón alebo e-mail a súhlas so spracovaním údajov.' };

  const vysledok = await vypocitaj(v, env, vstup.fotky);
  const id = noveId();
  await env.PONUKA.put(`lead:${id}`, JSON.stringify({ id, druh: 'AI odhad', cas: new Date().toISOString(), meno: str(vstup.meno, 80), kontakt: str(vstup.kontakt, 120), vstup: v, vysledok: skratVysledok(vysledok) }), { expirationTtl: 60 * 60 * 24 * 365 });
  await upozorni(env, `🧮 Nový AI odhad\n${popisNehnutelnosti(v)}\n💶 ${vysledok.odhad ? eur(vysledok.od) + ' – ' + eur(vysledok.do) : 'bez odhadu'}\n👤 ${str(vstup.meno, 80) || '-'} · ${str(vstup.kontakt, 120)}`);
  return { id, ...vysledok };
}

// Presné ocenenie: AI + maklér – uloží podklady, pripraví správu na obhliadku
async function presne(vstup, env) {
  const v = over(vstup);
  if (v.chyba) return v;
  if (!vstup.kontakt || !vstup.suhlas) return { chyba: 'Vyplňte telefón alebo e-mail a súhlas so spracovaním údajov.' };
  const vysledok = await vypocitaj(v, env, vstup.fotky);
  const id = noveId();
  const pripad = {
    id, druh: 'Presné ocenenie', cas: new Date().toISOString(), meno: str(vstup.meno, 80), kontakt: str(vstup.kontakt, 120),
    kataster: str(vstup.kataster, 120), termin: str(vstup.termin, 200), poznamka: str(vstup.poznamka, 1000), vstup: v, vysledok,
  };
  await env.PONUKA.put(`lead:${id}`, JSON.stringify(pripad), { expirationTtl: 60 * 60 * 24 * 365 });
  await upozorni(env, `📋 Žiadosť o presné ocenenie\n${popisNehnutelnosti(v)}\n👤 ${pripad.meno || '-'} · ${pripad.kontakt}\n🗓️ ${pripad.termin || '-'}`);
  return { id, ok: true };
}

// ---------------------------------------------------------------------------------------------
function over(x) {
  const typ = ['byt', 'dom', 'pozemok'].includes(x.typ) ? x.typ : null;
  const vymera = num(x.vymera);
  const obec = str(x.obec, 80);
  if (!typ) return { chyba: 'Vyberte typ nehnuteľnosti.' };
  if (!obec) return { chyba: 'Vyplňte obec alebo mestskú časť.' };
  if (!vymera || vymera < 10 || vymera > 100000) return { chyba: 'Vyplňte výmeru v m².' };
  return {
    typ, obec, ulica: str(x.ulica, 120), vymera,
    izby: num(x.izby), stav: STAV[x.stav] ? x.stav : 'ciastocna', stavNeviem: x.stav === 'neviem',
    poschodie: str(x.poschodie, 20), vytah: !!x.vytah, konstrukcia: ['tehla', 'panel', 'zmiesana'].includes(x.konstrukcia) ? x.konstrukcia : '',
    balkon: !!x.balkon, terasa: !!x.terasa, pivnica: !!x.pivnica, parkovanie: !!x.parkovanie, garaz: !!x.garaz,
    pozemok: num(x.pozemok), rok: num(x.rok),
  };
}

async function vypocitaj(v, env, fotky) {
  const [poloha, porovnania, geoIndex] = await Promise.all([
    geokoduj([v.ulica, v.obec].filter(Boolean).join(', ')).catch(() => null),
    nacitajPorovnania(v, env).catch((e) => { console.error('D1', e); return []; }),
    env.PONUKA.get('geo_index', 'json').catch(() => null),
  ]);
  const [okolie, foto] = await Promise.all([
    poloha ? mapoveData(poloha).catch(() => null) : null,
    posudFotky(env, fotky).catch((e) => { console.error('Fotky', e); return null; }),
  ]);

  // AI posúdenie fotiek doplní stav, ak ho klient nezadal
  if (v.stavNeviem && foto && foto.stav && STAV[foto.stav]) v = { ...v, stav: foto.stav, stavZFotiek: true };

  const vyber = vyberPorovnatelne(v, porovnania, poloha, geoIndex || {});
  const kraj = poloha && poloha.kraj && NBS_KRAJ_2025[poloha.kraj] ? poloha.kraj : null;
  const nbsM2 = kraj && v.typ !== 'pozemok' ? Math.round(NBS_KRAJ_2025[kraj] * NBS_RAST_2026 * NBS_FAKTOR[v.typ]) : null;

  let zakladM2 = null; let zdroj = '';
  if (vyber.m2) {
    const w = vyber.pocet >= 4 ? 1 : 0.5 + vyber.pocet / 8;
    zakladM2 = nbsM2 && w < 1 ? vyber.m2 * w + nbsM2 * (1 - w) : vyber.m2;
    zdroj = w < 1 && nbsM2 ? 'porovnateľné inzeráty doplnené štatistikou NBS' : 'porovnateľné inzeráty v okolí';
    vyber.zakladM2 = Math.round(vyber.m2);
  } else if (nbsM2) {
    zakladM2 = nbsM2; zdroj = 'štatistika NBS pre kraj (málo porovnateľných inzerátov)';
  }
  if (!zakladM2) {
    return { odhad: false, sprava: 'Na automatický odhad zatiaľ nemáme dosť porovnateľných údajov. Presné ocenenie vám pripravím osobne.', okolie, foto, porovnania: [] };
  }

  const upravy = upravyCeny(v, okolie);
  const k = upravy.reduce((a, u) => a * u.k, 1) * KOREKCIA_REALIZACIA;
  const m2 = Math.round(zakladM2 * k / 10) * 10;
  const stred = m2 * v.vymera;
  let pol = vyber.rozptyl != null ? Math.min(0.12, Math.max(0.04, vyber.rozptyl)) : 0.12;
  if (vyber.pocet < 5) pol += 0.04;
  if (!vyber.m2) pol = 0.15;
  const od = zaokruhli(stred * (1 - pol));
  const doo = zaokruhli(stred * (1 + pol));
  const istota = !vyber.m2 ? 'nízka' : vyber.pocet >= 8 && pol <= 0.08 ? 'vysoká' : vyber.pocet >= 5 ? 'stredná' : 'nízka';

  const vysledok = {
    odhad: true, od, do: doo, stred: zaokruhli(stred), m2, istota, zdroj,
    pocet: vyber.pocet, polomer: vyber.polomer, kraj, nbsM2, zakladM2: vyber.zakladM2 || null,
    upravy: upravy.filter((u) => u.k !== 1).map((u) => ({ t: u.t, p: Math.round((u.k - 1) * 100) })),
    korekcia: Math.round((KOREKCIA_REALIZACIA - 1) * 100),
    porovnania: vyber.zoznam.slice(0, 6), okolie, foto, stavZFotiek: !!v.stavZFotiek,
  };
  vysledok.text = await aiText(env, v, vysledok).catch((e) => { console.error('AI text', e); return null; });
  return vysledok;
}

// Porovnateľné inzeráty z databázy BOREA (posledných 120 dní, iba predaj)
async function nacitajPorovnania(v, env) {
  if (!env.BOREA_DB) return [];
  const typSql = v.typ === 'byt'
    ? "(prop_type LIKE '%byt%' OR prop_type LIKE 'Gars%' OR prop_type LIKE 'Dvojgars%' OR prop_type IN ('Mezonet','Loft','Apartmán'))"
    : v.typ === 'dom' ? "(prop_type IN ('Rodinný dom','Dom','Vila') OR prop_type LIKE '%dom%')" : "(prop_type LIKE 'Pozemok%')";
  const { results } = await env.BOREA_DB.prepare(
    `SELECT title, price, area_m2, locality, prop_type, portal, url, first_seen FROM listings
     WHERE deal = 'Predaj' AND price > 0 AND area_m2 > 0 AND ${typSql}
       AND first_seen >= datetime('now', '-120 days') LIMIT 5000`
  ).all();
  return results;
}

function izbyZo(r) {
  const t = `${r.prop_type || ''} ${r.title || ''}`;
  if (/dvojgars/i.test(t)) return 1.5;
  if (/gars[oó]n/i.test(t)) return 1;
  const m = t.match(/(\d)\s*[-‑]?\s*(?:izb|i\b)/i);
  return m ? Number(m[1]) : null;
}

function vyberPorovnatelne(v, riadky, poloha, geo) {
  const hr = v.typ === 'byt' ? [500, 15000] : v.typ === 'dom' ? [300, 10000] : [2, 2000];
  const videne = new Set();
  let kand = [];
  for (const r of riadky) {
    const m2 = r.price / r.area_m2;
    if (m2 < hr[0] || m2 > hr[1]) continue;
    if (v.typ === 'dom' && (r.area_m2 > 450 || /pozem\w*\s*\d{3,}/i.test(r.title || '') && r.area_m2 > 300)) continue; // pri domoch je občas uvedená výmera pozemku
    const ratio = r.area_m2 / v.vymera;
    if (ratio < 0.55 || ratio > 1.8) continue;
    const izby = v.typ === 'byt' ? izbyZo(r) : null;
    if (v.typ === 'byt' && v.izby && izby && Math.abs(izby - v.izby) > 1) continue;
    // rovnaký inzerát z viacerých zdrojov (BOREA aj Octopus, inzerát na dvoch portáloch)
    const kluce = [r.url, `${Math.round(r.price / 1000)}|${Math.round(r.area_m2)}`, (r.title || '').toLowerCase().replace(/\W+/g, '').slice(0, 40) + '|' + Math.round(r.price / 1000)];
    if (kluce.some((k) => videne.has(k))) continue;
    kluce.forEach((k) => videne.add(k));
    const g = geo[r.locality];
    const lok = (r.locality || '').toLowerCase();
    let d = poloha && g ? vzdialenost(poloha.lat, poloha.lon, g.lat, g.lon) : null;
    if (d == null && poloha && lok && lok === v.obec.toLowerCase()) d = 0.5;   // rovnaká obec / mestská časť
    kand.push({ ...r, m2, izby, d });
  }

  let polomer = null;
  let vyber = [];
  if (poloha) {
    for (const km of [2, 4, 8, 15, 25]) {
      vyber = kand.filter((c) => c.d != null && c.d <= km);
      polomer = km;
      if (vyber.length >= 6) break;
    }
  }
  if (vyber.length < 3) {
    // záloha bez polohy: rovnaká lokalita, potom rovnaké mesto (napr. Bratislava-*)
    const obec = v.obec.toLowerCase();
    const mesto = obec.split(/[-–,]/)[0].trim();
    let podla = kand.filter((c) => (c.locality || '').toLowerCase() === obec);
    if (podla.length < 5) podla = kand.filter((c) => (c.locality || '').toLowerCase().split(/[-–,]/)[0].trim() === mesto);
    if (podla.length >= vyber.length) { vyber = podla; polomer = null; }
  }
  if (!vyber.length) return { m2: null, pocet: 0, zoznam: [], polomer: null, rozptyl: null };

  // váhy: vzdialenosť, podobnosť výmery, rovnaký počet izieb
  for (const c of vyber) {
    const wd = c.d != null ? 1 / (1 + c.d / 2) : 0.6;
    const wa = Math.max(0.2, 1 - Math.abs(Math.log(c.area_m2 / v.vymera)));
    const wi = v.typ === 'byt' && v.izby && c.izby ? (c.izby === v.izby ? 1 : 0.7) : 0.85;
    c.w = wd * wa * wi;
  }
  // odstránenie extrémov (IQR) a obmedzenie na 15 najvhodnejších
  const ceny = vyber.map((c) => c.m2).sort((a, b) => a - b);
  const q1 = kvantil(ceny, 0.25); const q3 = kvantil(ceny, 0.75); const iqr = q3 - q1;
  if (vyber.length >= 6) vyber = vyber.filter((c) => c.m2 >= q1 - 1.5 * iqr && c.m2 <= q3 + 1.5 * iqr);
  vyber.sort((a, b) => b.w - a.w);
  vyber = vyber.slice(0, 15);

  const m2 = vazenyMedian(vyber.map((c) => [c.m2, c.w]));
  const s = vyber.map((c) => c.m2).sort((a, b) => a - b);
  const rozptyl = s.length >= 4 ? (kvantil(s, 0.75) - kvantil(s, 0.25)) / (2 * m2) : null;
  return {
    m2, pocet: vyber.length, polomer, rozptyl,
    zoznam: vyber.map((c) => ({
      lokalita: c.locality, typ: c.prop_type, vymera: Math.round(c.area_m2), cena: Math.round(c.price),
      m2: Math.round(c.m2), km: c.d != null ? Math.round(c.d * 10) / 10 : null, portal: c.portal || 'nehnutelnosti.sk', url: c.url,
    })),
  };
}

function upravyCeny(v, okolie) {
  const u = [{ t: `stav: ${STAV[v.stav].t}${v.stavZFotiek ? ' (podľa fotiek)' : ''}`, k: STAV[v.stav].k }];
  if (v.typ === 'byt') {
    const p = v.poschodie.toLowerCase();
    const cislo = parseInt(p, 10);
    if (p === 'prizemie' || cislo === 0) u.push({ t: 'prízemie', k: 0.96 });
    else if (!v.vytah && cislo >= 4) u.push({ t: 'vyššie poschodie bez výťahu', k: 0.95 });
    if (v.konstrukcia === 'tehla') u.push({ t: 'tehlová stavba', k: 1.03 });
    if (v.konstrukcia === 'panel') u.push({ t: 'panelová stavba', k: 0.97 });
    if (v.terasa) u.push({ t: 'terasa', k: 1.05 });
    else if (v.balkon) u.push({ t: 'balkón / loggia', k: 1.03 });
    if (v.pivnica) u.push({ t: 'pivnica', k: 1.01 });
    if (v.garaz) u.push({ t: 'garáž / garážové státie', k: 1.05 });
    else if (v.parkovanie) u.push({ t: 'vyhradené parkovanie', k: 1.02 });
  }
  if (v.typ === 'dom') {
    if (v.pozemok > 1000) u.push({ t: 'veľký pozemok', k: 1.04 });
    else if (v.pozemok && v.pozemok < 350) u.push({ t: 'menší pozemok', k: 0.96 });
    if (v.garaz) u.push({ t: 'garáž', k: 1.03 });
  }
  if (okolie && v.typ !== 'pozemok') {
    if (okolie.zastavka != null && okolie.zastavka <= 300 && okolie.obchody >= 2) u.push({ t: 'dobrá občianska vybavenosť v okolí', k: 1.02 });
    else if ((okolie.zastavka == null || okolie.zastavka > 1000) && okolie.obchody === 0) u.push({ t: 'slabšia vybavenosť v okolí', k: 0.98 });
  }
  return u;
}

// ---------------------------------------------------------------------------------------------
// Mapové dáta – OpenStreetMap (Nominatim + Overpass)
async function geokoduj(q) {
  const p = await photon(q).catch(() => null);
  if (p && p.kraj) return p;
  const n = await nominatim(q).catch(() => null);
  if (n && !n.kraj && p) n.kraj = p.kraj;
  return n || p;
}

async function nominatim(q) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=sk&accept-language=sk&q=${encodeURIComponent(q)}`, {
    headers: { 'user-agent': UA, referer: 'https://bosen.leskomichal33.workers.dev/' }, cf: { cacheTtl: 86400 * 30 },
  });
  if (!res.ok) return null;
  const j = await res.json();
  if (!j[0]) return null;
  const a = j[0].address || {};
  return { lat: Number(j[0].lat), lon: Number(j[0].lon), kraj: normKraj(a.state), okres: a.county || null };
}

async function photon(q) {
  const res = await fetch(`https://photon.komoot.io/api/?limit=1&lang=default&q=${encodeURIComponent(q + ', Slovensko')}&bbox=16.8,47.7,22.6,49.7`, {
    headers: { 'user-agent': UA }, cf: { cacheTtl: 86400 * 30 },
  });
  if (!res.ok) return null;
  const j = await res.json();
  const f = j.features && j.features[0];
  if (!f || (f.properties.countrycode && f.properties.countrycode !== 'SK')) return null;
  const [lon, lat] = f.geometry.coordinates;
  return { lat, lon, kraj: normKraj(f.properties.state), okres: f.properties.county || null };
}

// „Bratislavský kraj“, „Bratislava Region“, „Region of Bratislava“… → názov kraja ako v tabuľke NBS
function normKraj(s) {
  if (!s) return null;
  const t = s.toLowerCase();
  const mapa = [['bratislav', 'Bratislavský kraj'], ['trnav', 'Trnavský kraj'], ['tren', 'Trenčiansky kraj'], ['nitr', 'Nitriansky kraj'],
    ['žilin', 'Žilinský kraj'], ['zilin', 'Žilinský kraj'], ['bansk', 'Banskobystrický kraj'], ['prešov', 'Prešovský kraj'], ['presov', 'Prešovský kraj'], ['košic', 'Košický kraj'], ['kosic', 'Košický kraj']];
  const m = mapa.find(([k]) => t.includes(k));
  return m ? m[1] : s;
}

async function diag(q) {
  const out = {};
  for (const [n, u, o] of [
    ['nominatim', `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=sk&q=${encodeURIComponent(q)}`, { headers: { 'user-agent': UA, referer: 'https://bosen.leskomichal33.workers.dev/' } }],
    ['photon', `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q + ', Slovensko')}`, { headers: { 'user-agent': UA } }],
    ['overpass_kumi', 'https://overpass.kumi.systems/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent('[out:json];node(48.43,17.01,48.44,17.02)[highway=bus_stop];out 1;'), headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' } }],
    ['overpass_coffee', 'https://overpass.private.coffee/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent('[out:json];node(48.43,17.01,48.44,17.02)[highway=bus_stop];out 1;'), headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' } }],
    ['overpass', 'https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent('[out:json];node(48.43,17.01,48.44,17.02)[highway=bus_stop];out 1;'), headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' } }],
  ]) {
    try { const r = await fetch(u, { ...o, signal: AbortSignal.timeout(8000) }); out[n] = { status: r.status, body: (await r.text()).slice(0, 300) }; } catch (e) { out[n] = { chyba: String(e) }; }
  }
  out.geokoduj = await geokoduj(q).catch((e) => String(e));
  return out;
}

async function mapoveData(p) {
  const q = `[out:json][timeout:8];(
    node(around:1000,${p.lat},${p.lon})[shop~"supermarket|convenience|bakery"];
    node(around:1000,${p.lat},${p.lon})[highway=bus_stop];
    node(around:1000,${p.lat},${p.lon})[railway~"tram_stop|station|halt"];
    nwr(around:1500,${p.lat},${p.lon})[amenity~"school|kindergarten"];
    nwr(around:1000,${p.lat},${p.lon})[leisure=park];
  );out center 400;`;
  const servery = ['https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter'];
  const data = await Promise.any(servery.map(async (s) => {
    const res = await fetch(s, {
      method: 'POST', body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) throw new Error('Overpass ' + res.status);
    return res.json();
  })).catch(() => null);
  if (!data) return null;
  const { elements = [] } = data;
  const najblizsie = (f) => {
    const d = elements.filter(f).map((e) => vzdialenost(p.lat, p.lon, e.lat ?? e.center?.lat, e.lon ?? e.center?.lon) * 1000);
    return d.length ? Math.round(Math.min(...d) / 10) * 10 : null;
  };
  const tg = (e) => e.tags || {};
  return {
    obchody: elements.filter((e) => /supermarket|convenience|bakery/.test(tg(e).shop || '')).length,
    zastavka: najblizsie((e) => tg(e).highway === 'bus_stop' || /tram_stop|station|halt/.test(tg(e).railway || '')),
    skola: najblizsie((e) => tg(e).amenity === 'school'),
    skolka: najblizsie((e) => tg(e).amenity === 'kindergarten'),
    park: najblizsie((e) => tg(e).leisure === 'park'),
  };
}

// ---------------------------------------------------------------------------------------------
// Workers AI
async function aiText(env, v, r) {
  if (!env.AI) return null;
  const fakty = {
    nehnutelnost: popisNehnutelnosti(v), odhad: `${eur(r.od)} – ${eur(r.do)}`, cena_m2: `${r.m2} €/m²`,
    zdroj: r.zdroj, pocet_porovnani: r.pocet, polomer_km: r.polomer, ponukova_cena_porovnani_m2: r.zakladM2,
    upravy: r.upravy.map((u) => `${u.t} ${u.p > 0 ? '+' : ''}${u.p} %`), korekcia_na_realizovane_ceny: `${r.korekcia} %`,
    okolie: r.okolie, fotky: r.foto && r.foto.poznamka,
  };
  const spravy = [
      { role: 'system', content: 'Si skúsený realitný maklér Michal Leško (BOSEN Group) a vysvetľuješ majiteľovi orientačný odhad ceny. ' +
        'Píš gramaticky správnou, prirodzenou spisovnou slovenčinou v 1. osobe (napr. „porovnal som“), činným rodom, bez trpného rodu typu „cena je zvyšovaná“. ' +
        'Napíš presne 3 krátke vety: 1) z koľkých a akých porovnaní odhad vychádza, 2) čo cenu zvyšuje alebo znižuje (vlastnosti nehnuteľnosti a okolie), 3) čo upresní obhliadka. ' +
        'Používaj IBA čísla a fakty z poskytnutých údajov, nič si nevymýšľaj, neopakuj celé cenové rozpätie a nespomínaj korekciu na realizované ceny. Bez oslovenia, podpisu a upozornení. ' +
        'Pozor na pády a zhodu (napr. „kompletná rekonštrukcia“, „po kompletnej rekonštrukcii“). ' +
        'Vzor štruktúry (hranaté zátvorky nahraď údajmi, vlastnosti ber IBA zo zoznamu „upravy“ a „okolie“): „Porovnal som [počet] podobných [bytov/domov/pozemkov] v okolí do [km] km, ktoré sa dnes ponúkajú za približne [cena] €/m². Cenu zvyšuje [kladné úpravy] a znižuje ju [záporné úpravy]. Presnú cenu upresním po obhliadke, keď uvidím [čo je dôležité pre tento typ].“ ' +
        'Ak niektorá skupina úprav chýba, danú časť vety vynechaj.' },
      { role: 'user', content: JSON.stringify(fakty) },
  ];
  // Gemma lepšie zvláda slovenčinu; Llama ako záloha
  for (const model of ['@cf/google/gemma-3-12b-it', '@cf/meta/llama-3.3-70b-instruct-fp8-fast']) {
    try {
      const res = await env.AI.run(model, { messages: spravy, max_tokens: 260, temperature: 0.2 });
      const t = typeof res.response === 'string' ? res.response.trim().replace(/^["„]|["“]$/g, '') : '';
      if (t) return t;
    } catch (e) { console.error('AI model', model, e); }
  }
  return null;
}

async function posudFotky(env, fotky) {
  if (!env.AI || !Array.isArray(fotky) || !fotky.length) return null;
  const model = '@cf/meta/llama-3.2-11b-vision-instruct';
  const vysledky = [];
  for (const f of fotky.slice(0, 3)) {
    const b64 = String(f).replace(/^data:image\/\w+;base64,/, '');
    if (b64.length > 900000) continue;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const vstup = {
      messages: [{ role: 'user', content: 'You are a real estate appraiser. Assess the condition of this interior or building photo. ' +
        'Answer ONLY with JSON {"stav": one of "novostavba","kompletna","ciastocna","povodny","narekonstrukciu", "poznamka": "one short sentence in Slovak about the condition"}.' }],
      image: Array.from(bytes), max_tokens: 160,
    };
    let res;
    try {
      res = await env.AI.run(model, vstup);
    } catch (e) {
      if (/agree/i.test(String(e))) { await env.AI.run(model, { prompt: 'agree' }); res = await env.AI.run(model, vstup); } else throw e;
    }
    const m = String(res.response || '').match(/\{[\s\S]*\}/);
    if (m) { try { vysledky.push(JSON.parse(m[0])); } catch (e) { /* preskoč */ } }
  }
  if (!vysledky.length) return null;
  const pocty = {};
  for (const x of vysledky) if (STAV[x.stav]) pocty[x.stav] = (pocty[x.stav] || 0) + 1;
  const stav = Object.keys(pocty).sort((a, b) => pocty[b] - pocty[a])[0] || null;
  return { stav, stavText: stav ? STAV[stav].t : null, poznamka: vysledky.map((x) => x.poznamka).filter(Boolean).join(' ') };
}

// ---------------------------------------------------------------------------------------------
// Upozornenie Michalovi (Telegram) – zapne sa, keď Worker dostane TELEGRAM_TOKEN a TELEGRAM_CHAT
async function upozorni(env, text) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT, text, disable_web_page_preview: true }),
    });
  } catch (e) { console.error('Telegram', e); }
}

async function jeAdmin(url) {
  const k = url.searchParams.get('k') || '';
  if (!k) return false;
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('') === ADMIN_HASH;
}

async function admin(url, env) {
  if (!(await jeAdmin(url))) return new Response('Prístup zamietnutý', { status: 403 });
  const { keys } = await env.PONUKA.list({ prefix: 'lead:' });
  const zaznamy = (await Promise.all(keys.map((k) => env.PONUKA.get(k.name, 'json')))).filter(Boolean).sort((a, b) => b.cas.localeCompare(a.cas));
  const k = encodeURIComponent(url.searchParams.get('k'));
  const riadky = zaznamy.map((z) => `<tr><td>${esc(new Date(z.cas).toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava' }))}</td><td>${esc(z.druh)}</td><td>${esc(z.meno || '')}<br>${esc(z.kontakt)}</td><td>${esc(popisNehnutelnosti(z.vstup))}</td><td>${z.vysledok && z.vysledok.odhad ? esc(eur(z.vysledok.od) + ' – ' + eur(z.vysledok.do)) : '–'}</td><td><a href="${ZAKLAD}/sprava/${z.id}?k=${k}">Správa →</a></td></tr>`).join('');
  return html(`<h1>Záujemcovia o ocenenie</h1><p>${zaznamy.length} záznamov</p><table><tr><th>Čas</th><th>Druh</th><th>Kontakt</th><th>Nehnuteľnosť</th><th>Odhad</th><th></th></tr>${riadky}</table>`);
}

// Tlačová správa (PDF cez „Tlačiť → Uložiť ako PDF“) – podklad na písomné ocenenie
async function sprava(id, url, env) {
  if (!(await jeAdmin(url))) return new Response('Prístup zamietnutý', { status: 403 });
  const z = await env.PONUKA.get(`lead:${id.replace(/[^\w-]/g, '')}`, 'json');
  if (!z) return new Response('Nenájdené', { status: 404 });
  const r = z.vysledok || {};
  const por = (r.porovnania || []).map((c) => `<tr><td>${esc(c.lokalita)}</td><td>${esc(c.typ || '')}</td><td>${c.vymera} m²</td><td>${eur(c.cena)}</td><td>${c.m2} €/m²</td><td>${c.km != null ? c.km + ' km' : ''}</td><td><a href="${esc(c.url)}">${esc(c.portal)}</a></td></tr>`).join('');
  const ok = r.okolie ? `Obchody do 1 km: ${r.okolie.obchody}; zastávka: ${m(r.okolie.zastavka)}; škola: ${m(r.okolie.skola)}; škôlka: ${m(r.okolie.skolka)}; park: ${m(r.okolie.park)}` : 'nezistené';
  return html(`
    <p class="k">BOSEN Group · Michal Leško · realitný maklér</p>
    <h1>Podklad na ocenenie nehnuteľnosti</h1>
    <p>${esc(z.druh)} · ${esc(new Date(z.cas).toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava' }))} · ${esc(z.meno || '')} · ${esc(z.kontakt)}</p>
    <h2>Nehnuteľnosť</h2><p>${esc(popisNehnutelnosti(z.vstup))}${z.vstup.ulica ? ', ' + esc(z.vstup.ulica) : ''}</p>
    ${z.kataster ? `<p>Kataster (LV / parcela): ${esc(z.kataster)} – overiť na <a href="https://kataster.skgeodesy.sk/">katasterportal</a> (vlastníci, ťarchy, výmery)</p>` : '<p>Kataster: doplniť číslo LV a overiť ťarchy na katasterportáli.</p>'}
    ${z.termin ? `<p>Preferovaný termín obhliadky: ${esc(z.termin)}</p>` : ''}${z.poznamka ? `<p>Poznámka klienta: ${esc(z.poznamka)}</p>` : ''}
    <h2>Automatický odhad (AI)</h2>
    ${r.odhad ? `<p class="big">${eur(r.od)} – ${eur(r.do)}</p><p>${r.m2} €/m² · istota: ${esc(r.istota)} · ${esc(r.zdroj)} · ${r.pocet} porovnaní${r.polomer ? ' do ' + r.polomer + ' km' : ''}${r.nbsM2 ? ` · NBS ${esc(r.kraj)}: ${r.nbsM2} €/m²` : ''}</p>` : '<p>Bez automatického odhadu.</p>'}
    ${r.text ? `<p>${esc(r.text)}</p>` : ''}
    ${(r.upravy || []).length ? `<p>Úpravy: ${r.upravy.map((u) => esc(u.t) + ' ' + (u.p > 0 ? '+' : '') + u.p + ' %').join(' · ')} · korekcia na realizované ceny ${r.korekcia} %</p>` : ''}
    ${r.foto ? `<p>AI posúdenie fotiek: ${esc(r.foto.stavText || '')} – ${esc(r.foto.poznamka || '')}</p>` : ''}
    <h2>Okolie (OpenStreetMap)</h2><p>${ok}</p>
    <h2>Porovnateľné nehnuteľnosti</h2><table><tr><th>Lokalita</th><th>Typ</th><th>Výmera</th><th>Cena</th><th>€/m²</th><th>Vzd.</th><th>Zdroj</th></tr>${por}</table>
    <h2>Na obhliadke doplniť</h2><ul><li>skutočný stav, dispozícia, orientácia, výhľad, hluk</li><li>reálne predaje BOSEN v lokalite (realizované ceny)</li><li>údaje z listu vlastníctva a ťarchy</li><li>odporúčaná cena a stratégia predaja → písomné ocenenie (Claude)</li></ul>
    <p class="note">Orientačný odhad z ponukových cien, nie znalecký posudok.</p>
    <script>if(location.search.includes('print'))print()</script>`);
}

async function stavDat(env) {
  const geo = (await env.PONUKA.get('geo_index', 'json')) || {};
  let n = null;
  try { n = (await env.BOREA_DB.prepare("SELECT COUNT(*) n FROM listings WHERE deal='Predaj' AND price>0 AND area_m2>0").first()).n; } catch (e) { /* bez D1 */ }
  return { inzeratyPredaj: n, lokalitSPolohou: Object.values(geo).filter(Boolean).length, lokalit: Object.keys(geo).length };
}

// ---------------------------------------------------------------------------------------------
function popisNehnutelnosti(v) {
  if (!v) return '';
  const t = v.typ === 'byt' ? `${v.izby ? v.izby + '-izbový ' : ''}byt` : v.typ === 'dom' ? 'rodinný dom' : 'pozemok';
  return `${t}, ${v.vymera} m², ${v.obec}${v.typ !== 'pozemok' ? ', ' + STAV[v.stav].t : ''}`;
}
function skratVysledok(r) { const { text, porovnania, ...rest } = r; return { ...rest, porovnania: (porovnania || []).slice(0, 6), text }; }
function vazenyMedian(pary) {
  const s = pary.slice().sort((a, b) => a[0] - b[0]);
  const spolu = s.reduce((a, p) => a + p[1], 0);
  let acc = 0;
  for (const [x, w] of s) { acc += w; if (acc >= spolu / 2) return x; }
  return s[s.length - 1][0];
}
function kvantil(s, q) { const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); }
function vzdialenost(a, b, c, d) {
  if ([a, b, c, d].some((x) => x == null || Number.isNaN(x))) return null;
  const r = Math.PI / 180;
  const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}
function zaokruhli(x) { return Math.round(x / 1000) * 1000; }
function eur(x) { return x == null ? '' : Math.round(x).toLocaleString('sk-SK').replace(/ |,/g, ' ') + ' €'; }
function m(x) { return x == null ? 'nezistené' : x >= 1000 ? (x / 1000).toFixed(1).replace('.', ',') + ' km' : x + ' m'; }
function num(x) { const n = Number(String(x ?? '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; }
function str(x, max) { return String(x ?? '').trim().slice(0, max); }
function noveId() { return new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + crypto.randomUUID().slice(0, 8); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function json(o, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function html(body) {
  return new Response(`<!DOCTYPE html><html lang="sk"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Ocenenie – Michal Leško</title>
<style>body{font-family:Manrope,system-ui,sans-serif;max-width:960px;margin:40px auto;padding:0 24px;color:#141312;line-height:1.55}h1{font-size:30px;letter-spacing:-.03em;margin:.2em 0}h2{font-size:18px;margin-top:28px;border-bottom:1px solid #ddd6c8;padding-bottom:6px}
.k{font-family:monospace;letter-spacing:.12em;text-transform:uppercase;color:#7a5c1f;font-size:12px}.big{font-size:28px;font-weight:800}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid #ddd6c8;padding:7px 8px;text-align:left;vertical-align:top}.note{color:#8f887c;font-size:13px;margin-top:30px}a{color:#7a5c1f}</style></head><body>${body}</body></html>`,
  { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' } });
}
