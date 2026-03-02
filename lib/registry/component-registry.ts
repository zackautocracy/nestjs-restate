/**
 * Global registry of Restate component classes.
 *
 * Each @Service(), @VirtualObject(), and @Workflow() decorator registers its target
 * here at import time. RestateModule.forRoot() reads this registry to auto-create
 * typed proxy providers for @InjectClient(T).
 */
const registry = new Set<new (...args: any[]) => any>();

export function registerComponent(target: new (...args: any[]) => any): void {
    registry.add(target);
}

export function getRegisteredComponents(): ReadonlySet<new (...args: any[]) => any> {
    return registry;
}

/** @internal — for test isolation only */
export function clearComponentRegistry(): void {
    registry.clear();
}
