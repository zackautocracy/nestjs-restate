const tokenMap = new WeakMap<new (...args: any[]) => any, symbol>();

export function getClientToken(target: new (...args: any[]) => any): symbol {
    if (!tokenMap.has(target)) {
        tokenMap.set(target, Symbol(`RestateClient:${target.name}`));
    }
    return tokenMap.get(target)!;
}
