const isMapboxUrl = url => {
  if (typeof url !== 'string') return false;
  const hasMapboxFormat = url.startsWith('mapbox://');
  return hasMapboxFormat;
};

const isAccessTokenRequired = style => {
  const { sprite, glyphs, sources } = style;

  const hasMapboxSourceUrls = !!Object.values(sources)
    .reduce((acc, s) => {
      if (s.url) return acc.concat(s.url);
      if (s.tiles) return acc.concat(s.tiles);
      return acc;
    }, [])
    .filter(isMapboxUrl).length;

  const usesMapboxUrls =
    isMapboxUrl(sprite) || isMapboxUrl(glyphs) || hasMapboxSourceUrls;

  return usesMapboxUrls;
};

export { isAccessTokenRequired };
