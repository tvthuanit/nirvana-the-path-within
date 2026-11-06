import test from 'node:test';import assert from 'node:assert/strict';
import {LOCALES,LANGS,translate,formatName,detectLang} from '../src/i18n.ts';
import {NAME_COUNT} from '../src/logic.ts';
const base=k=>k.replace(/_(zero|one|two|few|many|other)$/,'');
test('every locale covers every English key and has full name lists',()=>{
 const want=new Set(Object.keys(LOCALES.en).map(base));
 for(const l of LANGS){const have=new Set(Object.keys(LOCALES[l]).map(base));
  for(const k of want)assert.ok(have.has(k),`${l} is missing "${k}"`);
  assert.equal(LOCALES[l].adj.length,NAME_COUNT,`${l} adj`);assert.equal(LOCALES[l].noun.length,NAME_COUNT,`${l} noun`);}
});
test('plurals follow CLDR rules per language',()=>{
 assert.equal(translate('en','lights',{count:1}),'1 LIGHT ON THE LAKE');
 assert.equal(translate('en','lights',{count:3}),'3 LIGHTS ON THE LAKE');
 assert.equal(translate('vi','lights',{count:1}),'1 ÁNH ĐÈN TRÊN HỒ');
 assert.equal(translate('es','lights',{count:1}),'1 LUZ EN EL LAGO');
});
test('names follow each language word order',()=>{
 assert.equal(formatName('en',[0,0]),'Quiet Heron');
 assert.equal(formatName('vi',[0,2]),'Mây Lặng');
 assert.equal(formatName('ja',[0,0]),'静かな鷺');
 assert.equal(formatName('es',[0,0]),'Garza Suave');
});
test('language detection and fallbacks',()=>{
 assert.equal(detectLang(['vi-VN','en']),'vi');assert.equal(detectLang(['de-DE']),'en');
 assert.equal(translate('vi','no-such-key'),'no-such-key');
});
