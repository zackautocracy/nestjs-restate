import type { ParamData } from "@nestjs/common";
import type { ParamsFactory } from "@nestjs/core/helpers/external-context-creator";

export enum RestateParamtype {
    INPUT = 0,
    CONTEXT = 1,
}

export class RestateParamsFactory implements ParamsFactory {
    exchangeKeyForValue(type: number, data: ParamData, args: any) {
        if (!args) return null;
        switch (type as RestateParamtype) {
            case RestateParamtype.INPUT:
                return data && args[0] ? args[0][data as string] : args[0];
            case RestateParamtype.CONTEXT:
                return args[1];
            default:
                return null;
        }
    }
}

export const DEFAULT_RESTATE_CALLBACK_METADATA = {
    [`${RestateParamtype.INPUT}:0`]: { index: 0, data: undefined, pipes: [] },
};
