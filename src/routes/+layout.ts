// Every route is client-driven (style upload, rendering) with no server-side
// data, so the whole app can be prerendered into a static site for GitHub
// Pages — see vite.config.ts's adapter-static config.
export const prerender = true;
