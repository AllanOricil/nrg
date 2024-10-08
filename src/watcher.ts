import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { build } from "./builder.js";
import { loadConfig } from "./config.js";
import { startNodeRed } from "./node-red-runner.js";
import { startListener } from "./listener.js";
import { type Config } from "./config.js";
import logger from "./logger";

async function startWatcher(
  config: Config,
  configFilepath: string,
): Promise<void> {
  logger.verbose("Starting watcher");
  let debounceTimeout: NodeJS.Timeout;
  let _config = config;
  const onChange = async (
    eventType: string | null,
    filename: string | Buffer | null,
  ) => {
    if (filename) {
      logger.debug(
        `Watcher determined the following file was changed: ${filename}`,
      );
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        try {
          logger.info("Rebuilding nodes and restarting Node-RED");
          if (filename === path.basename(configFilepath)) {
            logger.verbose(
              "Reloading config file because it was changed while in watch mode",
            );
            const { config } = await loadConfig();
            _config = config;
            logger.verbose("New config file loaded while in watch mode");
            logger.debug(JSON.stringify(_config));
          }
          const { port, listener } = await startListener(_config);
          _config.dev.port = port;
          await build(_config);
          await startNodeRed(_config, listener);
        } catch (error) {
          if (error instanceof Error) {
            logger.info(chalk.red(error.message));
            if (error.stack) logger.info(chalk.white(error.stack));
          } else {
            logger.info(chalk.red("Unknown error occurred."));
          }
        }
      }, 300);
    }
  };

  config.dev.watch.paths.forEach((path) => {
    if (fs.existsSync(path)) {
      logger.verbose(`Adding watcher to the following file: ${path}`);
      fs.watch(path, { recursive: true }, onChange);
    }
  });

  logger.verbose("Watcher initialization is complete");
}

export { startWatcher };
