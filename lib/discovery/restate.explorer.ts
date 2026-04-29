import { Inject, Injectable, Logger } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants.js";
import { DiscoveryService, ExternalContextCreator } from "@nestjs/core";
import * as restate from "@restatedev/restate-sdk";
import { runWithContext } from "../context/restate-context.store";
import {
    createDefaultRestateCallbackMetadata,
    RestateParamsFactory,
} from "../pipeline/restate-params-factory";
import {
    HANDLER_METADATA_KEY,
    RESTATE_OPTIONS,
    SERVICE_METADATA_KEY,
    VIRTUAL_OBJECT_METADATA_KEY,
    WORKFLOW_METADATA_KEY,
} from "../restate.constants";
import type {
    HandlerMetadata,
    ResolvedServiceComponentMetadata,
    ResolvedVirtualObjectComponentMetadata,
    ResolvedWorkflowComponentMetadata,
    RestateModuleOptions,
} from "../restate.interfaces";

export interface ComponentSummary {
    componentName: string;
    componentType: string;
    handlers: Array<{ name: string; type: string }>;
    metadata?: Record<string, string>;
}

export interface DiscoveryResult {
    definitions: any[];
    serviceClassNames: Map<string, string>;
    componentSummary: ComponentSummary[];
}

@Injectable()
export class RestateExplorer {
    private readonly logger = new Logger("RestateDiscovery");
    private readonly restateParamsFactory = new RestateParamsFactory();

    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly externalContextCreator: ExternalContextCreator,
        @Inject(RESTATE_OPTIONS) private readonly options: RestateModuleOptions,
    ) {}

    private ensureDefaultParamMetadata(instance: any, methodName: string) {
        const existing = Reflect.getMetadata(ROUTE_ARGS_METADATA, instance.constructor, methodName);
        if (!existing) {
            Reflect.defineMetadata(
                ROUTE_ARGS_METADATA,
                createDefaultRestateCallbackMetadata(),
                instance.constructor,
                methodName,
            );
        }
    }

    private wrapHandler(instance: any, methodName: string) {
        const pipelineOpts = this.options.pipeline;
        const opts = {
            guards: pipelineOpts?.guards ?? true,
            interceptors: pipelineOpts?.interceptors ?? true,
            filters: pipelineOpts?.filters ?? true,
        };

        this.ensureDefaultParamMetadata(instance, methodName);

        const enhancedFn = this.externalContextCreator.create(
            instance,
            instance[methodName],
            methodName,
            ROUTE_ARGS_METADATA,
            this.restateParamsFactory,
            undefined,
            undefined,
            opts,
            "restate",
        );

        return (ctx: any, input: any) => runWithContext(ctx, () => enhancedFn(input, ctx));
    }

    discover(): DiscoveryResult {
        const definitions: any[] = [];
        const serviceClassNames = new Map<string, string>();
        const componentSummary: ComponentSummary[] = [];
        const providers = this.discoveryService.getProviders();

        for (const wrapper of providers) {
            const { instance, metatype } = wrapper;
            if (!instance || !metatype) continue;

            const workflowMeta = Reflect.getMetadata(WORKFLOW_METADATA_KEY, metatype) as
                | ResolvedWorkflowComponentMetadata
                | undefined;
            const serviceMeta = Reflect.getMetadata(SERVICE_METADATA_KEY, metatype) as
                | ResolvedServiceComponentMetadata
                | undefined;
            const virtualObjectMeta = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, metatype) as
                | ResolvedVirtualObjectComponentMetadata
                | undefined;

            if (workflowMeta) {
                serviceClassNames.set(workflowMeta.name, instance.constructor.name);
                definitions.push(this.buildWorkflow(instance, workflowMeta));
                const handlers = this.getHandlerMetadata(instance);
                componentSummary.push({
                    componentName: workflowMeta.name,
                    componentType: "workflow",
                    handlers: handlers.map((h) => ({ name: h.methodName, type: h.type })),
                    metadata: workflowMeta.metadata,
                });
            } else if (serviceMeta) {
                serviceClassNames.set(serviceMeta.name, instance.constructor.name);
                definitions.push(this.buildService(instance, serviceMeta));
                const handlers = this.getHandlerMetadata(instance);
                componentSummary.push({
                    componentName: serviceMeta.name,
                    componentType: "service",
                    handlers: handlers.map((h) => ({ name: h.methodName, type: h.type })),
                    metadata: serviceMeta.metadata,
                });
            } else if (virtualObjectMeta) {
                serviceClassNames.set(virtualObjectMeta.name, instance.constructor.name);
                definitions.push(this.buildVirtualObject(instance, virtualObjectMeta));
                const handlers = this.getHandlerMetadata(instance);
                componentSummary.push({
                    componentName: virtualObjectMeta.name,
                    componentType: "virtualObject",
                    handlers: handlers.map((h) => ({ name: h.methodName, type: h.type })),
                    metadata: virtualObjectMeta.metadata,
                });
            }
        }

        // Sort component summary deterministically
        componentSummary.sort((a, b) => a.componentName.localeCompare(b.componentName));
        for (const cs of componentSummary) {
            cs.handlers.sort((a, b) => a.name.localeCompare(b.name));
        }

        this.logger.log(`Discovered ${definitions.length} Restate component(s)`);
        return { definitions, serviceClassNames, componentSummary };
    }

    private buildWorkflow(instance: any, meta: ResolvedWorkflowComponentMetadata) {
        const handlers = this.getHandlerMetadata(instance);
        const runHandlers = handlers.filter((h) => h.type === "run");
        const sharedHandlers = handlers.filter((h) => h.type === "shared");

        if (runHandlers.length !== 1) {
            throw new Error(
                `@Workflow('${meta.name}') class ${instance.constructor.name} must have exactly one @Run() handler, found ${runHandlers.length}`,
            );
        }

        const runHandler = runHandlers[0];
        if (runHandler.methodName !== "run") {
            throw new Error(
                `@Workflow('${meta.name}') @Run() method must be named 'run', found '${runHandler.methodName}'`,
            );
        }
        const runFn = this.wrapHandler(instance, runHandler.methodName);

        const handlerMap: Record<string, any> = {
            run: runHandler.options
                ? restate.handlers.workflow.workflow(runHandler.options, runFn)
                : runFn,
        };

        for (const h of sharedHandlers) {
            const fn = this.wrapHandler(instance, h.methodName);
            handlerMap[h.methodName] = h.options
                ? restate.handlers.workflow.shared(h.options, fn)
                : restate.createWorkflowSharedHandler(fn);
        }

        this.logger.log(
            `Registered workflow '${meta.name}' with handlers: ${Object.keys(handlerMap).join(", ")}`,
        );

        return restate.workflow({
            name: meta.name,
            handlers: handlerMap as any,
            description: meta.description,
            metadata: meta.metadata,
            options: meta.options,
        });
    }

    private buildService(instance: any, meta: ResolvedServiceComponentMetadata) {
        const handlers = this.getHandlerMetadata(instance);
        const handlerMethods = handlers.filter((h) => h.type === "handler");

        if (handlerMethods.length === 0) {
            throw new Error(
                `@Service('${meta.name}') class ${instance.constructor.name} must have at least one @Handler() method`,
            );
        }

        const handlerMap: Record<string, any> = {};
        for (const h of handlerMethods) {
            const fn = this.wrapHandler(instance, h.methodName);
            handlerMap[h.methodName] = h.options ? restate.handlers.handler(h.options, fn) : fn;
        }

        this.logger.log(
            `Registered service '${meta.name}' with handlers: ${Object.keys(handlerMap).join(", ")}`,
        );

        return restate.service({
            name: meta.name,
            handlers: handlerMap,
            description: meta.description,
            metadata: meta.metadata,
            options: meta.options,
        });
    }

    private buildVirtualObject(instance: any, meta: ResolvedVirtualObjectComponentMetadata) {
        const handlers = this.getHandlerMetadata(instance);
        const exclusiveHandlers = handlers.filter((h) => h.type === "handler");
        const sharedHandlers = handlers.filter((h) => h.type === "shared");

        if (exclusiveHandlers.length === 0 && sharedHandlers.length === 0) {
            throw new Error(
                `@VirtualObject('${meta.name}') class ${instance.constructor.name} must have at least one @Handler() or @Shared() method`,
            );
        }

        const handlerMap: Record<string, any> = {};

        for (const h of exclusiveHandlers) {
            const fn = this.wrapHandler(instance, h.methodName);
            handlerMap[h.methodName] = h.options
                ? restate.handlers.object.exclusive(h.options, fn)
                : fn;
        }

        for (const h of sharedHandlers) {
            const fn = this.wrapHandler(instance, h.methodName);
            handlerMap[h.methodName] = h.options
                ? restate.handlers.object.shared(h.options, fn)
                : restate.createObjectSharedHandler(fn);
        }

        this.logger.log(
            `Registered virtual object '${meta.name}' with handlers: ${Object.keys(handlerMap).join(", ")}`,
        );

        return restate.object({
            name: meta.name,
            handlers: handlerMap as any,
            description: meta.description,
            metadata: meta.metadata,
            options: meta.options,
        });
    }

    private getHandlerMetadata(instance: any): HandlerMetadata[] {
        return Reflect.getMetadata(HANDLER_METADATA_KEY, instance.constructor) || [];
    }
}
