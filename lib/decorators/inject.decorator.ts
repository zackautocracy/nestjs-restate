import { Inject } from "@nestjs/common";
import { getClientToken } from "../proxy/client-token";
import { RESTATE_CLIENT } from "../restate.constants";

/** Inject the Restate Ingress client (no args) or a typed handler proxy (with target class). */
export function InjectClient(): PropertyDecorator & ParameterDecorator;
export function InjectClient<T>(
    target: new (...args: any[]) => T,
): PropertyDecorator & ParameterDecorator;
export function InjectClient(target?: new (...args: any[]) => any) {
    if (!target) {
        return Inject(RESTATE_CLIENT);
    }
    return Inject(getClientToken(target));
}
