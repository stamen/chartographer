<script>
  import { renderers } from './constants';
  import { rendererStore, styleStore } from './stores';
  import Fa from 'svelte-fa/src/fa.svelte';
  import { faCircle } from '@fortawesome/free-solid-svg-icons';
  import { validate as validateMapbox } from '@mapbox/mapbox-gl-style-spec';
  import { validate as validateMaplibre } from '@maplibre/maplibre-gl-style-spec';
  import { isAccessTokenRequired } from './is-access-token-required';

  let displayRenderers = renderers;
  let selectedRenderer;
  let style;
  let errors = [];

  styleStore.subscribe(value => (style = value));

  const getBetterErrorMessages = errors => {
    return errors.map(error => {
      let { message } = error;
      // Replace layers[<index>] with layerId
      const replaceRegex = /layers\[\d+\]\./g;
      // Remove layers[<index>] following this pattern since it already shows layer id
      const removeRegex = /layers\[\d+\]: /g;
      function replacer(match, str) {
        let num = match.match(/\d+/g);
        let layerId;
        if (num && !isNaN(Number(num))) {
          layerId = style?.layers[Number(num)]?.id;
        }
        return layerId ? `layer "${layerId}" ` : match + str;
      }
      message = message
        .replace(replaceRegex, replacer)
        .replace(removeRegex, '');
      return message;
    });
  };

  const setRenderer = renderer => {
    rendererStore.set(renderer);
    if (style) {
      if (renderer === 'mapbox-gl') {
        errors = validateMapbox(JSON.stringify(style));
      } else {
        errors = validateMaplibre(JSON.stringify(style));
      }
      errors = getBetterErrorMessages(errors);
    }
  };

  $: setRenderer(selectedRenderer);

  $: if (style) {
    const mapboxOnly = isAccessTokenRequired(style);
    if (mapboxOnly) {
      displayRenderers = displayRenderers.filter(v => v.value === 'mapbox-gl');
    }
  }
</script>

<div class="container">
  <div class="label">
    <div />
    Renderer:
    <div
      class="icon"
      title={errors ? errors.map(e => `• ${e}`).join('\n\n') : ''}
    >
      <Fa icon={faCircle} color={errors.length ? 'red' : 'green'} />
    </div>
  </div>

  <select class="renderer-dropdown" bind:value={selectedRenderer}>
    {#each displayRenderers as renderer}
      <option value={renderer.value}> {renderer.name}</option>
    {/each}
  </select>
</div>

<style>
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .icon {
    margin-left: 6px;
    margin-right: 6px;
  }

  .label {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .renderer-dropdown {
    height: 30px;
    font-size: 12px;
  }
</style>
