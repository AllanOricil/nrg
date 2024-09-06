import { type ChildProcess } from "child_process";
import logger from "./logger";

async function killSpawnedProcess(process: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process || typeof process.kill !== "function" || process.killed) {
      logger.verbose("No process to be killed");
      return resolve();
    }

    logger.verbose("Attempting to kill spawned process.");

    try {
      process.kill("SIGTERM");

      const killTimeout = setTimeout(() => {
        if (!process.killed) {
          logger.verbose(
            "Process did not terminate gracefully. Sending SIGKILL.",
          );
          try {
            process.kill("SIGKILL");
          } catch (error) {
            logger.error(`Failed to forcefully kill process: ${error.message}`);
            logger.error(`Stack trace: ${error.stack}`);

            return reject(`Failed to forcefully kill process: ${error}`);
          }
        }
      }, 5000);

      process.on("exit", (code, signal) => {
        logger.verbose(`Process exited with code ${code}, signal ${signal}`);
        clearTimeout(killTimeout);
        resolve();
      });

      process.on("error", (error) => {
        logger.error(`Process error: ${error}`);
        clearTimeout(killTimeout);
        reject(`Process error: ${error}`);
      });
    } catch (error) {
      logger.error(`Failed to kill process: ${error.message}`);
      logger.error(error.stack);

      reject(`Failed to kill process: ${error}`);
    }
  });
}

export { killSpawnedProcess };
