export const inject=['beellixArchiveAgentLifecycle']

export function apply(ctx){
 ctx.provide('agents',ctx.beellixArchiveAgentLifecycle.registry)
}
