import { expandLayer } from './styles/expandLayers';
import throttle from 'lodash.throttle';

const throttleTime = 250;

self.addEventListener(
  'message',
  e => {
    const layers = e.data;
    let limitedExpandedLayerIds = [];

    let progress = 0;
    const throttledProgressUpdate = throttle(() => {
      self.postMessage({ progress });
    }, throttleTime);

    const expandLayers = layers => {
      let nextLayers = layers;
      self.postMessage({ progress });
      try {
        nextLayers = layers.reduce((acc, l, i) => {
          const { expandedLayers, comboLimitHit } = expandLayer(l);
          if (comboLimitHit) limitedExpandedLayerIds.push(l.id);
          acc = acc.concat(expandedLayers);
          progress = i / layers.length;
          throttledProgressUpdate();
          return acc;
        }, []);
      } catch (err) {
        console.error(err);
      }
      setTimeout(
        () =>
          self.postMessage({
            progress,
            expandedLayers: nextLayers,
            limitedExpandedLayerIds,
          }),
        throttleTime
      );
    };

    expandLayers(layers);
  },
  false
);
