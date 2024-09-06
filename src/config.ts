import fs from "fs-extra";
import deepmerge from "deepmerge";
import { lilconfig, type AsyncSearcher, type LilconfigResult } from "lilconfig";
import { type BuildOptions } from "esbuild";
import {
  PROJECT_ROOT_DIRECTORY,
  BUILDER_NAME,
  BUILDER_DEFAULT_NRG_CONFIG,
} from "./constants.js";
import logger from "./logger";

let lilconfigInstance: AsyncSearcher;
let configFilepath: string;

interface Config {
  version: string;
  dev: {
    debug: boolean;
    open: boolean;
    port?: number;
    watch: {
      paths: string[];
    };
  };
  build: {
    environment: "dev" | "prod";
    server: BuildOptions;
    client: BuildOptions;
    dev: {
      server: BuildOptions;
      client: BuildOptions;
    };
    prod: {
      server: BuildOptions;
      client: BuildOptions;
    };
  };
  nodeRed: Record<any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function getLilconfigInstance(): AsyncSearcher {
  if (lilconfigInstance) {
    logger.verbose("Re-using lilconfigInstance");
    return lilconfigInstance;
  }

  logger.verbose("Creating new lilconfigInstance");
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

  logger.verbose("New lilconfigInstance created");

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
    logger.verbose("reloading config");
    nrgConfig = await lilconfigInstance.load(configFilepath);
  } else {
    logger.verbose("loading config");
    nrgConfig = await lilconfigInstance.search();
  }

  if (!nrgConfig) {
    logger.verbose(
      "Throwing exception because it could not locate an nrg config file in the root of your project. Create an nrg file following https://www.npmjs.com/package/lilconfig specifications",
    );
    throw new Error("not an nrg project");
  }

  logger.verbose("nrg config loaded");
  logger.verbose(`nrg config located at: ${nrgConfig.filepath}`);
  logger.debug(JSON.stringify(nrgConfig.config));

  logger.verbose("Reading default nrg config");
  const defaultConfig: Config = JSON.parse(
    fs.readFileSync(BUILDER_DEFAULT_NRG_CONFIG, {
      encoding: "utf-8",
    }),
  );
  logger.verbose("Default nrg config loaded");
  logger.debug(JSON.stringify(defaultConfig));

  const mergedConfig: Config = deepmerge(defaultConfig, nrgConfig.config);
  logger.verbose("merging project's nrg config to default nrg config");
  configFilepath = nrgConfig.filepath;
  logger.debug(JSON.stringify(mergedConfig));

  return {
    filepath: nrgConfig.filepath,
    config: mergedConfig,
  };
}

export { loadConfig, Config };
