import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import logger from "../src/logger";
import { build } from "../src/builder";
import { loadConfig } from "../src/config";
import { startNodeRed } from "../src/node-red-runner";
import { startListener } from "../src/listener";
import { startWatcher } from "../src/watcher";

vi.mock("fs-extra");
vi.mock("../src/builder");
vi.mock("../src/config");
vi.mock("../src/node-red-runner");
vi.mock("../src/listener");
vi.mock("../src/logger");

describe("startWatcher", () => {
  const config = {
    dev: {
      watch: {
        paths: ["path/to/watch1", "path/to/watch2"],
      },
      port: 3000,
    },
  };
  const newConfig = {
    dev: {
      watch: {
        paths: ["new/path"],
      },
      port: 3001,
    },
  };
  const configFilepath = "path/to/config.json";

  beforeEach(() => {
    vi.useFakeTimers();

    (fs.existsSync as vi.Mock).mockReturnValue(true);
    (fs.watch as vi.Mock).mockImplementation(() => {});

    (loadConfig as vi.Mock)
      .mockResolvedValue({ config })
      .mockResolvedValue({ config: newConfig });
    (build as vi.Mock).mockResolvedValue(undefined);
    (startNodeRed as vi.Mock).mockResolvedValue(undefined);
    (startListener as vi.Mock).mockResolvedValue({ port: 3000, listener: {} });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it("should initialize watchers on the provided paths", async () => {
    await startWatcher(config, configFilepath);

    expect(fs.watch).toHaveBeenCalledTimes(2);
    expect(fs.watch).toHaveBeenCalledWith(
      "path/to/watch1",
      { recursive: true },
      expect.any(Function),
    );
    expect(fs.watch).toHaveBeenCalledWith(
      "path/to/watch2",
      { recursive: true },
      expect.any(Function),
    );
    expect(logger.verbose).toHaveBeenCalledWith(
      "Adding watcher to the following file: path/to/watch1",
    );
    expect(logger.verbose).toHaveBeenCalledWith(
      "Adding watcher to the following file: path/to/watch2",
    );
  });

  it("should handle file changes", async () => {
    const mockWatcherCallback = vi.fn();
    (fs.watch as vi.Mock).mockImplementation((_path, _options, callback) => {
      mockWatcherCallback.mockImplementation(callback);
    });

    await startWatcher(config, configFilepath);

    expect(fs.watch).toHaveBeenCalled();
    expect(mockWatcherCallback).not.toHaveBeenCalled();

    // NOTE: simulate a file change
    const callback = (fs.watch as vi.Mock).mock.calls[0][2];
    callback("change", "somefile.js");

    // NOTE: pass some time because of debounce
    vi.runAllTimers();
    // NOTE: wait all promises to be executed
    await new Promise(process.nextTick);

    expect(logger.info).toHaveBeenCalledWith(
      "Rebuilding nodes and restarting Node-RED",
    );
    expect(build).toHaveBeenCalled();
    expect(startNodeRed).toHaveBeenCalled();
    expect(startListener).toHaveBeenCalled();
  });

  it("should reload the config if the config file itself changes", async () => {
    await startWatcher(config, configFilepath);

    const callback = (fs.watch as vi.Mock).mock.calls[0][2];
    callback("change", path.basename(configFilepath));

    // NOTE: pass some time because of debounce
    vi.runAllTimers();
    // NOTE: wait all promises to be executed
    await new Promise(process.nextTick);

    expect(logger.verbose).toHaveBeenCalledWith(
      "Reloading config file because it was changed while in watch mode",
    );
    expect(loadConfig).toHaveBeenCalled();
    expect(logger.verbose).toHaveBeenCalledWith(
      "New config file loaded while in watch mode",
    );
    expect(startListener).toHaveBeenCalledWith(newConfig);
  });

  it("should debounce multiple file changes", async () => {
    await startWatcher(config, configFilepath);

    const callback = (fs.watch as vi.Mock).mock.calls[0][2];

    callback("change", "somefile1.js");
    callback("change", "somefile2.js");

    // NOTE: pass some time because of debounce
    vi.runAllTimers();
    // NOTE: wait all promises to be executed
    await new Promise(process.nextTick);

    expect(logger.info).toHaveBeenCalledWith(
      "Rebuilding nodes and restarting Node-RED",
    );
    expect(build).toHaveBeenCalledTimes(1);
    expect(startNodeRed).toHaveBeenCalledTimes(1);
  });

  it("should handle build exceptions", async () => {
    // NOTE: Mock an error being thrown by the build function
    const mockError = new Error("Mocked build error");
    (build as vi.Mock).mockRejectedValue(mockError);

    await startWatcher(config, configFilepath);

    const callback = (fs.watch as vi.Mock).mock.calls[0][2];
    callback("change", "somefile.js");

    // NOTE: pass some time because of debounce
    vi.runAllTimers();
    // NOTE: wait all promises to be executed
    await new Promise(process.nextTick);

    expect(logger.info).toHaveBeenCalledWith(chalk.red(mockError.message));
    expect(logger.info).toHaveBeenCalledWith(chalk.white(mockError.stack));
  });
});
