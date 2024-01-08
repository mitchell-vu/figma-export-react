import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';
import fs from 'fs';
import { mkdirp } from 'mkdirp';
import path from 'path';
import figmaClient from './src/figma-client.js';
import { kebabToPascal, snakeToKebab } from './src/utils.js';

dotenv.config();

const config = {
  accessToken: process.env.FIGMA_ACCESS_TOKEN,
  fileId: process.env.FIGMA_FILE_ID,
  pageName: process.env.FIGMA_PAGE,
  frame: process.env.FIGMA_FRAME,
  exportPath: process.env.EXPORT_PATH,
  removeFromName: process.env.REMOVE_FROM_NAME,
};

const figmaApi = figmaClient(config.accessToken);

/**
 * Get the parent node of Frame node matched with configuration
 * @param {} root Root tree node
 * @param {*} current
 * @returns Node that contain Frame node
 */
const getPathToFrame = (root, current) => {
  if (!current.length) return root;

  const path = [...current];
  const name = path.shift();
  const foundChild = root.children.find((c) => c.name === name);

  if (!foundChild) return root;

  return getPathToFrame(foundChild, path);
};

/**
 * Find duplicate icons and rename them to avoid conflict
 * @param {*} propertyName - Object key to compare
 * @param {*} arr - Array of icons
 * @returns Array of icons
 */
const findDuplicates = (propertyName = 'name', arr) =>
  arr.reduce((acc, current) => {
    const x = acc.find((item) => item[propertyName] === current[propertyName]);

    if (x) {
      console.log(
        chalk.bgRed.bold(`Duplicate icon name: ${x[propertyName]}. Please fix figma file`),
      );
      current[propertyName] = current[propertyName] + '-duplicate-name';
    }
    return acc.concat([current]);
  }, []);

/**
 * Get Figma file's icons according to configuration
 * @returns Array of icons
 */
const getFigmaFile = async () => {
  try {
    console.log(chalk.cyan.bold("Fetching Figma file's data..."));
    const res = await figmaApi.get(`/files/${config.fileId}`);

    console.log(chalk.cyan.bold(`Finished in ${res.duration / 1000}s\n`));

    const page = res.data.document.children.find((c) => c.name === config.pageName);

    if (!page) {
      console.log(chalk.red.bold(`Cannot find ${config.pageName} Page, check your settings`));
      return;
    }

    const shouldGetFrame = isNaN(config.frame) && parseInt(config.frame) !== -1;
    let iconsArray = page.children;

    if (shouldGetFrame) {
      const frameNameArr = config.frame.split('/').filter(Boolean);
      const frameName = frameNameArr.pop();
      const frameRoot = getPathToFrame(page, frameNameArr);

      if (!frameRoot.children.find((c) => c.name === frameName)) {
        console.log(
          chalk.red.bold(
            'Cannot find',
            chalk.white.bgRed(frameName),
            'Frame in this Page, check your settings',
          ),
        );
        return;
      }

      iconsArray = frameRoot.children.find((c) => c.name === frameName).children;
    }

    let icons = iconsArray.map((icon) => ({
      id: icon.id,
      name: icon.name,
    }));

    icons = findDuplicates('name', icons);

    return icons;
  } catch (err) {
    if (err.response) {
      console.log(
        chalk.red.bold(
          `Cannot get Figma file: ${err.response.data.status} ${err.response.data.err}`,
        ),
      );
    } else {
      console.log(err);
    }
    process.exit(1);
  }
};

/**
 * Get Figma file's icon AWS URLs
 * @param {*} icons Array of icons
 * @returns Array of icons with image url
 */
const getImages = async (icons) => {
  const iconArr = [...icons];

  console.log(chalk.cyan.bold("Fetching Figma file's icon urls..."));
  const iconIds = iconArr.map((icon) => icon.id).join(',');

  try {
    const { data } = await figmaApi({
      method: 'get',
      url: `/images/${config.fileId}`,
      params: {
        ids: iconIds,
        format: 'svg',
      },
    });

    const { images } = data;

    iconArr.forEach((icon) => {
      icon.image = images[icon.id];
    });

    return iconArr;
  } catch (err) {
    console.log(chalk.red.bold(`Cannot get icons: ${err}`));
    process.exit(1);
  }
};


const createOutputDirectory = () => {
  const directory = path.resolve(config.exportPath);
  console.log(directory);

  if (!fs.existsSync(directory)) {
    console.log(`Directory ${config.exportPath} does not exist`);
    if (mkdirp.sync(directory)) {
      console.log(`Created directory ${config.exportPath}`);
    }
  }
}

const removeFromName = (name) => {
  return name.replace(config.removeFromName, '');
};

/**
 * Download icon from AWS S3
 * @param {*} url Image url
 * @param {*} name Icon name
 * @returns Promise
 */
const downloadImage = async (url, name) => {
  let nameClean = name;
  let directory = config.exportPath;
  const idx = name.lastIndexOf('/');

  if (idx !== -1) {
    directory = directory + '/' + name.substring(0, idx);
    nameClean = name.substring(idx + 1);

    // Create sub-directory
    // e.g. Icon/Regular/sun.svg -> new directory Icon/Regular
    if (!fs.existsSync(directory)) {
      if (mkdirp.sync(directory)) {
        console.log(`\nCreated sub directory ${directory}`);
      } else {
        console.log('Cannot create directories');
        process.exit(1);
      }
    }
  }

  const imagePath = path.resolve(directory, `${snakeToKebab(nameClean)}.svg`);
  const writer = fs.createWriteStream(imagePath);

  try {
    const { data } = await axios.get(url, { responseType: 'stream' });
    data.pipe(writer);
  } catch (err) {
    console.log(name);
    console.log(err.message);
    console.log(
      chalk.red.bold('Something went wrong fetching the image from S3, please try again'),
    );
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      resolve({
        name: `${snakeToKebab(nameClean)}.svg`,
        size: fs.statSync(imagePath).size,
      });
    });
    writer.on("error", (err) => {
      console.log("Error writting file", err);
      reject(err);
    });
  });
};

/**
 * Export React component into `index.jsx` file
 * e.g. Icon/Regular/sun.svg -> SunSvg
 * @param {*} svgFileName 
 * @example `Icon/Regular/sun.svg`  -> export { default as SunSvg } from './sun.svg';
 */
const exportReactComponent = (svgFileName) => {
  const pascalCaseName = kebabToPascal(svgFileName.replace('.svg', ''));
  const exportStatement = `export { default as ${pascalCaseName}Svg } from './${svgFileName}';\n`;

  fs.appendFileSync(path.resolve('index.jsx'), exportStatement, 'utf8');
}

const run = async () => {
  const iconFrames = await getFigmaFile();
  const iconUrls = await getImages(iconFrames);
  createOutputDirectory();

  const icons = iconUrls.map((icon) => downloadImage(icon.image, removeFromName(icon.name)));
  const results = await Promise.all(icons);

  // Export React component
  // e.g. Icon/Regular/sun.svg -> SunSvg
  // Clear index.jsx file
  fs.writeFileSync(path.resolve('index.jsx'), '', 'utf8');
  results.forEach(({ name }) => {
    exportReactComponent(name);
  })

  console.log(chalk.green.bold(`\nFinished exporting ${results.length} icons`));
  console.table(results);
};

run();