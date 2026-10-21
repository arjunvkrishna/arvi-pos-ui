// Static analysis of app.js: which names does each on-demand chunk define, and who uses them from outside?
// usage: node tools/analyze-chunks.js [path/to/app.js] [--json]
const fs = require('fs'), path = require('path');
const acorn = require('acorn'), escope = require('eslint-scope');
const root = path.join(__dirname, '..');
const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(root, 'app.js');
const cfg = require('./chunks.config.js');
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', locations: true, ranges: true });
const chunkOfLine = (line) => { for (const [name, ranges] of Object.entries(cfg.chunks)) for (const [a, b] of ranges) if (line >= a && line <= b) return name; return 'core'; };

const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
const globalScope = sm.globalScope;
const out = { chunks: {}, loadTime: [], };
for (const c of [...Object.keys(cfg.chunks), 'core']) out.chunks[c] = { functions: new Set(), variables: new Set(), usedFromOutside: {}, };

// who does what
const defs = new Map();
for (const v of globalScope.variables) {
  if (!v.defs.length) continue;
  const d = v.defs[0];
  const line = d.node.loc.start.line;
  const kind = d.type === 'FunctionName' ? 'function' : 'variable';
  const ch = chunkOfLine(line);
  defs.set(v.name, { chunk: ch, kind, line });
  out.chunks[ch][kind === 'function' ? 'functions' : 'variables'].add(v.name);
}
const cross = [];
const consider = (ref) => {
  const name = ref.identifier.name; const d = defs.get(name); if (!d) return;
  const line = ref.identifier.loc.start.line; const rc = chunkOfLine(line);
  if (rc === d.chunk) return;
  cross.push({ name, kind: d.kind, defChunk: d.chunk, fromChunk: rc, line, isWrite: ref.isWrite() });
};
// In script mode, references from inside functions to top-level names stay "through" (unresolved), so match by name.
for (const ref of globalScope.through) consider(ref);
for (const v of globalScope.variables) for (const ref of v.references) consider(ref);
// top-level statements that execute at load inside chunk ranges (not declarations)
for (const st of ast.body) {
  const ch = chunkOfLine(st.loc.start.line);
  if (ch === 'core') continue;
  if (['FunctionDeclaration', 'VariableDeclaration'].includes(st.type)) {
    if (st.type === 'VariableDeclaration') {
      // initialisers that call functions run at load; plain literals are fine
      for (const dcl of st.declarations) if (dcl.init && ['CallExpression', 'NewExpression', 'AwaitExpression'].includes(dcl.init.type)) out.loadTime.push({ chunk: ch, line: st.loc.start.line, text: src.split('\n')[st.loc.start.line - 1].trim().slice(0, 100) });
    }
    continue;
  }
  out.loadTime.push({ chunk: ch, line: st.loc.start.line, text: src.split('\n')[st.loc.start.line - 1].trim().slice(0, 100) });
}
// inline handlers in index.html / menu.html
const handlerNames = new Map();
for (const f of ['index.html', 'menu.html']) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  const re = /\son(?:click|input|change|submit|keydown|keyup|blur|focus)="([^"]*)"/g; let m;
  while ((m = re.exec(html))) for (const n of m[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const line = html.slice(0, m.index).split('\n').length;
    if (!handlerNames.has(n[1])) handlerNames.set(n[1], []);
    handlerNames.get(n[1]).push(f + ':' + line);
  }
}
// handlers written inside JS strings: onclick="name(...)"
for (const m of src.matchAll(/on(?:click|input|change|submit|keydown)=\\?["']([^"'`]*)/g)) {
  const line = src.slice(0, m.index).split('\n').length;
  for (const n of m[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) { if (!handlerNames.has(n[1])) handlerNames.set(n[1], []); handlerNames.get(n[1]).push('app.js:' + line); }
}
// handlers written inside JS strings are references from the chunk that contains that line
for (const [name, locs] of handlerNames) {
  const d = defs.get(name); if (!d) continue;
  for (const loc of locs) { if (!loc.startsWith('app.js:')) continue; const line = +loc.split(':')[1]; const rc = chunkOfLine(line); if (rc !== d.chunk) cross.push({ name, kind: d.kind, defChunk: d.chunk, fromChunk: rc, line, isWrite: false, viaString: true }); }
}
const report = {};
for (const ch of Object.keys(cfg.chunks)) {
  const fnSet = out.chunks[ch].functions, varSet = out.chunks[ch].variables;
  const lines = cfg.chunks[ch].reduce((a, [x, y]) => a + (Math.min(y, src.split('\n').length) - x + 1), 0);
  const inFn = {}, inVar = {}; 
  for (const c of cross.filter(c => c.defChunk === ch)) { const bag = c.kind === 'function' ? inFn : inVar; (bag[c.name] ||= new Set()).add(c.fromChunk); }
  const html = [...fnSet].filter(n => handlerNames.has(n));
  const outRefsToOtherLazy = {};
  for (const c of cross.filter(c => c.fromChunk === ch && c.defChunk !== 'core')) (outRefsToOtherLazy[c.defChunk] ||= new Set()).add(c.name);
  report[ch] = { lines, functions: fnSet.size, variables: varSet.size, fnUsedElsewhere: Object.fromEntries(Object.entries(inFn).map(([k, v]) => [k, [...v]])), varUsedElsewhere: Object.fromEntries(Object.entries(inVar).map(([k, v]) => [k, [...v]])), htmlHandlers: html, dependsOnOtherLazyChunks: Object.fromEntries(Object.entries(outRefsToOtherLazy).map(([k, v]) => [k, [...v]])) };
}
if (process.argv.includes('--json')) { console.log(JSON.stringify({ report, loadTime: out.loadTime }, null, 1)); process.exit(0); }
console.log('app.js:', src.split('\n').length, 'lines;', globalScope.variables.filter(v => v.defs.length).length, 'top-level names\n');
for (const [ch, r] of Object.entries(report)) {
  console.log(`== ${ch}: ${r.lines} lines, ${r.functions} functions, ${r.variables} state variables`);
  console.log(`   functions called/used from OTHER chunks or core (need a stub): ${Object.keys(r.fnUsedElsewhere).length}  | from HTML handlers: ${r.htmlHandlers.length}`);
  console.log(`   STATE VARIABLES used outside this chunk (must stay in core): ${Object.keys(r.varUsedElsewhere).length ? JSON.stringify(r.varUsedElsewhere) : 'none'}`);
  const dep = Object.entries(r.dependsOnOtherLazyChunks); if (dep.length) console.log(`   depends on other lazy chunks: ${dep.map(([k, v]) => k + ' (' + v.slice(0, 5).join(',') + (v.length > 5 ? ',…' : '') + ')').join('; ')}`);
}
const lt = out.loadTime; console.log(`\ncode that RUNS at load time inside chunk ranges (must be handled): ${lt.length}`); lt.slice(0, 40).forEach(x => console.log(`   [${x.chunk}] line ${x.line}: ${x.text}`));
if (process.argv.includes('--refs')) {
  console.log('\n--- every function in a chunk that is referenced from outside the chunk (core or other chunk), with call sites');
  const lines = src.split('\n');
  const seen = new Set();
  for (const c of cross.filter(c => c.kind === 'function' && c.defChunk !== 'core')) {
    const key = c.name + '|' + c.fromChunk + '|' + c.line; if (seen.has(key)) continue; seen.add(key);
    console.log(`  ${c.defChunk}.${c.name}  <-  ${c.fromChunk}:${c.line}   ${lines[c.line - 1].trim().slice(0, 95)}`);
  }
}
