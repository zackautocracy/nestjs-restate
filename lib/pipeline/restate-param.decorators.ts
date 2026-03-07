import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/**
 * Handler parameter decorator — injects the handler input.
 *
 * @example
 * // Full input
 * async charge(@Input() input: ChargeRequest) { ... }
 *
 * // Property extraction
 * async charge(@Input('amount') amount: number) { ... }
 */
export const Input = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
    const input = ctx.switchToRpc().getData();
    return data ? input?.[data] : input;
});

/**
 * Handler parameter decorator — injects the Restate SDK context.
 *
 * @example
 * async charge(@Input() input: ChargeRequest, @Ctx() ctx: Context) { ... }
 */
export const Ctx = createParamDecorator((data: unknown, ctx: ExecutionContext) =>
    ctx.switchToRpc().getContext(),
);
