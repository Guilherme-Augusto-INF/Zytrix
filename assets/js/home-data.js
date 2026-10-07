// Start the public catalogue request independently of the Firebase SDK graph.
// The same-origin endpoint caches only the anonymous public query for 5 seconds.
export const initialLives = fetch('/api/home-lives', {
  credentials: 'same-origin'
}).then(async response => {
  if (!response.ok) return null;
  const rows = await response.json();
  if (!Array.isArray(rows)) return null;
  const lives = rows.filter(row => row.document).map(({ document }) => ({
    id: document.name.split('/').pop(),
    ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key,
      value.stringValue ?? value.booleanValue ?? value.integerValue ?? value.doubleValue ?? null
    ]))
  }));
  showPublicPreviews(lives);
  return lives;
}).catch(() => null);

function showPublicPreviews(lives) {
  if (typeof document === 'undefined') return;
  const safe = lives.filter(item => item.matureContent !== true)
    .sort((a, b) => Number(b.viewerCount || 0) - Number(a.viewerCount || 0));
  for (const id of ['featured', 'live-now']) {
    const grid = document.getElementById(id);
    if (grid?.getAttribute('aria-busy') !== 'true') continue;
    grid.querySelectorAll('.home-live-slot').forEach((slot, index) => {
      const live = safe[index];
      if (!live?.thumbnailURL) return;
      slot.dataset.liveId = live.id;
      const image = document.createElement('img');
      image.width = 640;
      image.height = 360;
      image.alt = 'Prévia de uma transmissão pública';
      if (id === 'featured' && index === 0) image.fetchPriority = 'high';
      image.src = live.thumbnailURL;
      slot.querySelector('.thumb').appendChild(image);
    });
  }
}
