import {skinPatterns} from './settings-skin-patterns.mjs'
import {defaultSkin,skinPresets,normalizeSkin} from './settings-skin.mjs'
export const builtinSkins=[...skinPresets.map(row=>({id:row.id,skin:normalizeSkin({...defaultSkin,...row,preset:row.id})})),...Object.entries(skinPatterns).map(([id,pattern])=>{const palette=skinPresets.find(row=>row.id===pattern.palette);return {id:'pattern-'+id,skin:normalizeSkin({...defaultSkin,...palette,preset:palette.id,name:pattern.name,background:{data:'',pattern:id,name:pattern.name,fit:'cover',strength:28}})}})]
