// Which brand's logo a course shows: the provider's main website, so Microsoft Learn and Microsoft Support share one.
/** @type {[RegExp, string][]} */
const BRAND = [[/^Microsoft/, "microsoft.com"], [/^Google/, "google.com"], [/^Anthropic/, "anthropic.com"], [/^Harvard/, "harvard.edu"], [/^Coursera/, "coursera.org"]];
/** @param {{ provider: string, url: string }} c @returns {string} */
export function logoDomain(c) {
  for (const [re, d] of BRAND) if (re.test(c.provider)) return d;
  const host = new URL(c.url).hostname.replace(/^www\./, "");
  const parts = host.split(".");
  const n = /\.(gov|edu|com|org)\.my$/.test(host) ? 3 : 2;
  return parts.slice(-n).join(".");
}
