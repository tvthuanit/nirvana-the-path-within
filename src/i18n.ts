// Locale files use the i18next JSON conventions ({{var}}, key_one / key_other) so they can move to i18next unchanged.
// Plural categories come from the browser's built-in CLDR data via Intl.PluralRules.
import en from './locales/en.json' with {type:'json'};
import vi from './locales/vi.json' with {type:'json'};
import ja from './locales/ja.json' with {type:'json'};
import es from './locales/es.json' with {type:'json'};

type Dict=Record<string,unknown>;
export const LOCALES:Record<string,Dict>={en,vi,ja,es};
export type Lang='en'|'vi'|'ja'|'es';
export const LANGS=Object.keys(LOCALES) as Lang[];

export function detectLang(preferred:readonly string[]):Lang {
 for(const l of preferred){const c=l.slice(0,2).toLowerCase();if(c in LOCALES)return c as Lang;}
 return 'en';
}
const fill=(s:string,vars:Record<string,string|number>)=>s.replace(/\{\{(\w+)\}\}/g,(_,k:string)=>String(vars[k]??''));
export function translate(lang:Lang,key:string,vars:Record<string,string|number>={}):string {
 const keys=typeof vars.count==='number'?[`${key}_${new Intl.PluralRules(lang).select(vars.count)}`,`${key}_other`,key]:[key];
 for(const d of [LOCALES[lang],LOCALES.en])for(const k of keys)if(typeof d[k]==='string')return fill(d[k] as string,vars);
 return key;
}
/** Names are two indices into per-language word lists, so a name re-localizes with the UI. */
export function formatName(lang:Lang,[a,n]:readonly [number,number]):string {
 const d=LOCALES[lang],word=(list:string,i:number)=>((d[list] as string[]|undefined)?.[i])??(LOCALES.en[list] as string[])[i]??'';
 return translate(lang,'nameFormat',{adj:word('adj',a),noun:word('noun',n)});
}
