import path from "path";
import url from "url";
import { packageDirectorySync } from "pkg-dir";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageDirectory = packageDirectorySync();
if (!packageDirectory) throw new Error("could not locate consumer's directory");

export const BUILDER_NAME: string = "nrg";

export const PROJECT_ROOT_DIRECTORY = packageDirectory;

export const BUILDER_ROOT_DIRECTORY: string = path.resolve(__dirname, "../");
export const BUILDER_SRC_DIRECTORY: string = path.resolve(
  BUILDER_ROOT_DIRECTORY,
  "src",
);
export const BUILDER_DEFAULTS_DIRECTORY: string = path.resolve(
  BUILDER_ROOT_DIRECTORY,
  "defaults",
);
export const BUILDER_DEFAULT_NRG_CONFIG: string = path.resolve(
  BUILDER_DEFAULTS_DIRECTORY,
  "nrg.json",
);
export const BUILDER_TEMPLATES: string = path.resolve(
  BUILDER_ROOT_DIRECTORY,
  "templates",
);
export const BUILDER_DOT_DIRECTORY: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  ".nrg",
);
export const BUNDLER_TMP_DIRECTORY: string = path.resolve(
  BUILDER_DOT_DIRECTORY,
  "tmp",
);
export const BUNDLER_SERVER_TMP_DIRECTORY: string = path.resolve(
  BUNDLER_TMP_DIRECTORY,
  "server",
);
export const BUNDLER_SERVER_TMP_SRC_DIRECTORY: string = path.resolve(
  BUNDLER_SERVER_TMP_DIRECTORY,
  "src",
);
export const BUNDLER_CLIENT_TMP_DIRECTORY: string = path.resolve(
  BUNDLER_TMP_DIRECTORY,
  "client",
);
export const BUNDLER_CLIENT_TMP_SRC_DIRECTORY: string = path.resolve(
  BUNDLER_CLIENT_TMP_DIRECTORY,
  "src",
);

export const BUNDLER_TMP_SRC_DIRECTORY: string = path.resolve(
  BUNDLER_TMP_DIRECTORY,
  "src",
);
export const BUNDLER_TMP_DIST_DIRECTORY: string = path.resolve(
  BUNDLER_TMP_DIRECTORY,
  "dist",
);

export const BUNDLER_TMP_DIST_SOURCE_MAP_PATH: string = path.resolve(
  BUNDLER_TMP_DIST_DIRECTORY,
  "index.js.map",
);

export const SRC_DIRECTORY: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  "src",
);
export const DIST_DIRECTORY: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  "dist",
);

export const NODE_RED_EXECUTABLE: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  "node_modules/.bin/node-red",
);

export const NODE_RED_DIRECTORY: string = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  "node-red",
);

export const NODE_RED_SETTINGS_FILE: string = path.resolve(
  NODE_RED_DIRECTORY,
  "settings.js",
);
