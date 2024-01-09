import fs from 'fs';
import path from 'path';
import { kebabToPascal } from './utils.js';

/**
 * Take SVG file and replace `fill` color to `currentColor`,
 * remove height and width properties, and trim whitespace
 */
export const cleanUpSvg = (svgFileName) => {
    const svgFile = fs.readFileSync(path.resolve(svgFileName), 'utf8');
    const cleanedUpSvg = svgFile
        .replace(/fill="#[0-9a-fA-F]{6}"/g, 'fill="currentColor"')
        .replace(/height="[0-9]+"/g, '')
        .replace(/width="[0-9]+"/g, '')
        .trim()
        .replace(/\s+/g, ' ');

    fs.writeFileSync(path.resolve(svgFileName), cleanedUpSvg, 'utf8');
}

/**
 * Export React component into `index.jsx` file
 * e.g. Icon/Regular/sun.svg -> SunSvg
 * @param {*} svgFileName 
 * @example `Icon/Regular/sun.svg`  -> export { default as SunSvg } from './sun.svg';
 */
export const exportReactComponent = (svgFileName) => {
    const pascalCaseName = kebabToPascal(svgFileName.replace('.svg', ''));
    const exportStatement = `export { default as ${pascalCaseName}Svg } from './${svgFileName}?react';\n`;

    fs.appendFileSync(path.resolve('dist/index.jsx'), exportStatement, 'utf8');
}