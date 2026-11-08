import {defaultOpening,normalizeOpening,openingInjection} from './opening.mjs'
import z from '@deepseek-ai/schemastery'
import {apply as applyDiscovery} from './settings-model-discovery.mjs'
import {defaultSkin,normalizeSkin,skinTokens,normalizeSkinLibrary} from './settings-skin.mjs'
import {startupEffects} from './settings-decorations.mjs'
import {defaultDecorations,normalizeDecorations} from './settings-personalization.mjs'
import {applyMedia} from './settings-media-host.mjs'
import {applyArchiveMaintenance} from './archive-maintenance-host.mjs'
import {applyArchiveAgentLifecycle} from './archive-agent-lifecycle.mjs'
import {defaultSidebar,normalizeSidebar} from './sidebar-modules.mjs'
export const inject=['llm','settings','credentials','webServer']
export const Config=z.object({sidebar:z.string().default(JSON.stringify(defaultSidebar)).volatile(),opening:z.string().default(JSON.stringify(defaultOpening)).volatile(),appearance:z.string().default(JSON.stringify(defaultSkin)).volatile(),skinLibrary:z.string().default('[]').volatile(),startupEffect:z.union(startupEffects).default('none').volatile(),decorations:z.string().default(JSON.stringify(defaultDecorations)).volatile()})
export function apply(ctx,config){
 const validate=raw=>{normalizeSidebar(JSON.parse(raw.sidebar??JSON.stringify(defaultSidebar)));normalizeOpening(JSON.parse(raw.opening??JSON.stringify(defaultOpening)));skinTokens(normalizeSkin(JSON.parse(raw.appearance??JSON.stringify(defaultSkin))));normalizeSkinLibrary(JSON.parse(raw.skinLibrary??'[]'));normalizeDecorations(JSON.parse(raw.decorations??JSON.stringify(defaultDecorations)))}
 validate({appearance:typeof config.appearance==='string'?config.appearance:config.appearance.get(),skinLibrary:typeof config.skinLibrary==='string'?config.skinLibrary:config.skinLibrary?.get()})
 ctx.on('internal/config',function(_raw,next){const raw=next();if(this===ctx.fiber)validate(raw);return raw})
 ctx.on('webserver/index-inject',table=>{const raw=typeof config.opening==='string'?config.opening:config.opening?.get?.();const opening=normalizeOpening(JSON.parse(raw??JSON.stringify(defaultOpening)));if(opening.enabled)table.push(openingInjection(opening))})
 applyDiscovery(ctx)
 applyMedia(ctx)
 applyArchiveAgentLifecycle(ctx)
 applyArchiveMaintenance(ctx)
}
