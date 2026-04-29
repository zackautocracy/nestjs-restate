import {
    SERVICE_METADATA_KEY,
    VIRTUAL_OBJECT_METADATA_KEY,
    WORKFLOW_METADATA_KEY,
} from "../restate.constants";
import type {
    ResolvedServiceComponentMetadata,
    ResolvedVirtualObjectComponentMetadata,
    ResolvedWorkflowComponentMetadata,
} from "../restate.interfaces";

export interface ComponentMeta {
    type: "service" | "object" | "workflow";
    name: string;
}

/**
 * Checks whether a value is a class decorated with @Service(), @VirtualObject(), or @Workflow().
 */
export function isRestateComponent(value: unknown): value is new (...args: any[]) => any {
    if (typeof value !== "function") return false;
    return (
        Reflect.hasMetadata(SERVICE_METADATA_KEY, value) ||
        Reflect.hasMetadata(VIRTUAL_OBJECT_METADATA_KEY, value) ||
        Reflect.hasMetadata(WORKFLOW_METADATA_KEY, value)
    );
}

/**
 * Extracts Restate component type and name from a decorated class.
 * Throws if the target has no Restate component decorator.
 */
export function getComponentMeta(target: any): ComponentMeta {
    if (typeof target !== "function") {
        throw new Error(
            `Expected a class constructor, but received ${target === null ? "null" : typeof target}.`,
        );
    }
    const svc = Reflect.getMetadata(SERVICE_METADATA_KEY, target) as
        | ResolvedServiceComponentMetadata
        | undefined;
    if (svc) return { type: "service", name: svc.name };
    const obj = Reflect.getMetadata(VIRTUAL_OBJECT_METADATA_KEY, target) as
        | ResolvedVirtualObjectComponentMetadata
        | undefined;
    if (obj) return { type: "object", name: obj.name };
    const wf = Reflect.getMetadata(WORKFLOW_METADATA_KEY, target) as
        | ResolvedWorkflowComponentMetadata
        | undefined;
    if (wf) return { type: "workflow", name: wf.name };
    throw new Error(
        `${target.name} has no Restate component decorator. ` +
            `Add @Service(), @VirtualObject(), or @Workflow() to use it as a Restate client target.`,
    );
}
