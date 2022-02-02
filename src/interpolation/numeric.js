import * as d3 from 'd3';
import { getStepFunction } from './step';

function getLinearFunction(expression) {
  const [expressionType, [interpolationType], [input], ...stops] = expression;
  return value => {
	if (value < stops[0]) return stops[1];
	if (value > stops[stops.length - 2]) return stops[stops.length - 1];
	return d3.scaleLinear(
	  stops.filter((e, i) => i % 2 === 0),
	  stops.filter((e, i) => i % 2 === 1)
	)(value);
  };
}

export function getFunction(expression) {
  const [expressionType] = expression;
  if (expressionType === 'step') return getStepFunction(expression);
  if (expressionType === 'interpolate') {
    const interpolationType = expression[1][0];
    if (interpolationType === 'linear') {
      return getLinearFunction(expression);
    }
    return () => {};
  }
}

export function getValue(expression, zoom, defaultValue = 0) {
  if (typeof expression === 'number') return expression;
  if (Array.isArray(expression)) {
    return getFunction(expression)(zoom);
  }
  return defaultValue;
}
