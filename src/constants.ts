import path from "path";
import url from "url";
import logger from "./logger";
import { getProjectRoot } from "./utils";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

logger.verbose("resolving constants");

export const BUILDER_NAME: string = "nrg";

// NOTE: @csstools/postcss-sass isnt working with .sass => dart-sass@v1.178.0
export const BUILDER_ALLOWED_STYLE_SHEETS_FILE_EXTENSIONS = [
  "css",
  "scss",
  // "sass",
];

export const BUILDER_ALLOWED_ICONS_FILE_EXTENSIONS = [
  "jpg",
  "svg",
  "png",
  "gif",
];

export const PROJECT_ROOT_DIRECTORY = getProjectRoot();
logger.verbose(`PROJECT_ROOT_DIRECTORY: ${PROJECT_ROOT_DIRECTORY}`);

export const BUILDER_ROOT_DIRECTORY: string = path.resolve(__dirname, "../");
logger.verbose(`BUILDER_ROOT_DIRECTORY: ${BUILDER_ROOT_DIRECTORY}`);

export const BUILDER_SRC_DIRECTORY: string = path.resolve(
  BUILDER_ROOT_DIRECTORY,
  "src",
);
logger.verbose(`BUILDER_SRC_DIRECTORY: ${BUILDER_SRC_DIRECTORY}`);

export const BUILDER_DEFAULTS_DIRECTORY: string = path.resolve(
  BUILDER_ROOT_DIRECTORY,
  "defaults",
);
logger.verbose(`BUILDER_DEFAULTS_DIRECTORY: ${BUILDER_DEFAULTS_DIRECTORY}`);

export const BUILDER_DEFAULT_NRG_CONFIG: string = path.resolve(
  BUILDER_DEFAULTS_DIRECTORY,
  "nrg.json",
);
logger.verbose(`BUILDER_DEFAULT_NRG_CONFIG: ${BUILDER_DEFAULT_NRG_CONFIG}`);

export const BUILDER_TEMPLATES: string = path.resolve(
  BUILDER_ROOT_DIRECTORY,
  "templates",
);
logger.verbose(`BUILDER_TEMPLATES: ${BUILDER_TEMPLATES}`);

export const BUILDER_DOT_DIRECTORY: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  ".nrg",
);
logger.verbose(`BUILDER_DOT_DIRECTORY: ${BUILDER_DOT_DIRECTORY}`);

export const BUNDLER_TMP_DIRECTORY: string = path.resolve(
  BUILDER_DOT_DIRECTORY,
  "tmp",
);
logger.verbose(`BUNDLER_TMP_DIRECTORY: ${BUNDLER_TMP_DIRECTORY}`);

export const BUNDLER_SERVER_TMP_DIRECTORY: string = path.resolve(
  BUNDLER_TMP_DIRECTORY,
  "server",
);
logger.verbose(`BUNDLER_SERVER_TMP_DIRECTORY: ${BUNDLER_SERVER_TMP_DIRECTORY}`);

export const BUNDLER_SERVER_TMP_SRC_DIRECTORY: string = path.resolve(
  BUNDLER_SERVER_TMP_DIRECTORY,
  "src",
);
logger.verbose(
  `BUNDLER_SERVER_TMP_SRC_DIRECTORY: ${BUNDLER_SERVER_TMP_SRC_DIRECTORY}`,
);

export const BUNDLER_CLIENT_TMP_DIRECTORY: string = path.resolve(
  BUNDLER_TMP_DIRECTORY,
  "client",
);
logger.verbose(`BUNDLER_CLIENT_TMP_DIRECTORY: ${BUNDLER_CLIENT_TMP_DIRECTORY}`);

export const BUNDLER_CLIENT_TMP_SRC_DIRECTORY: string = path.resolve(
  BUNDLER_CLIENT_TMP_DIRECTORY,
  "src",
);
logger.verbose(
  `BUNDLER_CLIENT_TMP_SRC_DIRECTORY: ${BUNDLER_CLIENT_TMP_SRC_DIRECTORY}`,
);

export const BUNDLER_TMP_SRC_DIRECTORY: string = path.resolve(
  BUNDLER_TMP_DIRECTORY,
  "src",
);
logger.verbose(`BUNDLER_TMP_SRC_DIRECTORY: ${BUNDLER_TMP_SRC_DIRECTORY}`);

export const BUNDLER_TMP_DIST_DIRECTORY: string = path.resolve(
  BUNDLER_TMP_DIRECTORY,
  "dist",
);
logger.verbose(`BUNDLER_TMP_DIST_DIRECTORY: ${BUNDLER_TMP_DIST_DIRECTORY}`);

export const BUNDLER_TMP_DIST_SOURCE_MAP_PATH: string = path.resolve(
  BUNDLER_TMP_DIST_DIRECTORY,
  "index.js.map",
);
logger.verbose(
  `BUNDLER_TMP_DIST_SOURCE_MAP_PATH: ${BUNDLER_TMP_DIST_SOURCE_MAP_PATH}`,
);

export const SRC_DIRECTORY: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  "src",
);
logger.verbose(`SRC_DIRECTORY: ${SRC_DIRECTORY}`);

export const DIST_DIRECTORY: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  "dist",
);
logger.verbose(`DIST_DIRECTORY: ${DIST_DIRECTORY}`);

export const NODE_RED_EXECUTABLE: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  "node_modules/.bin/node-red",
);
logger.verbose(`NODE_RED_EXECUTABLE: ${NODE_RED_EXECUTABLE}`);

export const NODE_RED_DIRECTORY: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  "node-red",
);
logger.verbose(`NODE_RED_DIRECTORY: ${NODE_RED_DIRECTORY}`);

export const NODE_RED_SETTINGS_FILE: string = path.resolve(
  NODE_RED_DIRECTORY,
  "settings.js",
);
logger.verbose(`NODE_RED_SETTINGS_FILE: ${NODE_RED_SETTINGS_FILE}`);

logger.verbose("constants resolved");
