// eXp Realty — Jacksonville agents
import { toTitleCase, dedupeBy } from './util.js';

export async function* expSeeds(limit = 250) {
  for (let page = 1; page <= 50; page++) {
    yield {
      url: `https://www.exprealty.com/agents-search?page=${page}&country=US&m=f&location=Jacksonville%2C%20FL`,
      label: 'EXP_LIST',
      limit,
    };
  }
}

export function parseExpList($) {
  const out = [];
  // Heuristic selectors; eXp markup can vary
  $('a[href*="/agents/"], [data-testid="agent-name"], .agent-card h3, .agent-name, h3, h2').each((_, el) => {
    const name = $(el).text().trim();
    if (!name) return;
    if (/^(learn more|view profile|contact|about)/i.test(name)) return;
    if (name.length < 3) return;
    out.push({ name: toTitleCase(name), source: 'exprealty.com' });
  });
  return dedupeBy(out, (x) => x.name.toLowerCase());
}
