import fs from "fs-extra";
import deepmerge from "deepmerge";
import { lilconfig, type AsyncSearcher, type LilconfigResult } from "lilconfig";
import { BuildOptions } from "esbuild";
import {
  PROJECT_ROOT_DIRECTORY,
  BUILDER_NAME,
  BUILDER_DEFAULT_NRG_CONFIG,
} from "./constants.js";

let lilconfigInstance: AsyncSearcher;
let configFilepath: string;

interface Config {
  version: string;
  debug: boolean;
  watch: {
    port?: number;
    paths: string[];
  };
  build: {
    server: BuildOptions;
    client: BuildOptions;
  };
  nodeRed: Record<any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function getLilconfigInstance(): AsyncSearcher {
  if (lilconfigInstance) {
    return lilconfigInstance;
  }

  lilconfigInstance = lilconfig(BUILDER_NAME, {
    searchPlaces: [
      "package.json",
      `.${BUILDER_NAME}rc.json`,
      `${BUILDER_NAME}.config.js`,
      `${BUILDER_NAME}.config.cjs`,
      `${BUILDER_NAME}.config.mjs`,
    ],
    stopDir: PROJECT_ROOT_DIRECTORY,
    cache: false,
  });

  return lilconfigInstance;
}

// TODO: define schema, parse, verify version
async function loadConfig(): Promise<{
  filepath: string;
  config: Config;
}> {
  const lilconfigInstance = getLilconfigInstance();

  let nrgConfig: LilconfigResult;
  if (configFilepath) {
    nrgConfig = await lilconfigInstance.load(configFilepath);
  } else {
    nrgConfig = await lilconfigInstance.search();
  }

  if (!nrgConfig) throw new Error("not an nrg project");

  const defaultConfig: Config = JSON.parse(
    fs.readFileSync(BUILDER_DEFAULT_NRG_CONFIG, {
      encoding: "utf-8",
    }),
  );

  const mergedConfig: Config = deepmerge(defaultConfig, nrgConfig.config);
  configFilepath = nrgConfig.filepath;
  return {
    filepath: nrgConfig.filepath,
    config: mergedConfig,
  };
}

export { loadConfig, Config };
