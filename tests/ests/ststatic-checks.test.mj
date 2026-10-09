import test from 'node:test';
import assert from 'node:assert/strict';
import stylelint from 'stylelint';
import config from '../stylelint.config.mjs';
import fs from 'node:fs';

test('CSS error checks accept valid CSS and reject unknown properties', async () => {
  assert.equal((await stylelint.lint({code:'.sample { color: red; }', config})).errored, false);
  const result = await stylelint.lint({code:'.sample { colro: red; }', config});
  assert.equal(result.errored, true);
  assert.ok(result.results[0].warnings.some(w => w.rule === 'property-no-unknown'));
});

test('CSS check is an early local and CI gate', () => {
  const scripts = JSON.parse(fs.readFileSync('package.json')).scripts;
  assert.ok(scripts.check.indexOf('lint:css') < scripts.check.indexOf('build'));
  const workflow = fs.readFileSync('.github/workflows/validate.yml', 'utf8');
  assert.ok(workflow.indexOf('npm run lint:css') < workflow.indexOf('npm run build'));
});
