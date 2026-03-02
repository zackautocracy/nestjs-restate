import { Injectable } from "@nestjs/common";
import { registerComponent } from "../registry/component-registry";
import { WORKFLOW_METADATA_KEY } from "../restate.constants";
import type { WorkflowComponentMetadata, WorkflowDecoratorOptions } from "../restate.interfaces";

/**
 * Marks a class as a Restate workflow.
 *
 * @param nameOrOptions - Workflow name string or full options object.
 * @example
 * ```ts
 * @Workflow('signup')
 * // or
 * @Workflow({ name: 'signup', options: { workflowRetention: 7 * 24 * 60 * 60 * 1000 } })
 * ```
 */
export function Workflow(nameOrOptions: WorkflowDecoratorOptions): ClassDecorator {
    const meta: WorkflowComponentMetadata =
        typeof nameOrOptions === "string" ? { name: nameOrOptions } : nameOrOptions;

    return (target) => {
        Injectable()(target as unknown as new (...args: any[]) => any);
        Reflect.defineMetadata(WORKFLOW_METADATA_KEY, meta, target);
        registerComponent(target as unknown as new (...args: any[]) => any);
    };
}
