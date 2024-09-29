import fs from "fs-extra";
import path from "path";
import esbuild, { type BuildOptions } from "esbuild";
import Handlebars from "handlebars";
import deepmerge from "deepmerge";
import { load } from "cheerio";
import { RawSourceMap } from "source-map";
import { minify } from "html-minifier";
import { glob } from "glob";
import postcss from "postcss";
import prefixSelector from "postcss-prefix-selector";
// @ts-expect-error does not have types, and community has also not created types for this package
import postcssSass from "@csstools/postcss-sass";
import postcssScssParser from "postcss-scss";
import autoprefixer from "autoprefixer";

// NOTE: was not able to make @csstoll/postcss-sass work with .sass file extension => dart-sass@v1.178.0
// import postcssSassParser from "postcss-sass";
import cssnano from "cssnano";

import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";

import { type Config } from "./config.js";
import {
  PROJECT_ROOT_DIRECTORY,
  SRC_DIRECTORY,
  DIST_DIRECTORY,
  BUILDER_SERVER_TMP_DIRECTORY,
  BUILDER_TMP_DIRECTORY,
  BUILDER_DOT_DIRECTORY,
  BUILDER_TMP_DIST_DIRECTORY,
  BUILDER_TMP_DIST_SOURCE_MAP_PATH,
  BUILDER_SERVER_TMP_SRC_DIRECTORY,
  BUILDER_CLIENT_TMP_DIRECTORY,
  BUILDER_CLIENT_TMP_SRC_DIRECTORY,
  BUILDER_TEMPLATES,
  BUILDER_ALLOWED_STYLE_SHEETS_FILE_EXTENSIONS,
  BUILDER_ALLOWED_ICONS_FILE_EXTENSIONS,
  BUILDER_NODE_ICONS_FOLDER_NAME,
  BUILDER_NODE_LOCALES_FOLDER_NAME,
  BUILDER_NODE_LOCALES_DOCS_FOLDER_NAME,
  BUILDER_NODE_LOCALES_LABELS_FOLDER_NAME,
  BUILDER_NODE_CLIENT_FOLDER_NAME,
  BUILDER_NODE_SERVER_FOLDER_NAME,
} from "./constants.js";
import logger from "./logger.js";

function clean() {
  logger.info("Cleaning up before next build");
  fs.removeSync(DIST_DIRECTORY);
  fs.removeSync(BUILDER_TMP_DIRECTORY);
  logger.info("Clean up completed successfully");
}

function setup() {
  logger.info("Setting up bundler dir");
  fs.mkdirpSync(BUILDER_DOT_DIRECTORY);
  fs.mkdirpSync(BUILDER_TMP_DIRECTORY);
  logger.info("Setup complete");
}

function fetchNodeCategory(node: string) {
  const clientJsPath = path.resolve(
    BUILDER_CLIENT_TMP_SRC_DIRECTORY,
    "nodes",
    node,
    BUILDER_NODE_CLIENT_FOLDER_NAME,
    "index.js",
  );
  const clientJsModule = fs.readFileSync(clientJsPath, { encoding: "utf-8" });
  const ast = acorn.parse(clientJsModule, {
    sourceType: "module",
    ecmaVersion: "latest",
  });

  let category: string = "";
  acornWalk.simple(ast, {
    ExportDefaultDeclaration(node) {
      if (node.declaration.type === "ObjectExpression") {
        node.declaration.properties.forEach((prop) => {
          if (prop.type === "Property" && prop.key.type === "Identifier") {
            if (prop.key.name === "category") {
              if (
                prop.value.type === "Literal" &&
                typeof prop.value.value === "string"
              ) {
                category = prop.value.value;
              } else {
                console.log("Category is not a simple literal:", prop.value);
              }
            }
          }
        });
      }
    },
  });
  if (!category) {
    throw new Error(
      "Could not identify the node's category. Please, add category attribute in the node's client javascript.",
    );
  }
  return category;
}

// TODO: investigate if this could be improved if implemented with cherio parser
async function replaceCustomHtmlAttributes(html: string, node: string) {
  const category = fetchNodeCategory(node);
  const inputPrefix =
    category === "config" ? "node-config-input" : "node-input";

  const pattern =
    /(?:\s*(i18n:([a-zA-Z0-9_-]*))\s*=\s*"([^"]*)")|(?:\s*(id|for)\s*:=\s*"([^"]*)")/g;

  const updatedHtml = html.replace(
    /<([a-zA-Z][a-zA-Z0-9-_]*)\s*([^>]*)\/?>/gi,
    (elementMatch: string, tagName: string, tagAttributes: string) => {
      const i18nAttributes: string[] = [];
      let newAttributes = tagAttributes;

      newAttributes = newAttributes.replace(
        pattern,
        (
          match: string,
          i18nAttr: string,
          i18nModifier: string,
          i18nValue: string,
          attrName: string,
          attrValue: string,
        ) => {
          if (i18nAttr) {
            i18nAttributes.push(
              i18nModifier
                ? `[${i18nModifier}]${node}.${i18nValue}`
                : `${node}.${i18nValue}`,
            );
            return "";
          } else if (attrName) {
            const newValue = `${inputPrefix}-${attrValue}`;
            return `${attrName}="${newValue}"`;
          }
          return match;
        },
      );

      if (i18nAttributes.length > 0) {
        const dataI18nAttr = `data-i18n="${i18nAttributes.join(";")}"`;
        return `<${tagName} ${newAttributes} ${dataI18nAttr}>`;
      }

      return `<${tagName} ${newAttributes}>`;
    },
  );

  return updatedHtml;
}

// TODO: validate html elements based on Node-RED's schema for an element, and throw an error in case there is something wrong.
async function processHtml(
  buildOptions: BuildOptions,
  node: string,
): Promise<string> {
  logger.verbose(`Processing html for node: ${node}`);
  const htmlFilePath = path.resolve(
    BUILDER_CLIENT_TMP_SRC_DIRECTORY,
    "nodes",
    node,
    BUILDER_NODE_CLIENT_FOLDER_NAME,
    "index.html",
  );
  logger.verbose(`Loading html from ${htmlFilePath}`);
  let html = fs.readFileSync(htmlFilePath, { encoding: "utf-8" });
  logger.verbose("html file loaded");
  logger.debug(html);
  logger.verbose("replacing custom html attributes");
  html = await replaceCustomHtmlAttributes(html, node);
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

async function processStylesheets(
  buildOptions: BuildOptions,
  node: string,
): Promise<string[] | undefined> {
  logger.verbose(`Processing stylesheets for node: ${node}`);

  const cssStylesheetDirectory = path.resolve(
    SRC_DIRECTORY,
    "nodes",
    node,
    BUILDER_NODE_CLIENT_FOLDER_NAME,
  );

  const stylesheetFilepaths = await glob(
    `${cssStylesheetDirectory}/**/*.{${BUILDER_ALLOWED_STYLE_SHEETS_FILE_EXTENSIONS.join(",")}}`,
  );

  if (stylesheetFilepaths.length === 0) {
    logger.verbose("No .css or .scss files found to process");
    return;
  }

  // TODO: avoid reprocessing .scss stylesheets that were already imported with @import
  const processedStylesheets = [];
  for (const stylesheetFilepath of stylesheetFilepaths) {
    logger.verbose(`Loading stylesheet ${stylesheetFilepath}`);
    const stylesheet = await fs.readFile(stylesheetFilepath, {
      encoding: "utf-8",
    });
    logger.verbose("Stylesheet file loaded");
    logger.debug(stylesheet);

    const plugins: postcss.AcceptedPlugin[] = [
      ...(stylesheetFilepath.endsWith(".scss") ? [postcssSass()] : []),
      prefixSelector({ prefix: `#${node}` }),
      ...(buildOptions.minify ? [cssnano({ preset: "default" })] : []),
      autoprefixer(),
    ];

    const { css, map } = await postcss(plugins).process(stylesheet, {
      from: stylesheetFilepath,
      ...(stylesheetFilepath.endsWith(".scss")
        ? { syntax: postcssScssParser }
        : {}),
      ...(buildOptions.sourcemap
        ? { map: { inline: false, prev: false } }
        : {}),
    });

    logger.verbose("Stylesheet processed");
    logger.debug(css);

    if (map && buildOptions.sourcemap) {
      logger.verbose("Adding sourcemap");
      logger.debug(`Original: ${map}`);
      const mapJson = map.toJSON();

      // NOTE: I'm processing sourcemap to remove intermidiate sourcemaps. I only need the original source
      mapJson.sources.splice(1, 2);
      mapJson.sourcesContent?.splice(1, 2);

      const mapJsonString = JSON.stringify(mapJson);
      logger.debug(`Modified: ${mapJsonString}`);
      const mapBase64String = Buffer.from(mapJsonString).toString("base64");
      logger.debug(mapBase64String);

      processedStylesheets.push(
        `${css}\n/*# sourceMappingURL=data:application/json;base64,${mapBase64String} */`,
      );
    } else {
      processedStylesheets.push(css);
    }
  }

  return processedStylesheets;
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
      path.join(
        BUILDER_TEMPLATES,
        BUILDER_NODE_SERVER_FOLDER_NAME,
        "entrypoint.handlebars",
      ),
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

function fixServerJavascriptSourceMapPaths(): void {
  logger.verbose("Updating server sourcemap paths");
  if (fs.existsSync(BUILDER_TMP_DIST_SOURCE_MAP_PATH)) {
    logger.verbose("Server sourcemap exists");
    const sourceMap: RawSourceMap = JSON.parse(
      fs.readFileSync(BUILDER_TMP_DIST_SOURCE_MAP_PATH, { encoding: "utf-8" }),
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
    fs.writeFileSync(BUILDER_TMP_DIST_SOURCE_MAP_PATH, result, {
      encoding: "utf-8",
    });
    logger.verbose("Server sourcemap update complete");
  }
}

async function bundleServer(config: Config): Promise<void> {
  logger.info("Bundling server");
  logger.verbose(`Creating dir: ${BUILDER_SERVER_TMP_DIRECTORY}`);
  fs.mkdirpSync(BUILDER_SERVER_TMP_DIRECTORY);
  logger.verbose(
    `Copying original source to: ${BUILDER_SERVER_TMP_SRC_DIRECTORY}`,
  );
  fs.copySync(SRC_DIRECTORY, BUILDER_SERVER_TMP_SRC_DIRECTORY);

  logger.verbose("Determining nodes that will be bundled");
  const nodes = fs.readdirSync(
    path.resolve(BUILDER_SERVER_TMP_SRC_DIRECTORY, "nodes"),
  );
  logger.debug(JSON.stringify(nodes));

  const serverEntrypoint = await renderServerEntrypoint(nodes);
  const serverEntrypointPath = path.resolve(
    BUILDER_SERVER_TMP_SRC_DIRECTORY,
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
    outfile: path.resolve(BUILDER_TMP_DIST_DIRECTORY, "index.js"),
  };

  logger.verbose("Bundling server javascript");
  await bundleJavascript(bundlerConfig);
  fixServerJavascriptSourceMapPaths();

  logger.info("Server bundled");
}

async function bundleClient(config: Config): Promise<void> {
  logger.info("Bundling client");
  logger.verbose(`Creating dir: ${BUILDER_CLIENT_TMP_DIRECTORY}`);
  fs.mkdirpSync(BUILDER_CLIENT_TMP_DIRECTORY);
  logger.verbose(
    `Copying original source to: ${BUILDER_CLIENT_TMP_SRC_DIRECTORY}`,
  );
  fs.copySync(SRC_DIRECTORY, BUILDER_CLIENT_TMP_SRC_DIRECTORY);

  logger.verbose("Determining nodes that will be bundled");
  const nodes = fs.readdirSync(
    path.resolve(BUILDER_CLIENT_TMP_SRC_DIRECTORY, "nodes"),
  );
  logger.debug(JSON.stringify(nodes));

  logger.verbose("Loading client html handlebars template");
  const template = Handlebars.compile(
    fs.readFileSync(
      path.join(
        BUILDER_TEMPLATES,
        BUILDER_NODE_CLIENT_FOLDER_NAME,
        "html.handlebars",
      ),
      "utf-8",
    ),
  );

  logger.verbose("Loading client javascript entrypoint handlebars template");
  const entryPointTemplate = Handlebars.compile(
    fs.readFileSync(
      path.join(
        BUILDER_TEMPLATES,
        BUILDER_NODE_CLIENT_FOLDER_NAME,
        "entrypoint.handlebars",
      ),
      "utf-8",
    ),
  );

  const clientHtmlPath = path.join(BUILDER_TMP_DIST_DIRECTORY, "index.html");
  for (const node of nodes) {
    logger.verbose(`Processing node: ${node}`);
    const jsOutputPath = path.join(
      BUILDER_CLIENT_TMP_SRC_DIRECTORY,
      "nodes",
      node,
      "index.js",
    );

    // NOTE: make this path using path and posix
    const nodeClientEntrypointPath =
      "./" + BUILDER_NODE_CLIENT_FOLDER_NAME + "/index.js";
    logger.verbose(`RENDERED JS PATH: ${nodeClientEntrypointPath}`);
    const renderedJsEntrypoint = entryPointTemplate({
      path: nodeClientEntrypointPath,
      type: node,
    });

    fs.writeFileSync(
      path.join(BUILDER_CLIENT_TMP_SRC_DIRECTORY, "nodes", node, "index.js"),
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
          BUILDER_CLIENT_TMP_SRC_DIRECTORY,
          "nodes",
          node,
          "index.js",
        ),
      ],
      outfile: jsOutputPath,
    };

    logger.verbose("Bundling client javascript");
    await bundleJavascript(bundlerConfig);

    logger.verbose("Rendering client form");
    const html = await processHtml(bundlerConfig, node);

    logger.verbose("Rendering client stylesheets");
    const stylesheets = await processStylesheets(bundlerConfig, node);

    logger.verbose("Loading rendered client javascript from disk");
    const js = fs.readFileSync(jsOutputPath, { encoding: "utf-8" });

    logger.verbose("Rendering client html");
    const renderedClientHtml = template({
      type: node,
      html: html.trim(),
      javascript: js.trim(),
      stylesheets: stylesheets,
    });

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
        path.resolve(
          BUILDER_TEMPLATES,
          BUILDER_NODE_CLIENT_FOLDER_NAME,
          "refresh-script.handlebars",
        ),
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
  const iconsOutput = path.join(
    BUILDER_TMP_DIST_DIRECTORY,
    BUILDER_NODE_ICONS_FOLDER_NAME,
  );
  logger.verbose(`Creating icons output folder: ${iconsOutput}`);
  fs.mkdirpSync(iconsOutput);

  for (const node of nodes) {
    logger.verbose(`Processing node: ${node}`);
    const nodeIconsDirectory = path.resolve(
      SRC_DIRECTORY,
      "nodes",
      node,
      BUILDER_NODE_CLIENT_FOLDER_NAME,
      BUILDER_NODE_ICONS_FOLDER_NAME,
    );
    const nodeIconsDirectoryFilepaths = await glob(
      `${nodeIconsDirectory}/*.{${BUILDER_ALLOWED_ICONS_FILE_EXTENSIONS.join(",")}}`,
    );
    logger.debug(JSON.stringify(nodeIconsDirectoryFilepaths));
    if (nodeIconsDirectoryFilepaths.length) {
      fs.copySync(
        path.resolve(
          SRC_DIRECTORY,
          "nodes",
          node,
          BUILDER_NODE_CLIENT_FOLDER_NAME,
          BUILDER_NODE_ICONS_FOLDER_NAME,
        ),
        iconsOutput,
      );
    }
  }
  logger.info("Icons bundled");
}

async function bundleLocales(): Promise<void> {
  logger.info("Bundling locales");
  logger.verbose("Determining nodes to process");
  const nodes = fs.readdirSync(path.resolve(SRC_DIRECTORY, "nodes"));
  logger.debug(JSON.stringify(nodes));
  const localesOutput = path.join(
    BUILDER_TMP_DIST_DIRECTORY,
    BUILDER_NODE_LOCALES_FOLDER_NAME,
  );
  logger.verbose(`Creating locales output folder: ${localesOutput}`);
  fs.mkdirpSync(localesOutput);

  logger.verbose("Loading locales handlebars template");
  const template = Handlebars.compile(
    fs.readFileSync(
      path.join(
        BUILDER_TEMPLATES,
        BUILDER_NODE_CLIENT_FOLDER_NAME,
        "locale.handlebars",
      ),
      "utf-8",
    ),
  );

  const labelsMap = new Map();
  for (const node of nodes) {
    logger.verbose(`Processing node: ${node}`);

    logger.verbose("Starting to process docs");
    const nodeDocsDirectory = path.resolve(
      SRC_DIRECTORY,
      "nodes",
      node,
      BUILDER_NODE_CLIENT_FOLDER_NAME,
      BUILDER_NODE_LOCALES_FOLDER_NAME,
      BUILDER_NODE_LOCALES_DOCS_FOLDER_NAME,
    );

    const nodeDocsFilepaths = await glob(`${nodeDocsDirectory}/*.html`);
    logger.debug(nodeDocsFilepaths);

    for (const nodeDocFilepath of nodeDocsFilepaths) {
      logger.verbose(`Processing file: ${nodeDocFilepath}`);
      const language = path.basename(
        nodeDocFilepath,
        path.extname(nodeDocFilepath),
      );
      const localeLanguageOutput = path.join(localesOutput, language);
      fs.mkdirpSync(localeLanguageOutput);
      const html = fs.readFileSync(nodeDocFilepath, { encoding: "utf-8" });
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

    logger.verbose("Starting to process labels");
    const nodeLabelsDirectory = path.resolve(
      SRC_DIRECTORY,
      "nodes",
      node,
      BUILDER_NODE_CLIENT_FOLDER_NAME,
      BUILDER_NODE_LOCALES_FOLDER_NAME,
      BUILDER_NODE_LOCALES_LABELS_FOLDER_NAME,
    );

    const nodeLabelsFilepaths = await glob(`${nodeLabelsDirectory}/*.json`);
    logger.debug(nodeLabelsFilepaths);

    for (const nodeLabelFilepath of nodeLabelsFilepaths) {
      logger.verbose(`Processing file: ${nodeLabelFilepath}`);
      const language = path.basename(
        nodeLabelFilepath,
        path.extname(nodeLabelFilepath),
      );
      const localeLanguageOutput = path.join(localesOutput, language);
      fs.mkdirpSync(localeLanguageOutput);

      if (!labelsMap.has(language)) {
        labelsMap.set(language, {
          data: {},
          path: localeLanguageOutput,
        });
      }

      const json = JSON.parse(
        fs.readFileSync(nodeLabelFilepath, { encoding: "utf-8" }),
      );

      const current = labelsMap.get(language);
      labelsMap.set(language, {
        data: deepmerge({ [node]: json }, current.data),
        path: current.path,
      });

      logger.debug(JSON.stringify(Array.from(labelsMap)));
    }
  }

  logger.verbose("Finished processing all labels");
  logger.debug(JSON.stringify(Array.from(labelsMap)));

  for (const value of labelsMap.values()) {
    const labelFilePath = path.join(value.path, "index.json");
    logger.verbose(`Writting label to: ${labelFilePath}`);
    logger.debug(JSON.stringify(value.data));
    fs.writeFileSync(labelFilePath, JSON.stringify(value.data), {
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
  fs.copySync(BUILDER_TMP_DIST_DIRECTORY, DIST_DIRECTORY);
  logger.info("End build");
}

export { build };
