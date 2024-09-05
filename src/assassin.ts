import { type ChildProcess } from "child_process";

async function killSpawnedProcess(process: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process || typeof process.kill !== "function" || process.killed) {
      console.log("Invalid or already killed process. Cannot kill.");
      return resolve();
    }

    console.log("Attempting to kill spawned process...");

    try {
      process.kill("SIGTERM");

      const killTimeout = setTimeout(() => {
        if (!process.killed) {
          console.log(
            "Process did not terminate gracefully. Sending SIGKILL...",
          );
          try {
            process.kill("SIGKILL");
          } catch (killError) {
            return reject(`Failed to forcefully kill process: ${killError}`);
          }
        }
      }, 5000);

      process.on("exit", (code, signal) => {
        console.log(`Process exited with code ${code}, signal ${signal}`);
        clearTimeout(killTimeout);
        resolve();
      });

      process.on("error", (err) => {
        clearTimeout(killTimeout);
        reject(`Process error: ${err}`);
      });
    } catch (err) {
      reject(`Failed to kill process: ${err}`);
    }
  });
}

export { killSpawnedProcess };
