import { getLinearFunction } from './linear';
import { getStepFunction } from './step';

export function getFunction(expression) {
  const [expressionType] = expression;
  if (expressionType === 'step') return getStepFunction(expression);
  if (expressionType === 'interpolate') {
    const interpolationType = expression[1][0];
    if (interpolationType === 'linear') {
      return getLinearFunction(expression);
    }
  }
  return () => {};
}

export function getValue(expression, zoom, defaultValue = null) {
  if (expression == undefined) return defaultValue;
  if (typeof expression === 'number') return expression;
  if (Array.isArray(expression)) {
    return getFunction(expression)(zoom);
  }
  return defaultValue;
}
