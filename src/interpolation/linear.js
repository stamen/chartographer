import * as d3 from 'd3';

export function getLinearFunction(expression) {
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
