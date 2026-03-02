import { Injectable, Logger } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import * as restate from "@restatedev/restate-sdk";
import {
    HANDLER_METADATA_KEY,
    SERVICE_METADATA_KEY,
    VIRTUAL_OBJECT_METADATA_KEY,
    WORKFLOW_METADATA_KEY,
} from "../restate.constants";
import type { ComponentMetadata, HandlerMetadata } from "../restate.interfaces";

@Injectable()
export class RestateExplorer {
    private readonly logger = new Logger(RestateExplorer.name);

    constructor(private readonly discoveryService: DiscoveryService) {}

    discover(): any[] {
        const definitions: any[] = [];
        const providers = this.discoveryService.getProviders();

        for (const wrapper of providers) {
            const { instance, metatype } = wrapper;
            if (!instance || !metatype) continue;

            const workflowMeta = Reflect.getMetadata(WORKFLOW_METADATA_KEY, metatype) as
                | ComponentMetadata
                | undefined;
            const serviceMeta = Reflect.getMetadata(SERVICE_METADATA_KEY, metatype) as
                | ComponentMetadata
                | undefined;
            const virtualObjectMeta = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, metatype) as
                | ComponentMetadata
                | undefined;

            if (workflowMeta) {
                definitions.push(this.buildWorkflow(instance, workflowMeta));
            } else if (serviceMeta) {
                definitions.push(this.buildService(instance, serviceMeta));
            } else if (virtualObjectMeta) {
                definitions.push(this.buildVirtualObject(instance, virtualObjectMeta));
            }
        }

        this.logger.log(`Discovered ${definitions.length} Restate component(s)`);
        return definitions;
    }

    private buildWorkflow(instance: any, meta: ComponentMetadata) {
        const handlers = this.getHandlerMetadata(instance);
        const runHandlers = handlers.filter((h) => h.type === "run");
        const sharedHandlers = handlers.filter((h) => h.type === "shared");

        if (runHandlers.length !== 1) {
            throw new Error(
                `@Workflow('${meta.name}') class ${instance.constructor.name} must have exactly one @Run() handler, found ${runHandlers.length}`,
            );
        }

        const handlerMap: Record<string, any> = {
            run: instance[runHandlers[0].methodName].bind(instance),
        };

        for (const h of sharedHandlers) {
            handlerMap[h.methodName] = restate.createWorkflowSharedHandler(
                instance[h.methodName].bind(instance),
            );
        }

        this.logger.log(
            `Registered workflow '${meta.name}' with handlers: ${Object.keys(handlerMap).join(", ")}`,
        );

        return restate.workflow({
            name: meta.name,
            handlers: handlerMap as any,
        });
    }

    private buildService(instance: any, meta: ComponentMetadata) {
        const handlers = this.getHandlerMetadata(instance);
        const handlerMethods = handlers.filter((h) => h.type === "handler");

        if (handlerMethods.length === 0) {
            throw new Error(
                `@Service('${meta.name}') class ${instance.constructor.name} must have at least one @Handler() method`,
            );
        }

        const handlerMap: Record<string, any> = {};
        for (const h of handlerMethods) {
            handlerMap[h.methodName] = instance[h.methodName].bind(instance);
        }

        this.logger.log(
            `Registered service '${meta.name}' with handlers: ${Object.keys(handlerMap).join(", ")}`,
        );

        return restate.service({
            name: meta.name,
            handlers: handlerMap,
        });
    }

    private buildVirtualObject(instance: any, meta: ComponentMetadata) {
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
            handlerMap[h.methodName] = instance[h.methodName].bind(instance);
        }

        for (const h of sharedHandlers) {
            handlerMap[h.methodName] = restate.createObjectSharedHandler(
                instance[h.methodName].bind(instance),
            );
        }

        this.logger.log(
            `Registered virtual object '${meta.name}' with handlers: ${Object.keys(handlerMap).join(", ")}`,
        );

        return restate.object({
            name: meta.name,
            handlers: handlerMap as any,
        });
    }

    private getHandlerMetadata(instance: any): HandlerMetadata[] {
        return Reflect.getMetadata(HANDLER_METADATA_KEY, instance.constructor) || [];
    }
}
