import { expandLayer } from './styles/expandLayers';
import throttle from 'lodash.throttle';

const throttleTime = 250;

self.addEventListener(
  'message',
  e => {
    const layers = e.data;

    let progress = 0;
    const throttledProgressUpdate = throttle(() => {
      self.postMessage({ progress });
    }, throttleTime);

    const expandLayers = layers => {
      let nextLayers = layers;
      self.postMessage({ progress });
      try {
        nextLayers = layers.reduce((acc, l, i) => {
          acc = acc.concat(expandLayer(l));
          progress = i / layers.length;
          throttledProgressUpdate();
          return acc;
        }, []);
      } catch (err) {
        console.error(err);
      }
      setTimeout(
        () => self.postMessage({ progress, expandedLayers: nextLayers }),
        throttleTime
      );
    };

    expandLayers(layers);
  },
  false
);
