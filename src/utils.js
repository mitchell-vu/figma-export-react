export const snakeToKebab = (str) => str.replace(/_/g, '-');
export const snakeToCamel = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
export const snakeToPascal = (str) => snakeToCamel(str).replace(/^[a-z]/, (g) => g.toUpperCase());

export const kebabToCamel = (str) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
export const kebabToPascal = (str) => kebabToCamel(str).replace(/^[a-z]/, (g) => g.toUpperCase());
