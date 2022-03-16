import { getValue as getInterpolatedValue } from './interpolation';
import { MIN_ZOOM, MAX_ZOOM } from './constants';

function getColor(layer, xScale) {
  let gradients = [];
  const lineStart = xScale(layer.minzoom || MIN_ZOOM);
  const lineLength =
    xScale(layer.maxzoom || MAX_ZOOM) - xScale(layer.minzoom || MIN_ZOOM);

  let color;
  let opacity;
  let strokeColor;
  let strokeWidth = 0;
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
  color = color || 'black';
  opacity = opacity !== undefined ? opacity : 1;

  let colorIsGradient = false;
  let opacityIsGradient = false;

  if (Array.isArray(color) && color[0] !== 'interpolate') {
    console.log(color);
  }

  if (Array.isArray(color) && color[0] === 'interpolate') {
    const [, [interpolationType], [attribute]] = color;

    if (interpolationType === 'linear' && attribute === 'zoom') {
      colorIsGradient = true;
    }
  }

  if (Array.isArray(opacity) && opacity[0] === 'interpolate') {
    const [, [interpolationType], [attribute]] = opacity;

    if (interpolationType === 'linear' && attribute === 'zoom') {
      opacityIsGradient = true;
    }
  }

  const gradientStops = [];

  if (colorIsGradient || opacityIsGradient) {
    // This should have better handling elsewhere
    opacity =
      Array.isArray(opacity) && opacity[0] === 'literal' ? opacity[1] : opacity;
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

  // Special handling for hidden layers
  const isNotVisible = layer?.layout?.visibility === 'none';

  if (isNotVisible) {
    color = 'rgba(0, 0, 0, 0)';
    strokeColor = 'rgba(0, 0, 0, 0)';
  }

  return { gradients, color: { color, strokeColor, strokeWidth } };
}

export { getColor };
