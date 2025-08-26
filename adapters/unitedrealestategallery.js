// United Real Estate Gallery — Jacksonville agents
import { toTitleCase, dedupeBy } from './util.js';

export async function* unitedSeeds(limit = 250) {
  yield { url: 'https://www.unitedrealestategallery.com/findanagent.htm', label: 'UNITED_LIST', limit };
  for (let page = 2; page <= 20; page++) {
    yield { url: `https://www.unitedrealestategallery.com/findanagent.htm?page=${page}`, label: 'UNITED_LIST', limit };
  }
}

export function parseUnited($) {
  const out = [];
  $('.ourAgentsCardName, .agentlist-name, .agent .name, .agent-card .name, .directory-card .name, h3, h4, a[href*="/agent/"]').each((_, el) => {
    const name = $(el).text().trim();
    if (!name) return;
    if (/^(contact|learn more|details)/i.test(name)) return;
    if (name.length < 3) return;
    out.push({ name: toTitleCase(name), source: 'unitedrealestategallery.com' });
  });
  return dedupeBy(out, (x) => x.name.toLowerCase());
}
