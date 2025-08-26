# Jacksonville Realtor Finder (Apify Actor)

**Goal**: Two-phase pipeline for *Jacksonville, FL residential agents*.

- **Phase 1 — Discover**: Crawl well-structured agent directories (Realtor, Homes, Coldwell Banker, Compass) and export a clean names CSV.
- **Phase 2 — Enrich**: For each name, visit lightweight/public pages (DuckDuckGo & brand/portal URLs), visit likely profiles, and extract **phone numbers** and **emails** (regex-based). Outputs a consolidated CSV.

> Note: Some sites block heavy automation. This actor uses low-concurrency Playwright/HTTP + optional Apify proxies to behave politely. Add/remove adapters in `adapters/` as needed.

## Quick start (One‑Click)
1. Create a new Actor → **Upload** the files in this repo.
2. In **Settings → Build**, ensure Node.js 18+.
3. **Run Phase 1** with default input:
   ```json
   { "phase": "discover", "city": "Jacksonville, FL" }
   ```
4. Download **PHASE1_NAMES.csv** from the run's **Key-Value store**.
5. **Run Phase 2** with:
   ```json
   { "phase": "enrich", "city": "Jacksonville, FL" }
   ```
   (or set `namesCsvUrl` to your CSV: `{"phase":"enrich","namesCsvUrl":"https://.../names.csv"}`)
6. Download **PHASE2_ENRICHED.csv** when complete.

## Inputs
See `INPUT_SCHEMA.json` for all options.
- `phase`: `discover` | `enrich`
- `city`: filter/tag used in outputs and queries.
- `limitPerSource`: soft cap per directory.
- `sources`: which adapters to use in Phase 1.
- `namesCsvUrl`: supply your own names list for Phase 2.
- `bingApiKey` *(optional)*: If you add support for Bing Web Search API, plug it here.
- `maxPagesPerName`: safety cap.
- `proxyGroups`: e.g. `RESIDENTIAL` if you have that plan.

## Outputs
- `PHASE1_NAMES.csv` — columns: `name,city,source`
- `PHASE2_ENRICHED.csv` — columns: `name,phone,email,sourceUrl`
- JSON mirrors for programmatic use

## Extending adapters (Phase 1)
Add a new file under `adapters/yourbrand.js` with two funcs:
```js
export async function* yourbrandSeeds(limit) {
  yield { url: 'https://example.com/agents?p=1', label: 'YOURBRAND_LIST', limit };
}
export function parseYourbrand($) {
  const out = [];
  $('...agent-card...').each((_, el) => out.push({ name: $(el).find('...').text().trim(), source: 'example.com' }));
  return out;
}
```
Wire it in `main.js` under `SOURCE_MAP` and in `INPUT_SCHEMA.json` default sources.

## Legal & Ethics
- Respect websites’ terms of use and robots.txt. Use reasonable concurrency and retries.
- Prefer publisher-provided directories and public contact pages. Avoid bypassing paywalls or logging into private areas.

## Tips
- If Phase 1 looks thin, raise `limitPerSource` and add more adapters.
- For Phase 2 accuracy, append broker brand in queries (e.g., `name city coldwell banker email`).
- To output **Brevo**-ready CSV later, add column mapping during export (e.g., `EMAIL, SMS, FIRSTNAME, LASTNAME`).
