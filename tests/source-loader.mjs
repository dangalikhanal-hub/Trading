import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
export function sourceLoader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute);
    const exports = {};
    cache.set(absolute, exports);
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = id => {
      if (id in overrides) return overrides[id];
      if (id.startsWith('@/')) return load(path.resolve('src', id.slice(2)) + '.ts');
      if (id.startsWith('.')) return load(path.resolve(path.dirname(absolute), id) + '.ts');
      return nativeRequire(id);
    };
    vm.runInNewContext(code, { exports, require, process, Buffer, URL, URLSearchParams, AbortSignal, fetch, Request, Response, console, setTimeout, clearTimeout }, { filename: absolute });
    return exports;
  }
  return load;
}
