// Compass Jacksonville agents (multiple pages)
import { toTitleCase, dedupeBy } from './util.js';

export async function* compassSeeds(limit = 250) {
  for (let page = 1; page <= 20; page++) {
    yield {
      url: `https://www.compass.com/agents/locations/jacksonville-fl/2801/?page=${page}`,
      label: 'COMPASS_LIST',
      limit,
    };
  }
}

export function parseCompass($) {
  const out = [];
  $('[data-test="agent-card"], .agentCard, a[href*="/agents/"]').each((_, el) => {
    const name = $(el).find('[data-test="agent-card-name"], h3, .MuiTypography-root').first().text().trim();
    if (!name) return;
    out.push({ name: toTitleCase(name), source: 'compass.com' });
  });
  return dedupeBy(out, (x) => x.name.toLowerCase());
}
