# chartographer

Generate visualizations of a Mapbox GL stylesheet to better understand how layers are rendered by zoom level.

Learn more in our blog post "[Visualize a cross section of your map with Chartographer](https://stamen.com/visualize-a-cross-section-of-your-map-with-chartographer/)"

## Develop

This app uses [Svelte](https://svelte.dev/).

1.  Clone this repo.
2.  `yarn install`
3.  `yarn dev`

### Loading style by default in development

To ease development you can load a default style in development by putting one in `public/style.json`, which is ignored by git. Once you do, in development mode you will not need to drag and drop a style in order to view it.

## Deploy

This app is currently deployed using GitHub Pages.

1.  `yarn build`
2.  `yarn deploy`
