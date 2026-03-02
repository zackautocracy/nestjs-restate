const tokenMap = new WeakMap<new (...args: any[]) => any, symbol>();

export function getClientToken(target: new (...args: any[]) => any): symbol {
    let token = tokenMap.get(target);
    if (token === undefined) {
        token = Symbol(`RestateClient:${target.name}`);
        tokenMap.set(target, token);
    }
    return token;
}
