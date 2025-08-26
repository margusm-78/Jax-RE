// Coldwell Banker Jacksonville agents page(s)
import { toTitleCase, dedupeBy } from './util.js';

export async function* coldwellSeeds(limit = 250) {
  for (let page = 1; page <= 30; page++) {
    yield {
      url: `https://www.coldwellbanker.com/city/fl/jacksonville/agents?pg=${page}`,
      label: 'COLDWELL_LIST',
      limit,
    };
  }
}

export function parseColdwell($) {
  const out = [];
  $('.agent-card, .agent-result').each((_, el) => {
    const name = $(el).find('.agent-name, .agent-card__name, a[data-cg="agent-name"]').first().text().trim();
    if (!name) return;
    out.push({ name: toTitleCase(name), source: 'coldwellbanker.com' });
  });
  return dedupeBy(out, (x) => x.name.toLowerCase());
}
