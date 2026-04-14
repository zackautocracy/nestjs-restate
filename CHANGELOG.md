# Changelog

## [2.7.0](https://github.com/razakiau/nestjs-restate/compare/nestjs-restate-v2.6.1...nestjs-restate-v2.7.0) (2026-04-14)


### Features

* deployment metadata change detection with onDeploymentMetadataChange hook ([#22](https://github.com/razakiau/nestjs-restate/issues/22)) ([7697fee](https://github.com/razakiau/nestjs-restate/commit/7697fee3008ff680e68a7a2c6a6928a69085d01f))

## [2.6.1](https://github.com/zackautocracy/nestjs-restate/compare/nestjs-restate-v2.6.0...nestjs-restate-v2.6.1) (2026-03-09)


### Bug Fixes

* cloud auth support & structured connection config ([#20](https://github.com/zackautocracy/nestjs-restate/issues/20)) ([712d537](https://github.com/zackautocracy/nestjs-restate/commit/712d53771d8c8fbf1573f7fae2cf1339732eadc7))

## [2.6.0](https://github.com/zackautocracy/nestjs-restate/compare/nestjs-restate-v2.5.0...nestjs-restate-v2.6.0) (2026-03-07)


### Features

* integrate NestJS execution pipeline with Restate handlers ([fe11608](https://github.com/zackautocracy/nestjs-restate/commit/fe1160853dfc084dd968d860d0ed87c9d120d133))


### Bug Fixes

* address review feedback — clone default metadata, add guard to providers ([f060ffa](https://github.com/zackautocracy/nestjs-restate/commit/f060ffafdd9fa492c0f0188f20f1eccac59bc6ce))


### Tests

* add factory function tests for @Input() and @Ctx() decorators ([7ab4c6a](https://github.com/zackautocracy/nestjs-restate/commit/7ab4c6a37acd3bcd20cf6f7395c03534a53c738e))

## [2.5.0](https://github.com/zackautocracy/nestjs-restate/compare/nestjs-restate-v2.4.0...nestjs-restate-v2.5.0) (2026-03-05)


### Features

* enrich logger with class names and invocation IDs ([f134737](https://github.com/zackautocracy/nestjs-restate/commit/f1347378fe05581d58979253eb5b891372a99e03))
* make decorator name argument optional ([50e9d81](https://github.com/zackautocracy/nestjs-restate/commit/50e9d811c82455d5d0120e027c16b680d0ed7513))
* smart auto-registration with modes and hash dedup ([c9d2fd1](https://github.com/zackautocracy/nestjs-restate/commit/c9d2fd15eda0f533671355e533198f202b8c35ad))


### Bug Fixes

* address review feedback — prevent options mutation, protect hash key, log error details ([337cd65](https://github.com/zackautocracy/nestjs-restate/commit/337cd65f0a023c5b34a988787315c856ebb5cda5))
* review cleanup — test mocks, dead code, logging ([c05be41](https://github.com/zackautocracy/nestjs-restate/commit/c05be41667b4ee515c840b7860e130a89fb3b5d8))


### Documentation

* correct exactly-once wording and @Shared/@Signal on workflows ([2d20c42](https://github.com/zackautocracy/nestjs-restate/commit/2d20c425903bd1cc2df6e3581f72f0e1ada1d9e9))
* update README for optional decorator names and production auto-registration ([bca5a5e](https://github.com/zackautocracy/nestjs-restate/commit/bca5a5e22798332f690c49242be29ff5a0e7d7d7))


### Tests

* cover remaining branches in restate.module.ts (port guard, error paths) ([b803625](https://github.com/zackautocracy/nestjs-restate/commit/b803625d3982a384b7d64cecbaa323debdc5794a))

## [2.4.0](https://github.com/zackautocracy/nestjs-restate/compare/nestjs-restate-v2.3.0...nestjs-restate-v2.4.0) (2026-03-03)


### Features

* **logging:** improve error formatting with opt-in stack traces ([74e4300](https://github.com/zackautocracy/nestjs-restate/commit/74e4300cdc5748580c12562ff127ae260413482c))
* smart log level mapping for Restate error types ([f99253f](https://github.com/zackautocracy/nestjs-restate/commit/f99253f6fe317485dab40a4ba538262f1e98f7b5))


### Bug Fixes

* address review feedback - resolveLogLevel checks message, freeze timestamp test, README fixes ([eb44f22](https://github.com/zackautocracy/nestjs-restate/commit/eb44f22cd48b39d7539d24e8317ee358a130342b))
* align timestamp format with NestJS ConsoleLogger ([a88f678](https://github.com/zackautocracy/nestjs-restate/commit/a88f67821da2bb8e7ea465adf9fa2aad1b6cf946))
* **logging:** align transport output with NestJS ConsoleLogger format ([ac3babd](https://github.com/zackautocracy/nestjs-restate/commit/ac3babd9dc55774035e1ca180e62b4cd8816c642))
* serialize Error objects with message and stack in logger transport ([b31812b](https://github.com/zackautocracy/nestjs-restate/commit/b31812b49735c1ca9e5398cb6dff07e2fa972f78))


### Code Refactoring

* address code review - SDK message comment, fix fragile test, add negative test ([336481d](https://github.com/zackautocracy/nestjs-restate/commit/336481d79b10327f8a4c18dc701c68bde777e20a))


### Documentation

* add Error Formatting section for log level adjustments and error serialization ([de38327](https://github.com/zackautocracy/nestjs-restate/commit/de383271ecfce15e587950d6079b6951a297da58))


### Tests

* add error classification label tests ([ace0685](https://github.com/zackautocracy/nestjs-restate/commit/ace0685d077a44ed190d7d0e735d801e3b121ff8))
* cover remaining branches in logger transport (100% coverage) ([b48ea45](https://github.com/zackautocracy/nestjs-restate/commit/b48ea4579e4086bb7645b21542a7c0735cc9d4e2))

## [2.3.0](https://github.com/zackautocracy/nestjs-restate/compare/nestjs-restate-v2.2.0...nestjs-restate-v2.3.0) (2026-03-03)


### Features

* add definitionOf utilities for SDK-compatible definitions ([82fdce7](https://github.com/zackautocracy/nestjs-restate/commit/82fdce7fd501b4e9963a262a29300566e4b59bd6))
* add enhanced Ingress proxy type definitions ([6bb4328](https://github.com/zackautocracy/nestjs-restate/commit/6bb4328750dcc85f3bf08946d061763f9c646f70))
* implement createRestateIngress proxy runtime ([9af7a9e](https://github.com/zackautocracy/nestjs-restate/commit/9af7a9e9242ed1fd683ad68f5cb3a957187f4fe0))
* wire enhanced Ingress into module and update exports ([2b1ced3](https://github.com/zackautocracy/nestjs-restate/commit/2b1ced3566686b652eb2043a0604dd7af0a54586))


### Bug Fixes

* address copilot review feedback ([0d4f87c](https://github.com/zackautocracy/nestjs-restate/commit/0d4f87c21b34069b447a5026e458de4867eb3502))
* guard against undecorated classes in Ingress proxy ([4094d41](https://github.com/zackautocracy/nestjs-restate/commit/4094d41616741f55876984bce7b821685ea05595))
* validate component type matches Ingress method before forwarding ([521ca93](https://github.com/zackautocracy/nestjs-restate/commit/521ca9359d045406f83e419ba09afa0fbff3f56a))


### Code Refactoring

* extract getComponentMeta to shared utility ([003dfbf](https://github.com/zackautocracy/nestjs-restate/commit/003dfbf3aa52a7b35d622b954ccd1f17733ef99f))
* fresh-eyes review fixes ([a1fc076](https://github.com/zackautocracy/nestjs-restate/commit/a1fc076a0770523ae63915b0deb0cafdf8f1d018))
* remove manual SDK definition stubs from example ([7158d1a](https://github.com/zackautocracy/nestjs-restate/commit/7158d1a7da2750da53ab472c534d11c870dc023d))


### Documentation

* clarify placeholder integrations in README examples ([4d92ab4](https://github.com/zackautocracy/nestjs-restate/commit/4d92ab4814dda7f99821adbb02e6f9349635141c))
* rewrite README for newcomer-friendly progressive disclosure ([0c63126](https://github.com/zackautocracy/nestjs-restate/commit/0c631269f6a267766b18fbdbcaaa838fa4e7793f))

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
