export function readQuery() {
  return Object.fromEntries(
    window.location.hash
      .slice(1)
      .split('&')
      .map(s => s.split('='))
  );
}

export function writeQuery(state) {
  window.location.hash = Object.entries(state)
    .map(([k, v]) => {
      return [encodeURIComponent(k), encodeURIComponent(v)].join('=');
    })
    .join('&');
}
