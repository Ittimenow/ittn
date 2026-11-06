import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/scripts/hero-particle-renderer.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture({ fail = false } = {}) {
  let imports = 0, created = 0, draws = 0;
  const added = [], sizes = [], exports = {};
  class Reveal {
    group = {};
    constructor() { created++; }
    resize(...size) { sizes.push(size); }
    dispose() {}
  }
  new Function('exports', 'require', source)(exports, id => {
    if (id.endsWith('hero-particle-reveal')) {
      imports++;
      if (fail) throw new Error('Effect download failed');
      return { RevealObject: Reveal };
    }
    if (id.endsWith('hero-particle-shapes')) return { CAMERA_DISTANCE: 4.6 };
    return {};
  });
  const renderer = Object.create(exports.ParticleRenderer.prototype);
  Object.assign(renderer, {
    id: 'sites', width: 300, disposed: false,
    scene: { add: object => added.push(object) },
    renderer: { getPixelRatio: () => 2, render() { draws++; }, dispose() {} },
    materials: [],
  });
  for (const name of ['crystal', 'hinge', 'cloud', 'flight', 'network', 'funnel', 'shield']) {
    renderer[name + 'Geometry'] = renderer[name + 'Material'] = { dispose() {} };
  }
  renderer.geometry = { dispose() {} };
  return { renderer, added, sizes, get imports() { return imports; }, get created() { return created; }, get draws() { return draws; } };
}

test('service scenes render without downloading the home effect; home keeps the poster until ready', async () => {
  const app = fixture(), r = app.renderer;
  r.render();
  assert.equal(app.imports, 0);
  assert.equal(app.draws, 1);
  r.id = 'home';
  r.loadReveal(); r.loadReveal();
  assert.equal(r.ready, false);
  r.render();
  assert.equal(app.draws, 1, 'do not replace the poster with an empty canvas');
  await r.revealLoading;
  assert.equal(app.imports, 1);
  assert.equal(app.created, 1);
  assert.deepEqual(app.sizes, [[600, 600]]);
  assert.equal(r.ready, true);
  r.render(); assert.equal(app.draws, 2);
  r.loadReveal(); assert.equal(app.created, 1);
});

test('a pending effect allocates no resources after disposal or a change to a service scene', async () => {
  for (const leave of [r => r.dispose(), r => { r.id = 'sites'; }]) {
    const app = fixture(), r = app.renderer;
    r.id = 'home'; r.loadReveal();
    const pending = r.revealLoading;
    leave(r);
    await pending;
    assert.equal(app.created, 0);
    assert.equal(app.added.length, 0);
  }
});

test('an effect download failure reaches the existing render fallback and retry path', async () => {
  const app = fixture({ fail: true }), r = app.renderer;
  r.id = 'home'; r.loadReveal();
  await r.revealLoading;
  assert.equal(r.ready, false);
  assert.equal(app.created, 0);
  assert.throws(() => r.render(), /Effect download failed/);
});
