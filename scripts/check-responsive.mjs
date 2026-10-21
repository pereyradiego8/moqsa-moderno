import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const css=fs.readFileSync('app/src/main/assets/mobile.css','utf8');
assert.match(html,/<link rel="stylesheet" href="mobile\.css"\s*\/>/);
for(const selector of ['.arrival-highlight','.other-arrival-item','.route-line-list','.quick-grid','.bottom','.content','.route-variants']){
 assert.ok(css.includes(selector),'Estilos faltantes: '+selector);
}
for(const breakpoint of ['max-width:420px','max-width:330px','min-width:620px','max-height:480px']){
 assert.ok(css.includes(breakpoint),'Responsive faltante: '+breakpoint);
}
assert.ok(css.includes('env(safe-area-inset-bottom)'));
assert.match(css,/overflow-x:hidden/);
assert.match(css,/\.route-variants\{display:flex;flex-wrap:wrap/);
console.log('OK: CSS desde el inicio, responsivo en móvil, tablet, landscape y textos.');
