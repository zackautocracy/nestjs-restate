# Changelog

## [2.2.0](https://github.com/zackautocracy/nestjs-restate/compare/nestjs-restate-v2.1.0...nestjs-restate-v2.2.0) (2026-03-03)


### Features

* **logging:** add getContextIfAvailable() to context store ([2fe684e](https://github.com/zackautocracy/nestjs-restate/commit/2fe684ee22937c7d4cc141b16f0f8499a52b44ed))
* **logging:** add Restate LoggerTransport with NestJS-style formatting ([faffa3e](https://github.com/zackautocracy/nestjs-restate/commit/faffa3e034ff8439bcf6ecafdf8c3496c95b183a))
* **logging:** add RestateLoggerService with context-aware dispatch ([0d427e8](https://github.com/zackautocracy/nestjs-restate/commit/0d427e86121f9db031f5fb0e5da172f7dce411ba))
* **logging:** wire replay-aware logger into RestateModule ([297762c](https://github.com/zackautocracy/nestjs-restate/commit/297762c5bdb2bd0590b7c47deed9fa2a16f78dd6))


### Bug Fixes

* **logging:** harden formatMessage against unserializable values ([1cb3a5f](https://github.com/zackautocracy/nestjs-restate/commit/1cb3a5f28ded9c7616d2c35a9233469ca2b1737a))


### Documentation

* add replay-aware logger section to README and examples ([b048dd9](https://github.com/zackautocracy/nestjs-restate/commit/b048dd9465624a4616d677a0f0de6372ff3eabd0))

## [2.1.0](https://github.com/zackautocracy/nestjs-restate/compare/nestjs-restate-v2.0.0...nestjs-restate-v2.1.0) (2026-03-02)


### Features

* expose full Restate SDK context surface on RestateContext ([#9](https://github.com/zackautocracy/nestjs-restate/issues/9)) ([67d04b0](https://github.com/zackautocracy/nestjs-restate/commit/67d04b0a5fa3d9d35313b2d0e424e41595b3af8d))


### Documentation

* add Ask DeepWiki badge to README ([e329c27](https://github.com/zackautocracy/nestjs-restate/commit/e329c27fd6c2aeaf284e169979302788008be732))

## [2.0.0](https://github.com/zackautocracy/nestjs-restate/compare/nestjs-restate-v1.1.0...nestjs-restate-v2.0.0) (2026-03-02)


### ⚠ BREAKING CHANGES

* Handlers no longer receive SDK context as first parameter. Use injected RestateContext instead. See MIGRATION.md for the upgrade guide.

### Features

* v2.0.0 — NestJS-Native Restate Experience ([#6](https://github.com/zackautocracy/nestjs-restate/issues/6)) ([e61cc6a](https://github.com/zackautocracy/nestjs-restate/commit/e61cc6adbad1c82e12a54102ae89010730fd3282))


### Documentation

* update SDK peer dep version in README to &gt;=1.8.0 ([8f25d4d](https://github.com/zackautocracy/nestjs-restate/commit/8f25d4dc5ffe57e99221cb82070038636c753ad8))

## [1.1.0](https://github.com/zackautocracy/nestjs-restate/compare/nestjs-restate-v1.0.0...nestjs-restate-v1.1.0) (2026-03-02)


### Features

* add SDK configuration passthrough for retry policies, timeouts, and handler options ([abc5ca0](https://github.com/zackautocracy/nestjs-restate/commit/abc5ca0f13ae2d2249802c95aed3dc3fa6be9f8e))


### Bug Fixes

* address review feedback from Copilot and CodeRabbit ([5151851](https://github.com/zackautocracy/nestjs-restate/commit/51518519a55120660ecbeff7b89de4f50438f6a6))
* normalize repository URL casing for npm provenance ([9834345](https://github.com/zackautocracy/nestjs-restate/commit/9834345270ad223aa233bac444f8e787612312cd))

## 1.0.0 (2026-03-02)


### Features

* add core module, decorators, discovery, and endpoint ([ba4664f](https://github.com/zackautocracy/nestjs-restate/commit/ba4664f1971fc0468dfa986ced40b168b7e87442))
* polish and release readiness ([7546766](https://github.com/zackautocracy/nestjs-restate/commit/7546766e0dbebb462e7c6d16e35b75977f0bcf2e))


### Bug Fixes

* address package quality check findings ([2a8838b](https://github.com/zackautocracy/nestjs-restate/commit/2a8838b68db0f3fc488a26dfe500b187a5fa54df))
* disable useImportType biome rule for decorator metadata compatibility ([5406909](https://github.com/zackautocracy/nestjs-restate/commit/54069096532bb3f8b7fb0a617bf7e9db55fa084b))


### Documentation

* add comprehensive README with API reference ([88370b7](https://github.com/zackautocracy/nestjs-restate/commit/88370b7a782ed330887e26ad1ca49f3b0d7cab45))


### Tests

* add E2E tests with testcontainers ([9b2edb4](https://github.com/zackautocracy/nestjs-restate/commit/9b2edb45f4fa068242a4cfd4f7596273e92c2dce))
* add test suite with Vitest decorator metadata support ([7dee9bd](https://github.com/zackautocracy/nestjs-restate/commit/7dee9bd43babb717586069877e45137654b4a6e6))
