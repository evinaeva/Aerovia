import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const typeSource = readFileSync(new URL('../src/game/assets/assetMetadataTypes.ts', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../src/game/02b-asset-metadata.ts', import.meta.url), 'utf8');
const sample = JSON.parse(readFileSync(new URL('../assets/metadata/asset-metadata.sample.json', import.meta.url), 'utf8'));
const production = JSON.parse(readFileSync(new URL('../assets/metadata/asset-metadata.json', import.meta.url), 'utf8'));

function quotedValues(source, typeName){
  const re = new RegExp(`(?:export\\s+)?type\\s+${typeName}\\s*=([\\s\\S]*?);`);
  const match = source.match(re);
  assert.ok(match, `${typeName} is declared`);
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map(m => m[1]).sort();
}

for (const typeName of ['AssetKind', 'AssetPointKind', 'AssetRectKind', 'AssetLayer']) {
  test(`${typeName} runtime literals match exported Workbench contract`, () => {
    assert.deepEqual(quotedValues(runtimeSource, typeName), quotedValues(typeSource, typeName));
  });
}

test('sample and production metadata files keep the shared schema envelope', () => {
  for (const file of [sample, production]) {
    assert.equal(file.schemaVersion, 1);
    assert.ok(Array.isArray(file.assets));
  }
});

test('sample metadata uses only contract literals and normalized geometry', () => {
  const kinds = new Set(quotedValues(typeSource, 'AssetKind'));
  const pointKinds = new Set(quotedValues(typeSource, 'AssetPointKind'));
  const rectKinds = new Set(quotedValues(typeSource, 'AssetRectKind'));
  const layers = new Set(quotedValues(typeSource, 'AssetLayer'));
  for (const asset of sample.assets) {
    assert.ok(kinds.has(asset.kind), `kind ${asset.kind}`);
    if (asset.layer) assert.ok(layers.has(asset.layer), `layer ${asset.layer}`);
    assert.ok(asset.logicalSize.w > 0 && asset.logicalSize.h > 0, `${asset.id} logicalSize`);
    assert.ok(asset.anchor.x >= 0 && asset.anchor.x <= 1 && asset.anchor.y >= 0 && asset.anchor.y <= 1, `${asset.id} anchor`);
    for (const rect of asset.rects) {
      assert.ok(rectKinds.has(rect.kind), `${asset.id}/${rect.id} rect kind`);
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0 && rect.x + rect.w <= 1 && rect.y + rect.h <= 1, `${asset.id}/${rect.id} normalized rect`);
    }
    for (const point of asset.points) {
      assert.ok(pointKinds.has(point.kind), `${asset.id}/${point.id} point kind`);
      assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1, `${asset.id}/${point.id} normalized point`);
      if (point.kind === 'snap') assert.ok(point.radius > 0, `${asset.id}/${point.id} snap radius`);
    }
  }
});
