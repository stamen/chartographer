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
  if (!Array.isArray(value)) return false;

  const expressionType = value[0];

  switch (expressionType) {
    case 'step': {
      const [, [attribute]] = value;
      if (attribute === 'zoom') {
        return true;
      }
      break;
    }
    case 'interpolate': {
      const [, [interpolationType], [attribute]] = value;
      if (interpolationType === 'linear' && attribute === 'zoom') {
        return true;
      }
      break;
    }
    default:
      return false;
  }
};

const getZoomOutputArray = scaleExpression => {
  if (!isGradient(scaleExpression)) return [];
  const expressionType = scaleExpression[0];

  if (expressionType === 'interpolate') return scaleExpression.slice(3);

  // For the sake of consistent gradient handling, convert step functions
  // to look more like interpolate functions
  let stepZoomOutput = scaleExpression.slice(2);
  stepZoomOutput.unshift(0.1);

  stepZoomOutput = stepZoomOutput.reduce((acc, item, i) => {
    // zoom
    if (i % 2 === 0 && i !== 0) {
      acc.push(Number(item) - 0.01, stepZoomOutput[i - 1]);
      acc.push(item);
    } // output
    else {
      acc.push(item);
    }

    return acc;
  }, []);

  return stepZoomOutput;
};

const getGradientStops = ({
  layerId,
  color,
  opacity,
  minZoom,
  maxZoom,
  xScale,
}) => {
  const colorInterpolation = isGradient(color) && color[0];
  const opacityInterpolation = isGradient(opacity) && opacity[0];

  const gradientStops = [];

  if (colorInterpolation || opacityInterpolation) {
    const lineStart = xScale(minZoom);
    const lineLength = xScale(maxZoom) - xScale(minZoom);

    opacity = opacity;
    let gradientColorArray = getZoomOutputArray(color);
    let gradientOpacityArray = getZoomOutputArray(opacity);

    const stops = gradientColorArray
      .concat(gradientOpacityArray)
      .filter((v, i) => i % 2 === 0)
      .sort((a, b) => a - b);

    stops.forEach(zoomStop => {
      let colorOutput = colorInterpolation
        ? getInterpolatedValue(color, zoomStop, null)
        : color;
      let opacityOutput = opacityInterpolation
        ? getInterpolatedValue(opacity, zoomStop, null)
        : opacity;

      if (Array.isArray(colorOutput)) {
        console.warn(
          `${layerId}: Unhandled data expression, ${JSON.stringify(
            colorOutput,
            null,
            2
          )}`
        );
        colorOutput = 'black';
      }
      if (Array.isArray(opacityOutput)) {
        console.warn(
          `${layerId}: Unhandled data expression, ${JSON.stringify(
            opacityOutput,
            null,
            2
          )}`
        );
        opacityOutput = 1;
      }
      opacityOutput = parseFloat(opacityOutput.toFixed(2));

      gradientStops.push({
        offset: ((xScale(zoomStop) - lineStart) / lineLength) * 100,
        stopColor: colorOutput,
        stopOpacity: opacityOutput,
      });
    });
  }

  return gradientStops;
};

const getValidGradientId = id => {
  const invalidGradientUrlChars = ['"', ' ', "'"];

  let nextId = id;
  for (const char of invalidGradientUrlChars) {
    nextId = nextId.replaceAll(char, '');
  }
  return nextId;
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
        strokeWidth,
      },
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
    layerId: layer.id,
    color,
    opacity,
    minZoom,
    maxZoom,
    xScale,
  });

  if (gradientStops.length > 1) {
    const gradientId = getValidGradientId(layer.id);

    gradients = [
      {
        id: gradientId,
        stops: gradientStops.map(stop => ({
          offset: `${stop.offset}%`,
          stopColor: stop.stopColor,
          stopOpacity: stop.stopOpacity,
        })),
      },
    ];

    color = `url(#${gradientId})`;
  }

  return { gradients, color: { color, strokeColor, strokeWidth } };
};

export { getColor };
