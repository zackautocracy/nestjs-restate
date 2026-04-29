import { Injectable } from "@nestjs/common";
import { registerComponent } from "../registry/component-registry";
import { WORKFLOW_METADATA_KEY } from "../restate.constants";
import type {
    ResolvedWorkflowComponentMetadata,
    WorkflowComponentMetadata,
    WorkflowDecoratorOptions,
} from "../restate.interfaces";

/**
 * Marks a class as a Restate workflow.
 *
 * @param nameOrOptions - Workflow name string, full options object, or omitted to use the class name.
 * @example
 * ```ts
 * @Workflow('signup')
 * // or
 * @Workflow({ name: 'signup', options: { workflowRetention: 7 * 24 * 60 * 60 * 1000 } })
 * // or
 * @Workflow() // uses class name
 * ```
 */
export function Workflow(nameOrOptions?: WorkflowDecoratorOptions): ClassDecorator {
    return (target) => {
        const meta: WorkflowComponentMetadata =
            typeof nameOrOptions === "string"
                ? { name: nameOrOptions }
                : { ...(nameOrOptions ?? {}) };

        // Default name to class name if not provided
        if (!meta.name) {
            meta.name = (target as any).name;
        }

        Injectable()(target as unknown as new (...args: any[]) => any);
        Reflect.defineMetadata(
            WORKFLOW_METADATA_KEY,
            meta as ResolvedWorkflowComponentMetadata,
            target,
        );
        registerComponent(target as unknown as new (...args: any[]) => any);
    };
}
