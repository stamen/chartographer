import { getValue as getInterpolatedValue } from './interpolation';
import { MIN_ZOOM, MAX_ZOOM } from './constants';

// Literal expressions are unnecessary but valid for opacity and color
// so we remove them for things to run smoothly
const handleLiteral = value => {
  if (Array.isArray(value) && value[0] === 'literal') {
    return value[1];
  }
  if (Array.isArray(value)) {
    return value.map(handleLiteral);
  }
  return value;
};

const isGradient = value => {
  if (Array.isArray(value) && value[0] === 'interpolate') {
    const [, [interpolationType], [attribute]] = value;

    if (interpolationType === 'linear' && attribute === 'zoom') {
      return true;
    }
  }
  return false;
};

const getGradientStops = ({ color, opacity, minZoom, maxZoom, xScale }) => {
  const colorIsGradient = isGradient(color);
  const opacityIsGradient = isGradient(opacity);

  const gradientStops = [];

  if (colorIsGradient || opacityIsGradient) {
    const lineStart = xScale(minZoom);
    const lineLength = xScale(maxZoom) - xScale(minZoom);

    opacity = opacity;
    const gradientColorArray = colorIsGradient ? color.slice(3) : [];
    const gradientOpacityArray = opacityIsGradient ? opacity.slice(3) : [];

    const stops = gradientColorArray
      .concat(gradientOpacityArray)
      .filter((v, i) => i % 2 === 0)
      .sort((a, b) => a - b);

    stops.forEach(zoomStop => {
      const colorOutput = colorIsGradient
        ? getInterpolatedValue(color, zoomStop, null)
        : color;
      let opacityOutput = opacityIsGradient
        ? getInterpolatedValue(opacity, zoomStop, null)
        : opacity;
      opacityOutput = parseFloat(opacityOutput.toFixed(2));
      gradientStops.push({
        offset: ((xScale(zoomStop) - lineStart) / lineLength) * 100,
        stopColor: colorOutput,
        stopOpacity: opacityOutput
      });
    });
  }

  return gradientStops;
};

const getColor = (layer, xScale) => {
  let gradients = [];
  const minZoom = layer.minzoom || MIN_ZOOM;
  const maxZoom = layer.maxzoom || MAX_ZOOM;

  let color;
  let opacity;
  let strokeColor;
  let strokeWidth = 0;

  // Return early for hidden layers
  const isNotVisible = layer?.layout?.visibility === 'none';
  if (isNotVisible) {
    return {
      gradients,
      color: {
        color: 'rgba(0, 0, 0, 0)',
        strokeColor: 'rgba(0, 0, 0, 0)',
        strokeWidth
      }
    };
  }

  switch (layer.type) {
    case 'fill':
      color = layer?.paint?.['fill-color'];
      opacity = layer?.paint?.['fill-opacity'];
      strokeColor = layer?.paint?.['fill-outline-color'];
      if (strokeColor) strokeWidth = 1;
      break;
    case 'background':
      color = layer?.paint?.['background-color'];
      break;
    case 'line':
      color = layer?.paint?.['line-color'];
      opacity = layer?.paint?.['line-opacity'];
      break;
    case 'symbol':
      color = layer?.paint?.['text-color'];
      opacity = layer?.paint?.['text-opacity'];
      break;
    default: {
    }
  }

  // Defaults
  color = handleLiteral(color) || 'black';
  opacity = opacity !== undefined ? handleLiteral(opacity) : 1;

  const gradientStops = getGradientStops({
    color,
    opacity,
    minZoom,
    maxZoom,
    xScale
  });

  if (gradientStops.length > 1) {
    gradients = [
      {
        id: layer.id,
        stops: gradientStops.map(stop => ({
          offset: `${stop.offset}%`,
          stopColor: stop.stopColor,
          stopOpacity: stop.stopOpacity
        }))
      }
    ];

    color = `url('#${layer.id}')`;
  }

  return { gradients, color: { color, strokeColor, strokeWidth } };
};

export { getColor };
