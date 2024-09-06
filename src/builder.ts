import fs from "fs-extra";
import path from "path";
import esbuild, { type BuildOptions } from "esbuild";
import Handlebars from "handlebars";
import deepmerge from "deepmerge";
import { load } from "cheerio";
import { RawSourceMap } from "source-map";
import { minify } from "html-minifier";
import { type Config } from "./config.js";
import {
  PROJECT_ROOT_DIRECTORY,
  DIST_DIRECTORY,
  BUNDLER_TMP_DIRECTORY,
  BUILDER_DOT_DIRECTORY,
  BUNDLER_SERVER_TMP_DIRECTORY,
  SRC_DIRECTORY,
  BUNDLER_SERVER_TMP_SRC_DIRECTORY,
  BUNDLER_CLIENT_TMP_DIRECTORY,
  BUNDLER_CLIENT_TMP_SRC_DIRECTORY,
  BUILDER_TEMPLATES,
  BUNDLER_TMP_DIST_DIRECTORY,
  BUNDLER_TMP_DIST_SOURCE_MAP_PATH,
} from "./constants.js";
import logger from "./logger.js";

function clean() {
  logger.info("Cleaning up before next build");
  fs.removeSync(DIST_DIRECTORY);
  fs.removeSync(BUNDLER_TMP_DIRECTORY);
  logger.info("Clean up completed successfully");
}

function setup() {
  logger.info("Setting up bundler dir");
  fs.mkdirpSync(BUILDER_DOT_DIRECTORY);
  fs.mkdirpSync(BUNDLER_TMP_DIRECTORY);
  logger.info("Setup complete");
}

function processHtml(buildOptions: BuildOptions, node: string): string {
  logger.verbose(`Processing html for node: ${node}`);
  const htmlFilePath = path.resolve(
    BUNDLER_CLIENT_TMP_SRC_DIRECTORY,
    "nodes",
    node,
    "client",
    "index.html",
  );
  logger.verbose(`Loading html from ${htmlFilePath}`);
  const html = fs.readFileSync(htmlFilePath, { encoding: "utf-8" });
  logger.verbose("html file loaded");
  logger.debug(html);
  logger.verbose("parsing html");
  const $ = load(html, null, false);
  logger.verbose("html parsed");
  logger.verbose("Wrapping template with a div");
  const templateContent = $("template").html();
  $("template").replaceWith(`<div id="${node}">${templateContent}</div>`);
  let result = $.html();
  logger.debug(result);
  if (buildOptions.minify) {
    logger.verbose("Minifying html");
    result = minify(result, {
      removeComments: true,
      removeEmptyAttributes: true,
      removeRedundantAttributes: true,
      sortClassName: true,
      sortAttributes: true,
    });
    logger.debug(result);
  }
  return result;
}

async function bundleJavascript(buildOptions: BuildOptions) {
  logger.verbose("Building javascript with the following options");
  logger.debug(JSON.stringify(buildOptions));
  await esbuild.build(buildOptions);
  logger.verbose("javascript built");
}

async function renderServerEntrypoint(nodes: string[]) {
  logger.verbose("Rendering the server entrypoint");
  const template = Handlebars.compile(
    fs.readFileSync(
      path.join(BUILDER_TEMPLATES, "server", "entrypoint.handlebars"),
      "utf-8",
    ),
  );
  logger.verbose("Handlebars template loaded");
  const result = template({
    nodes: nodes.map((node, index) => {
      return {
        name: `Node${index}`,
        id: node,
        path: `./nodes/${node}/server`,
      };
    }),
  });
  logger.verbose("Server entrypoint rendered");
  logger.debug(result);
  return result;
}

function fixServerSourceMapPaths(): void {
  logger.verbose("Updating server sourcemap paths");
  if (fs.existsSync(BUNDLER_TMP_DIST_SOURCE_MAP_PATH)) {
    logger.verbose("Server sourcemap exists");
    const sourceMap: RawSourceMap = JSON.parse(
      fs.readFileSync(BUNDLER_TMP_DIST_SOURCE_MAP_PATH, { encoding: "utf-8" }),
    );

    sourceMap.sources = sourceMap.sources.map((source) => {
      let resolvedPath: string;
      if (source.startsWith("../../../node_modules")) {
        resolvedPath = path.resolve(
          PROJECT_ROOT_DIRECTORY,
          source.replace("../../../", "../"),
        );

        return path.relative(PROJECT_ROOT_DIRECTORY, resolvedPath);
      }

      if (source.startsWith("../server/src")) {
        resolvedPath = path.resolve(
          PROJECT_ROOT_DIRECTORY,
          source.replace("../server", "../"),
        );

        return path.relative(PROJECT_ROOT_DIRECTORY, resolvedPath);
      }

      return source;
    });

    logger.verbose("Server sourcemap paths updated");
    const result = JSON.stringify(sourceMap);
    logger.debug(result);
    logger.verbose("Writting updated server sourcemap to disk");
    fs.writeFileSync(BUNDLER_TMP_DIST_SOURCE_MAP_PATH, result, {
      encoding: "utf-8",
    });
    logger.verbose("Server sourcemap update complete");
  }
}

async function bundleServer(config: Config): Promise<void> {
  logger.info("Bundling server");
  logger.verbose(`Creating dir: ${BUNDLER_SERVER_TMP_DIRECTORY}`);
  fs.mkdirpSync(BUNDLER_SERVER_TMP_DIRECTORY);
  logger.verbose(
    `Copying original source to: ${BUNDLER_SERVER_TMP_SRC_DIRECTORY}`,
  );
  fs.copySync(SRC_DIRECTORY, BUNDLER_SERVER_TMP_SRC_DIRECTORY);

  logger.verbose("Determining nodes that will be bundled");
  const nodes = fs.readdirSync(
    path.resolve(BUNDLER_SERVER_TMP_SRC_DIRECTORY, "nodes"),
  );
  logger.debug(JSON.stringify(nodes));

  const serverEntrypoint = await renderServerEntrypoint(nodes);
  const serverEntrypointPath = path.resolve(
    BUNDLER_SERVER_TMP_SRC_DIRECTORY,
    "index.js",
  );

  logger.verbose("Writting templated server entrypoint to disk");
  fs.writeFileSync(serverEntrypointPath, serverEntrypoint, {
    encoding: "utf-8",
  });

  // NOTE: consumer can declare globals which overwrite env specifics
  const bundleOptions = deepmerge(
    config.build[config.build.environment].server,
    config.build.server,
  );

  const bundlerConfig: BuildOptions = {
    ...bundleOptions,
    entryPoints: [serverEntrypointPath],
    outfile: path.resolve(BUNDLER_TMP_DIST_DIRECTORY, "index.js"),
  };

  logger.verbose("Bundling server javascript");
  await bundleJavascript(bundlerConfig);
  fixServerSourceMapPaths();

  logger.info("Server bundled");
}

async function bundleClient(config: Config): Promise<void> {
  logger.info("Bundling client");
  logger.verbose(`Creating dir: ${BUNDLER_CLIENT_TMP_DIRECTORY}`);
  fs.mkdirpSync(BUNDLER_CLIENT_TMP_DIRECTORY);
  logger.verbose(
    `Copying original source to: ${BUNDLER_CLIENT_TMP_SRC_DIRECTORY}`,
  );
  fs.copySync(SRC_DIRECTORY, BUNDLER_CLIENT_TMP_SRC_DIRECTORY);

  logger.verbose("Determining nodes that will be bundled");
  const nodes = fs.readdirSync(
    path.resolve(BUNDLER_CLIENT_TMP_SRC_DIRECTORY, "nodes"),
  );
  logger.debug(JSON.stringify(nodes));

  logger.verbose("Loading client html handlebars template");
  const template = Handlebars.compile(
    fs.readFileSync(
      path.join(BUILDER_TEMPLATES, "client", "html.handlebars"),
      "utf-8",
    ),
  );

  logger.verbose("Loading client javascript entrypoint handlebars template");
  const entryPointTemplate = Handlebars.compile(
    fs.readFileSync(
      path.join(BUILDER_TEMPLATES, "client", "entrypoint.handlebars"),
      "utf-8",
    ),
  );

  const clientHtmlPath = path.join(BUNDLER_TMP_DIST_DIRECTORY, "index.html");
  for (const node of nodes) {
    logger.verbose(`Processing node: ${node}`);
    const jsOutputPath = path.join(
      BUNDLER_CLIENT_TMP_SRC_DIRECTORY,
      "nodes",
      node,
      "index.js",
    );

    const renderedJsEntrypoint = entryPointTemplate({
      path: "./" + path.join("client", "index.js"),
      type: node,
    });

    fs.writeFileSync(
      path.join(BUNDLER_CLIENT_TMP_SRC_DIRECTORY, "nodes", node, "index.js"),
      renderedJsEntrypoint,
      { encoding: "utf-8" },
    );

    // NOTE: consumer can declare globals which overwrite env specifics
    const bundleOptions = deepmerge(
      config.build[config.build.environment].client,
      config.build.client,
    );
    const bundlerConfig: BuildOptions = {
      ...bundleOptions,
      entryPoints: [
        path.resolve(
          BUNDLER_CLIENT_TMP_SRC_DIRECTORY,
          "nodes",
          node,
          "index.js",
        ),
      ],
      outfile: jsOutputPath,
    };

    logger.verbose("Bundling client javascript");
    await bundleJavascript(bundlerConfig);
    const js = fs.readFileSync(jsOutputPath, { encoding: "utf-8" });

    logger.verbose("Rendering client html");
    const html = processHtml(bundlerConfig, node);
    const renderedClientHtml =
      template({
        type: node,
        html: html.trim(),
        javascript: js.trim(),
      }) + "\n";

    logger.verbose("Writting rendered client html to disk");
    logger.debug(renderedClientHtml);
    fs.appendFileSync(clientHtmlPath, renderedClientHtml, {
      encoding: "utf-8",
    });
    logger.verbose(`Finished processing node: ${node}`);
  }

  if (config.dev.port) {
    logger.verbose(`attach listener script using port ${config.dev.port}`);
    const refreshScriptTemplate = Handlebars.compile(
      fs.readFileSync(
        path.resolve(BUILDER_TEMPLATES, "client", "refresh-script.handlebars"),
        { encoding: "utf-8" },
      ),
    );
    logger.verbose("Rendering client listener script");
    const renderedRefreshScript = refreshScriptTemplate({
      port: config.dev.port,
    });
    logger.verbose("Appending listener script to client final client html");
    logger.debug(renderedRefreshScript);
    fs.appendFileSync(clientHtmlPath, renderedRefreshScript, {
      encoding: "utf-8",
    });
    logger.verbose("Listener script was appended successfully");
  }

  logger.info("Client bundled");
}

async function bundleIcons(): Promise<void> {
  logger.info("Bundling icons");
  logger.verbose("Determining nodes to process");
  const nodes = fs.readdirSync(path.resolve(SRC_DIRECTORY, "nodes"));
  logger.debug(JSON.stringify(nodes));
  const iconsOutput = path.join(BUNDLER_TMP_DIST_DIRECTORY, "icons");
  logger.verbose(`Creating icons output folder: ${iconsOutput}`);
  fs.mkdirpSync(iconsOutput);

  for (const node of nodes) {
    logger.verbose(`Processing node: ${node}`);
    fs.copySync(
      path.resolve(SRC_DIRECTORY, "nodes", node, "client", "icons"),
      iconsOutput,
    );
  }
  logger.info("Icons bundled");
}

async function bundleLocales(): Promise<void> {
  logger.info("Bundling locales");
  logger.verbose("Determining nodes to process");
  const nodes = fs.readdirSync(path.resolve(SRC_DIRECTORY, "nodes"));
  logger.debug(JSON.stringify(nodes));
  const localesOutput = path.join(BUNDLER_TMP_DIST_DIRECTORY, "locales");
  logger.verbose(`Creating locales output folder: ${localesOutput}`);
  fs.mkdirpSync(localesOutput);

  logger.verbose("Loading locales handlebars template");
  const template = Handlebars.compile(
    fs.readFileSync(
      path.join(BUILDER_TEMPLATES, "client", "locale.handlebars"),
      "utf-8",
    ),
  );

  const dictionariesMap = new Map();
  for (const node of nodes) {
    logger.verbose(`Processing node: ${node}`);
    const docs = fs.readdirSync(
      path.resolve(SRC_DIRECTORY, "nodes", node, "client", "i18n", "docs"),
    );

    for (const doc of docs) {
      const language = path.basename(doc, path.extname(doc));
      const localeLanguageOutput = path.join(localesOutput, language);
      fs.mkdirpSync(localeLanguageOutput);
      const html = fs.readFileSync(
        path.join(SRC_DIRECTORY, "nodes", node, "client", "i18n", "docs", doc),
        { encoding: "utf-8" },
      );
      const renderedHtml =
        template({
          type: node,
          html: html.trim(),
        }) + "\n";

      fs.appendFileSync(
        path.join(localeLanguageOutput, "index.html"),
        renderedHtml,
        {
          encoding: "utf-8",
        },
      );
    }

    const dictionaries = fs.readdirSync(
      path.resolve(
        SRC_DIRECTORY,
        "nodes",
        node,
        "client",
        "i18n",
        "dictionaries",
      ),
    );

    for (const dictionary of dictionaries) {
      const language = path.basename(dictionary, path.extname(dictionary));
      const localeLanguageOutput = path.join(localesOutput, language);
      fs.mkdirpSync(localeLanguageOutput);

      if (!dictionariesMap.has(language)) {
        dictionariesMap.set(language, {
          data: {},
          path: localeLanguageOutput,
        });
      }

      const json = JSON.parse(
        fs.readFileSync(
          path.join(
            SRC_DIRECTORY,
            "nodes",
            node,
            "client",
            "i18n",
            "dictionaries",
            dictionary,
          ),
          { encoding: "utf-8" },
        ),
      );

      const current = dictionariesMap.get(language);
      dictionariesMap.set(language, {
        data: deepmerge({ [node]: json }, current.data),
        path: current.path,
      });

      logger.debug(JSON.stringify(Array.from(dictionariesMap)));
    }
  }

  logger.verbose("Finished processing all dictionaries");
  logger.debug(JSON.stringify(Array.from(dictionariesMap)));

  for (const value of dictionariesMap.values()) {
    const dictionaryFilePath = path.join(value.path, "index.json");
    logger.verbose(`Writting dictionary to: ${dictionaryFilePath}`);
    logger.debug(JSON.stringify(value.data));
    fs.writeFileSync(dictionaryFilePath, JSON.stringify(value.data), {
      encoding: "utf-8",
    });
  }
  logger.info("Locales bundled");
}

async function build(config: Config): Promise<void> {
  logger.info("Start build");
  clean();
  setup();
  await Promise.all([
    bundleServer(config),
    bundleClient(config),
    bundleIcons(),
    bundleLocales(),
  ]);
  fs.copySync(BUNDLER_TMP_DIST_DIRECTORY, DIST_DIRECTORY);
  logger.info("End build");
}

export { build };
