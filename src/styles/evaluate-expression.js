import Color from 'color';
import { latest } from '@mapbox/mapbox-gl-style-spec';
import { Expression } from 'mapbox-expression';

// From https://github.com/mapbox/mapbox-gl-js/tree/c3910f870db46aba2a50db3111158244126cb19a/src/style-spec/expression/definitions
const serializeFormatted = formatted => {
  const { sections } = formatted;
  const serialized = ['format'];
  for (const section of sections) {
    if (section.image) {
      serialized.push(['image', section.image.name]);
      continue;
    }
    serialized.push(section.text);
    const options = {};
    if (section.fontStack) {
      options['text-font'] = ['literal', section.fontStack.split(',')];
    }
    if (section.scale) {
      options['font-scale'] = section.scale;
    }
    if (section.textColor) {
      options['text-color'] = ['rgba'].concat(section.textColor.toArray());
    }
    serialized.push(options);
  }
  return serialized;
};

// From https://github.com/mapbox/mapbox-gl-js/tree/c3910f870db46aba2a50db3111158244126cb19a/src/style-spec/expression/definitions
const serializeIconImage = resolvedImage => {
  return ['image', resolvedImage.name];
};

const convertToHsl = color => {
  // Hue might not be necessary, but basically we want to avoid rounding alpha
  const attrToRound = ['h', 's', 'l'];

  let hslObj = Color(color).hsl().object();

  hslObj = Object.keys(hslObj).reduce((acc, k) => {
    acc[k] = attrToRound.includes(k) ? Math.round(hslObj[k]) : hslObj[k];
    return acc;
  }, {});

  const hslColor = Color(hslObj).hsl().string();

  return hslColor;
};

const evaluateExpression = ({
  layerType,
  propertyType,
  propertyId,
  properties,
  value,
  zoom
}) => {
  const initialKey = `${propertyType}_${layerType}`;
  const propertySpec = latest[initialKey][propertyId];
  const feature = {
    type: 'Feature',
    properties,
    geometry: null
  };

  let nextValue = Expression.parse(value, propertySpec.type).evaluate(
    feature,
    zoom && {
      zoom
    }
  );

  if (
    propertySpec.type === 'color' &&
    nextValue &&
    nextValue.hasOwnProperty('r')
  ) {
    nextValue = `rgba(${Math.round(255 * nextValue.r)}, ${Math.round(
      255 * nextValue.g
    )}, ${Math.round(255 * nextValue.b)}, ${nextValue.a})`;
    nextValue = convertToHsl(nextValue);
  }

  if (
    propertyId === 'icon-image' &&
    nextValue &&
    nextValue.hasOwnProperty('name')
  ) {
    nextValue = serializeIconImage(nextValue);
  }
  if (
    propertyId === 'text-field' &&
    nextValue &&
    nextValue.hasOwnProperty('sections')
  ) {
    nextValue = serializeFormatted(nextValue);
  }

  return nextValue;
};

export { evaluateExpression };
