import fs from "fs-extra";
import { spawn, type ChildProcess } from "child_process";
import deepmerge from "deepmerge";
import detectPort from "detect-port";
import { killSpawnedProcess } from "./assassin";
import { type Config } from "./config.js";
import WebSocket from "ws";
import open from "open";
import {
  PROJECT_ROOT_DIRECTORY,
  NODE_RED_EXECUTABLE,
  NODE_RED_SETTINGS_FILE,
  NODE_RED_DIRECTORY,
} from "./constants.js";
import logger from "./logger";

let nodeRedProcess: ChildProcess;
function setupNodeRedDirectory(config: Config) {
  logger.info(`Creating Node-RED user directory at: ${NODE_RED_DIRECTORY}`);
  if (!fs.existsSync(NODE_RED_DIRECTORY)) {
    fs.mkdirSync(NODE_RED_DIRECTORY, { recursive: true });
  }
  logger.info("Node-RED user directory created");

  logger.verbose(
    "Setting up userDir and nodesDir in Node-RED's setting file that is going to be written",
  );
  const nodeRedSettings = deepmerge(config.nodeRed || {}, {
    userDir: NODE_RED_DIRECTORY,
    nodesDir: PROJECT_ROOT_DIRECTORY,
  });
  logger.verbose("Properties updated successfully");
  const settinsFileData = `module.exports = ${JSON.stringify(nodeRedSettings, null, 2)}`;
  logger.info(`Creating Node-RED settings file at: ${NODE_RED_SETTINGS_FILE}`);
  logger.debug(settinsFileData);
  fs.writeFileSync(NODE_RED_SETTINGS_FILE, settinsFileData, {
    encoding: "utf-8",
  });
  logger.info("Node-RED settings file created");
}

function buildCommand(debug: boolean) {
  logger.verbose("Creating command to launch Node-RED");
  const args = [
    ...(debug ? ["--inspect"] : []),
    NODE_RED_EXECUTABLE,
    "--settings",
    NODE_RED_SETTINGS_FILE,
  ];

  logger.verbose(`Resulting arguments: ${args.join(" ")}`);

  return {
    executable: "node",
    args,
  };
}

async function startNodeRed(config: Config, listener: WebSocket.Server) {
  logger.info("Starting Node-RED");

  if (nodeRedProcess) {
    logger.info("Stopping Node-RED current process");
    await killSpawnedProcess(nodeRedProcess);
  }

  const port = await detectPort(config.nodeRed.uiPort);
  if (port !== config.nodeRed.uiPort) {
    console.log(
      `port ${config.nodeRed.uiPort} already in use. New port assgined: ${port}`,
    );
    config.nodeRed.uiPort = port;
  }

  setupNodeRedDirectory(config);

  logger.info(`Launching Node-RED using port: ${port}`);
  const { executable, args } = buildCommand(config.dev.debug);
  nodeRedProcess = spawn(executable, args);
  if (nodeRedProcess) {
    nodeRedProcess.stdout?.on("data", async (data) => {
      const message = data.toString().trim();
      logger.info(`\x1b[32m[Node-RED]\x1b[0m ${message}`);

      if (data.includes(`Server now running at http://127.0.0.1:${port}/`)) {
        listener.clients?.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            logger.verbose("Sending refresh signal to the browser");
            client.send("refresh");
          }
        });

        if (config.dev.open && !listener.clients.size) {
          logger.info(`Opening http://127.0.0.1:${port}`);
          await open(`http://127.0.0.1:${port}`);
        }
      }
    });

    nodeRedProcess.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      if (
        message.includes("Debugger attached") ||
        message.includes("Debugger ending")
      ) {
        logger.info(`Debugging info: ${message}`);
      } else {
        logger.error(`\x1b[32m[Node-RED]\x1b[0m Error: ${message}`);
      }
    });
  }
}

export { startNodeRed };
