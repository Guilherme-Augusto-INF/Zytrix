// Only real root-level HTML pages are eligible for URL normalization.
// Never rewrite assets, APIs, external origins, fragments or user-provided paths.
export function normalizePageUrl(value, htmlFiles) {
  const match = /^(https:\/\/zytrix-lives\.vercel\.app\/|\.?\/|)([a-z0-9-]+)\.html([?#].*)?$/i.exec(value);
  if (!match || !htmlFiles.has(match[2] + '.html')) return value;
  const path = match[2].toLowerCase() === 'index' ? '/' : '/' + match[2];
  const origin = match[1] === 'https://zytrix-lives.vercel.app/' ? match[1].slice(0, -1) : '';
  return origin + path + (match[3] || '');
}

export function normalizeDocumentNavigation(html, htmlFiles) {
  let output = html.replace(/<(?:a|link|meta)\b[^>]*>/gi, tag => {
    if (/^<meta\b/i.test(tag) &&
        !/\b(?:property|name)=["'](?:og:url|twitter:url)["']/i.test(tag)) return tag;
    return tag.replace(/\b(href|content)=(["'])([^"']*)\2/gi, (whole, attr, quote, value) => {
      if (attr.toLowerCase() === 'content' && !/^<meta\b/i.test(tag)) return whole;
      return attr + '=' + quote + normalizePageUrl(value, htmlFiles) + quote;
    });
  });
  // Structured data URLs are identifiers, not browser navigation.
  // Fix only canonical page URLs within JSON-LD, never arbitrary script contents.
  output = output.replace(/(<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (whole, open, json, close) => open + json.replace(
      /https:\/\/zytrix-lives\.vercel\.app\/[a-z0-9-]+\.html(?:[?#][^"\s]*)?/gi,
      value => normalizePageUrl(value, htmlFiles)) + close);
  return output;
}
