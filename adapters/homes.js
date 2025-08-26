// Homes.com agents directory
import { toTitleCase, dedupeBy } from './util.js';

export async function* homesSeeds(limit = 250) {
  for (let page = 1; page <= 50; page++) {
    yield {
      url: `https://www.homes.com/real-estate-agents/jacksonville-fl/p-${page}/`,
      label: 'HOMES_LIST',
      limit,
    };
  }
}

export function parseHomesList($) {
  const out = [];
  $('[data-qa="agent-card"], .agent-card').each((_, el) => {
    const name = $(el).find('[data-qa="agent-name"], .name, h3').first().text().trim();
    if (!name) return;
    out.push({ name: toTitleCase(name), source: 'homes.com' });
  });
  return dedupeBy(out, (x) => x.name.toLowerCase());
}
