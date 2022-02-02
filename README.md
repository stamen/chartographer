# mapbox-gl-style-design-system

Generate visualizations of a Mapbox GL stylesheet to better understand how layers are rendered by zoom level.

## Develop

This app uses [Svelte](https://svelte.dev/).

 1. Clone this repo.
 2. `npm install`
 3. `npm run dev`

### Loading style by default in development

To ease development you can load a default style in development by putting one in `public/style.json`, which is ignored by git. Once you do, in development mode you will not need to drag and drop a style in order to view it.


## Deploy

This app is currently deployed using GitHub Pages.

 1. `npm run build`
 2. `npm run deploy`
