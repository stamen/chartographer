import Color from 'color';
import { latest } from '@mapbox/mapbox-gl-style-spec';
import { Expression } from 'mapbox-expression';

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

  if (propertySpec.type === 'color') {
    nextValue = `rgba(${Math.round(255 * nextValue.r)}, ${Math.round(
      255 * nextValue.g
    )}, ${Math.round(255 * nextValue.b)}, ${nextValue.a})`;
    nextValue = convertToHsl(nextValue);
  }

  // TODO Find proper way to resolve these conditionals from style spec
  if (propertyId === 'icon-image' && nextValue.hasOwnProperty('name')) {
    nextValue = nextValue?.name || '';
  }
  if (propertyId === 'text-field' && nextValue.hasOwnProperty('sections')) {
    nextValue = nextValue.sections.map(item => item.text).join('');
  }

  return nextValue;
};

export { evaluateExpression };
