// Converts all color values in stylesheet to RGB
import Color from 'color';
import { latest } from '@mapbox/mapbox-gl-style-spec';
import mapboxGlStyleRecurse from 'mapbox-gl-style-recurse';

const createRecurseStyle = mapboxGlStyleRecurse.createRecurseStyle;

// Color properties from the style spec in case new ones are added
const convertToRgbPropertyIds = Object.keys(latest).reduce((acc, k) => {
  if (k.includes('paint')) {
    Object.keys(latest[k]).forEach(propertyId => {
      if (latest[k][propertyId]['type'] === 'color') {
        acc.push(propertyId);
      }
    });
  }
  return acc;
}, []);

const expressionNames = Object.keys(latest['expression_name']['values']);

/**
 * convertToRgb
 * Convert colors to RGB (rounded off decimal points)
 * @param {string} color - color string to be converted
 * @returns {string} - color as rgb value
 */
const convertToRgb = (id, color, key) => {
  // Hue might not be necessary, but basically we want to avoid rounding alpha
  const attrToRound = ['r', 'g', 'b', 'a'];

  let rgbObj = Color(color).rgb().object();

  rgbObj = Object.keys(rgbObj).reduce((acc, k) => {
    acc[k] = attrToRound.includes(k) ? Math.round(rgbObj[k]) : rgbObj[k];
    return acc;
  }, {});

  const rgbcolor = Color(rgbObj).rgb().string();

  return rgbcolor;
};

/**
 * convertToRgbCondition
 * Condition to run convertToRgb on
 * @param {Array} val - property value
 * @returns {boolean} - true or false
 */
const convertToRgbCondition = (val, key) => {
  if (typeof val !== 'string') return false;
  if (expressionNames.includes(val)) return false;
  try {
    // Checks if it is a valid color string
    new Color(val);
  } catch (e) {
    return false;
  }
  return true;
};

const convertStylesheetToRgb = createRecurseStyle({
  transformFn: convertToRgb,
  transformCondition: convertToRgbCondition,
  propertyIds: convertToRgbPropertyIds
});

export {
  convertStylesheetToRgb,
  convertToRgb,
  convertToRgbCondition,
  convertToRgbPropertyIds
};
