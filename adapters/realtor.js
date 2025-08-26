// Realtor.com directory pages for Jacksonville agents
import { toTitleCase, dedupeBy } from './util.js';

export async function* realtorSeeds(limit = 250) {
  // Realtor paginates; these URLs are public directory pages
  for (let page = 1; page <= 20; page++) {
    yield {
      url: `https://www.realtor.com/realestateagents/jacksonville_fl/pg-${page}`,
      label: 'REALTOR_LIST',
      limit,
    };
  }
}

export function parseRealtorList($) {
  const out = [];
  $('.agent-list-card, .jsx-\\d+ agent-list-card').each((_, el) => {
    const name = $(el).find('[data-testid="agent-name"], .agent-name').text().trim();
    if (!name) return;
    out.push({ name: toTitleCase(name), source: 'realtor.com' });
  });
  return dedupeBy(out, (x) => x.name.toLowerCase());
}
