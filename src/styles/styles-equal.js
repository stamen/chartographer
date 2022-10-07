import isEqual from 'lodash.isequal';
import { migrate } from '@mapbox/mapbox-gl-style-spec';
import { convertStylesheetToRgb } from '../convert-colors';

const stylesEqual = (styleA, styleB) => {
  if ((styleA && !styleB) || (styleB && !styleA)) return false;
  if (!styleA && !styleB) return true;

  styleA = convertStylesheetToRgb(migrate(styleA));
  styleB = convertStylesheetToRgb(migrate(styleB));

  return isEqual(styleA, styleB);
};

export { stylesEqual };
