
import { Actor, log } from 'apify';
import { CheerioCrawler, Dataset, RequestQueue } from 'crawlee';
import * as cheerio from 'cheerio';
import { EMAIL_RE, PHONE_RE, normalizePhone, dedupeBy, toTitleCase } from './adapters/util.js';
import { realtorSeeds, parseRealtorList } from './adapters/realtor.js';
import { homesSeeds, parseHomesList } from './adapters/homes.js';
import { coldwellSeeds, parseColdwell } from './adapters/coldwellbanker.js';
import { compassSeeds, parseCompass } from './adapters/compass.js';

const SOURCE_MAP = {
  realtor: { seeds: realtorSeeds, parse: parseRealtorList },
  homes: { seeds: homesSeeds, parse: parseHomesList },
  coldwellbanker: { seeds: coldwellSeeds, parse: parseColdwell },
  compass: { seeds: compassSeeds, parse: parseCompass },
};

await Actor.main(async () => {
  const input = await Actor.getInput();
  const {
    phase = 'discover',
    city = 'Jacksonville, FL',
    limitPerSource = 250,
    sources = ['realtor', 'homes', 'coldwellbanker', 'compass'],
    namesCsvUrl,
    maxPagesPerName = 6,
    proxyGroups = [],
    brevoExport = true,
    brevoFileName = 'PHASE2_BREVO.csv',
  } = input || {};

  log.info(`Phase: ${phase}`);
  const proxyConfiguration = proxyGroups?.length
    ? await Actor.createProxyConfiguration({ groups: proxyGroups })
    : undefined;

  if (phase === 'discover') {
    const q = await RequestQueue.open();
    for (const src of sources) {
      const mod = SOURCE_MAP[src];
      if (!mod) continue;
      for await (const req of mod.seeds(limitPerSource)) {
        await q.addRequest(req);
      }
    }

    const crawler = new CheerioCrawler({
      requestQueue: q,
      maxConcurrency: 3,
      requestHandlerTimeoutSecs: 60,
      ...(proxyConfiguration ? { proxyConfiguration } : {}),
      async requestHandler({ request, body }) {
        // Use cheerio directly on body for speed/reliability
        const $ = cheerio.load(body || '');
        let rows = [];
        if (request.label === 'REALTOR_LIST') rows = SOURCE_MAP.realtor.parse($);
        if (request.label === 'HOMES_LIST') rows = SOURCE_MAP.homes.parse($);
        if (request.label === 'COLDWELL_LIST') rows = SOURCE_MAP.coldwellbanker.parse($);
        if (request.label === 'COMPASS_LIST') rows = SOURCE_MAP.compass.parse($);
        for (const r of rows) await Dataset.pushData({ name: r.name, city, source: r.source });
        log.info(`Parsed ${rows.length} agents from ${request.url}`);
      },
      failedRequestHandler({ request }) {
        log.warning(`Failed to fetch: ${request.url}`);
      }
    });

    await crawler.run();
    const items = await Dataset.getData();
    const unique = dedupeBy(items.items, (x) => x.name?.toLowerCase());
    await Actor.setValue('PHASE1_NAMES.json', unique, { contentType: 'application/json' });
    await Actor.setValue('PHASE1_NAMES.csv', toCsv(unique, ['name', 'city', 'source']), { contentType: 'text/csv' });
    log.info(`Phase 1 done. Names: ${unique.length}.`);
    return;
  }

  if (phase === 'enrich') {
    let names = [];
    if (namesCsvUrl) {
      const { body } = await Actor.utils.requestAsBrowser({ url: namesCsvUrl });
      names = parseNamesCsv(body);
      log.info(`Loaded ${names.length} names from provided CSV URL.`);
    } else {
      const stored = await Actor.getValue('PHASE1_NAMES.json');
      if (stored?.length) {
        names = stored;
        log.info(`Loaded ${names.length} names from PHASE1_NAMES.json`);
      } else {
        const data = await Dataset.getData();
        names = dedupeBy(data.items, (x) => x.name?.toLowerCase());
        log.info(`Loaded ${names.length} names from default dataset.`);
      }
    }

    const enrichQueue = await RequestQueue.open('ENRICH_Q');

    for (const rec of names) {
      const person = rec.name || rec;
      const queries = buildQueries(person, city);
      for (const q of queries) {
        await enrichQueue.addRequest({ url: q, label: 'SEARCH', userData: { person } });
      }
    }

    const cheerioCrawler = new CheerioCrawler({
      requestQueue: enrichQueue,
      maxConcurrency: 5,
      ...(proxyConfiguration ? { proxyConfiguration } : {}),
      async requestHandler({ request, $ , enqueueLinks, body }) {
        // Ensure $ exists even if auto-parsing failed
        const _$ = $ || cheerio.load(body || '');
        const pageText = _$('#root').text() + ' ' + _$('#__next').text() + ' ' + _$('.content').text() + ' ' + _$('.main').text() + ' ' + _$('body').text();
        const emails = [...new Set((pageText.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))];
        const phones = [...new Set((pageText.match(PHONE_RE) || []).map((m) => normalizePhone(m)))].filter(Boolean);

        const { person } = request.userData;
        if (emails.length || phones.length) {
          await Dataset.pushData({
            name: toTitleCase(person),
            email: emails[0] || null,
            phone: phones[0] || null,
            sourceUrl: request.url,
          });
        }

        if (isSearchUrl(request.url)) {
          const hrefs = [];
          _$('a').each((_, a) => {
            const href = _$(a).attr('href');
            if (!href) return;
            const u = absolutize(request.url, href);
            if (!u) return;
            if (isNoise(u)) return;
            hrefs.push(u);
          });
          for (const u of hrefs.slice(0, 5)) {
            await enqueueLinks({ urls: [u], label: 'PAGE', userData: { person } });
          }
        }
      },
    });

    await cheerioCrawler.run();

    const { items } = await Dataset.getData();
    const consolidated = consolidateByName(items);
    await Actor.setValue('PHASE2_ENRICHED.json', consolidated, { contentType: 'application/json' });
    await Actor.setValue('PHASE2_ENRICHED.csv', toCsv(consolidated, ['name', 'phone', 'email', 'sourceUrl']), { contentType: 'text/csv' });

    if (brevoExport) {
      const brevoRows = consolidated.map((r) => {
        const [first, ...last] = String(r.name || '').trim().split(/\s+/);
        return {
          EMAIL: (r.email || '').toLowerCase(),
          SMS: toE164US(r.phone || ''),
          FIRSTNAME: first || '',
          LASTNAME: last.join(' ') || '',
          SOURCEURL: r.sourceUrl || ''
        };
      });
      const brevoCsv = toCsv(brevoRows, ['EMAIL', 'SMS', 'FIRSTNAME', 'LASTNAME', 'SOURCEURL']);
      await Actor.setValue(brevoFileName, brevoCsv, { contentType: 'text/csv' });
      log.info(`Brevo CSV written: ${brevoFileName} (${brevoRows.length} rows)`);
    }

    log.info(`Phase 2 done. Enriched ${consolidated.length} contacts.`);
  }
});

function consolidateByName(items = []) {
  const by = new Map();
  for (const it of items) {
    const key = (it.name || '').toLowerCase();
    if (!key) continue;
    const prev = by.get(key);
    if (!prev) by.set(key, it);
    else {
      const score = (x) => (x?.email ? 2 : 0) + (x?.phone ? 1 : 0);
      by.set(key, score(it) > score(prev) ? it : prev);
    }
  }
  return [...by.values()];
}

function toCsv(rows, headers) {
  const csv = [headers.join(',')].concat(
    rows.map((r) => headers.map((h) => escapeCsv(r?.[h] ?? '')).join(','))
  );
  return csv.join('\n');
}

function escapeCsv(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function parseNamesCsv(body = '') {
  const lines = body.trim().split(/\r?\n/);
  const first = lines[0].split(',');
  const nameIdx = first.findIndex((h) => /name/i.test(h));
  if (nameIdx >= 0) return lines.slice(1).map((ln) => ({ name: ln.split(',')[nameIdx] }));
  return lines.map((ln) => ({ name: ln.trim() })).filter((x) => x.name);
}

function buildQueries(name, city) {
  const enc = encodeURIComponent;
  const q = `${name} ${city} realtor email phone`;
  return [
    `https://duckduckgo.com/?q=${enc(q)}`,
    `https://duckduckgo.com/?q=${enc(`${name} ${city} site:facebook.com`)}`,
    `https://duckduckgo.com/?q=${enc(`${name} ${city} site:instagram.com`)}`,
    `https://duckduckgo.com/?q=${enc(`${name} ${city} site:linkedin.com`)}`,
    `https://duckduckgo.com/?q=${enc(`${name} ${city} site:realtor.com`)}`,
    `https://duckduckgo.com/?q=${enc(`${name} ${city} site:homes.com`)}`,
    `https://duckduckgo.com/?q=${enc(`${name} ${city} site:compass.com`)}`,
    `https://duckduckgo.com/?q=${enc(`${name} ${city} contact email`)}`
  ];
}

function isSearchUrl(u) {
  return /(duckduckgo\.com|bing\.com|google\.)/i.test(u);
}

function isNoise(u) {
  return /(accounts\.google|policies\.google|support\.google|\/\.well-known)/i.test(u);
}

function absolutize(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

