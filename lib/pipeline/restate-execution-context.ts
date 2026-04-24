import type { ContextType, ExecutionContext } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";

export type RestateContextType = "restate" | ContextType;

export class RestateExecutionContext extends ExecutionContextHost {
    static create(context: ExecutionContext): RestateExecutionContext {
        const rCtx = new RestateExecutionContext(
            context.getArgs(),
            context.getClass(),
            context.getHandler(),
        );
        rCtx.setType(context.getType());
        return rCtx;
    }

    override getType<TContext extends string = RestateContextType>(): TContext {
        return super.getType();
    }

    /** The handler input payload */
    getInput<T = any>(): T {
        return this.getArgByIndex(0);
    }

    /** The Restate SDK context (Context | ObjectContext | WorkflowContext) */
    getRestateContext<T = any>(): T {
        return this.getArgByIndex(1);
    }
}
