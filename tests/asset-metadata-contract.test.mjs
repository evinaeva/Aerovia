import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const typeSource = readFileSync(new URL('../src/game/assets/assetMetadataTypes.ts', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../src/game/02b-asset-metadata.ts', import.meta.url), 'utf8');
const sampleMetadata = JSON.parse(readFileSync(new URL('../assets/metadata/asset-metadata.sample.json', import.meta.url), 'utf8'));
const production = JSON.parse(readFileSync(new URL('../assets/metadata/asset-metadata.json', import.meta.url), 'utf8'));

const ASSET_KINDS = new Set(['apron','hangar','runway','plane','runwayConnector','hud','background','sky']);
const POINT_KINDS = new Set(['anchor','entrance','exit','insideStop','snap','landingEntry','touchdown','runwayStop','takeoffStart','liftOff','centerlineStart','centerlineEnd','apronConnection','runwayConnection','nose','tail','shadowOffset','hudTextSlot','hudIconSlot','pauseButton']);
const RECT_KINDS = new Set(['visualBounds','collisionBounds','hitArea','contentSafeArea','gameplayArea','textSlot','iconSlot','decorativeOnly']);
const LAYERS = new Set(['background','apron','structures','entities','routes','vfx','hud']);

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}
function in01(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1; }
function validateAssetMetadataFile(file) {
  const warnings = [];
  if (file.schemaVersion !== 1) warnings.push('schemaVersion must be 1');
  if (!Array.isArray(file.assets)) warnings.push('assets must be an array');
  for (const asset of file.assets || []) {
    if (!asset.id) warnings.push('asset id is required');
    if (!ASSET_KINDS.has(asset.kind)) warnings.push(`${asset.id}: invalid kind`);
    if (!asset.src) warnings.push(`${asset.id}: src is required`);
    if (!asset.logicalSize || asset.logicalSize.w <= 0 || asset.logicalSize.h <= 0) warnings.push(`${asset.id}: logicalSize must be positive`);
    if (!asset.anchor || !in01(asset.anchor.x) || !in01(asset.anchor.y)) warnings.push(`${asset.id}: anchor must be normalized`);
    for (const point of asset.points || []) {
      if (!point.id) warnings.push(`${asset.id}: point id is required`);
      if (!POINT_KINDS.has(point.kind)) warnings.push(`${asset.id}: invalid point kind ${point.kind}`);
      if (!in01(point.x) || !in01(point.y)) warnings.push(`${asset.id}: point ${point.id} must be normalized`);
      if (point.kind === 'snap' && !(point.radius > 0 && point.radius <= 1)) warnings.push(`${asset.id}: snap radius must be normalized positive`);
    }
    for (const rect of asset.rects || []) {
      if (!rect.id) warnings.push(`${asset.id}: rect id is required`);
      if (!RECT_KINDS.has(rect.kind)) warnings.push(`${asset.id}: invalid rect kind ${rect.kind}`);
      if (!in01(rect.x) || !in01(rect.y) || rect.w <= 0 || rect.h <= 0 || rect.x + rect.w > 1 || rect.y + rect.h > 1) warnings.push(`${asset.id}: rect ${rect.id} must fit normalized bounds`);
    }
    if (asset.layer !== undefined && !LAYERS.has(asset.layer)) warnings.push(`${asset.id}: invalid layer`);
  }
  return warnings;
}

function synthesizeWorkbenchAnchor(asset) {
  return {
    ...asset,
    points: [
      ...(asset.points || []).filter((point) => point.kind !== 'anchor'),
      { id: 'anchor', kind: 'anchor', x: asset.anchor?.x ?? 0.5, y: asset.anchor?.y ?? 0.5 },
    ],
  };
}

function quotedValues(source, typeName) {
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
  for (const file of [sampleMetadata, production]) {
    assert.equal(file.schemaVersion, 1);
    assert.ok(Array.isArray(file.assets));
  }
});

test('sample metadata uses only contract literals and normalized geometry', () => {
  const kinds = new Set(quotedValues(typeSource, 'AssetKind'));
  const pointKinds = new Set(quotedValues(typeSource, 'AssetPointKind'));
  const rectKinds = new Set(quotedValues(typeSource, 'AssetRectKind'));
  const layers = new Set(quotedValues(typeSource, 'AssetLayer'));
  for (const asset of sampleMetadata.assets) {
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

test('Workbench exported fixture validates against the shared runtime AssetMetadataFile contract', () => {
  const fixture = readJson('./fixtures/workbench-export.asset-metadata.json');
  assert.deepEqual(validateAssetMetadataFile(fixture), []);
});

test('runtime sample JSON imports into Workbench with a synthesized editable anchor pseudo-point', () => {
  const sample = readJson('../assets/metadata/asset-metadata.sample.json');
  assert.deepEqual(validateAssetMetadataFile(sample), []);
  const imported = sample.assets.map(synthesizeWorkbenchAnchor);
  assert.equal(imported[0].anchor.x, 0.5);
  assert.ok(imported[0].points.some((point) => point.kind === 'anchor' && point.x === 0.5 && point.y === 0.5));
});
