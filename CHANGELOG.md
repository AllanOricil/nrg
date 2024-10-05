## [1.2.5](https://github.com/AllanOricil/nrg/compare/v1.2.4...v1.2.5) (2024-10-05)


### Bug Fixes

* build exceptions during watch mode won't kill the process anymore ([080352e](https://github.com/AllanOricil/nrg/commit/080352ec310315fd34bb3500fc5d5660ef30c290))

## [1.2.4](https://github.com/AllanOricil/nrg/compare/v1.2.3...v1.2.4) (2024-10-01)


### Bug Fixes

* **vulnerability:** body-parser vulnerable to denial of service when url encoding is enabled ([c8ad9fb](https://github.com/AllanOricil/nrg/commit/c8ad9fb36b3ef8b7c33420745395ff00be3ab0e3))
* **vulnerability:** fix DOM Clobbering Gadget found in rollup bundled scripts that leads to XSS ([214aeec](https://github.com/AllanOricil/nrg/commit/214aeecc0f6365765f57a91511deaf836359785d))
* **vulnerability:** kangax html-minifier REDoS vulnerability ([e4d3007](https://github.com/AllanOricil/nrg/commit/e4d3007768018a810b6dc4ca14e390034b9d7785))
* **vulnerability:** vite DOM Clobbering gadget found in vite bundled scripts that leads to XSS ([c0b3b63](https://github.com/AllanOricil/nrg/commit/c0b3b63d42111b5af4693d6b7791dd12cf918d46))

## [1.2.3](https://github.com/AllanOricil/nrg/compare/v1.2.2...v1.2.3) (2024-09-29)


### Bug Fixes

* windows can't start node-red when using bash ([7704825](https://github.com/AllanOricil/nrg/commit/7704825b295c96305c3c9efe7348a5a703fa8768))

## [1.2.2](https://github.com/AllanOricil/nrg/compare/v1.2.1...v1.2.2) (2024-09-29)


### Bug Fixes

* change log level verbose because this message is for debugging purposes only ([40a949a](https://github.com/AllanOricil/nrg/commit/40a949a78705f7cf8c80e9f2936b68dbac017033))

## [1.2.1](https://github.com/AllanOricil/nrg/compare/v1.2.0...v1.2.1) (2024-09-29)


### Bug Fixes

* error: R] Could not resolve "./clientindex.js" when building in Windows ([5d11c00](https://github.com/AllanOricil/nrg/commit/5d11c00a02f549a9f75868bae430784c8a9c36c1))

# [1.2.0](https://github.com/AllanOricil/nrg/compare/v1.1.0...v1.2.0) (2024-09-28)


### Bug Fixes

* upgrade esbuild from 0.21.5 to 0.23.1 ([5faa505](https://github.com/AllanOricil/nrg/commit/5faa5057efc05707db575979e64fccb3dc7c3ec5))


### Features

* if package root can't be found, a .nrg folder is created in the users home directory ([d11f89c](https://github.com/AllanOricil/nrg/commit/d11f89cad27bface38b353e7158bb06ca45d5410))

# [1.1.0](https://github.com/AllanOricil/nrg/compare/v1.0.1...v1.1.0) (2024-09-18)


### Features

* add custom html attributes id: for: i18n: ([0e67ad6](https://github.com/AllanOricil/nrg/commit/0e67ad672f0ffa58f12cb2a90238cf322551d71c))
