import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateImagePlacement,
  canvasPointToSource,
  IDENTITY_TRANSFORM,
  evaluateMotion,
  motionPeriodSeconds,
  normalizeMotionRegion,
  normalizeSceneMotion,
  polygonBounds,
  rectFromPoints,
  sourceRectToCanvas,
  validateMotionRegion
} from '../src/v0.2/partial-motion.mjs';
import {
  durationForNarration,
  fitSceneToNarration,
  normalizeEffectSettings
} from '../src/v0.2/editor-settings.mjs';

test('freehand polygon points are normalized and bounded', () => {
  const region = normalizeMotionRegion({
    mask: {
      kind: 'polygon',
      width: 1080,
      height: 1440,
      points: [{ x: 50, y: 80 }, { x: 240, y: 20 }, { x: 300, y: 250 }]
    }
  });

  assert.deepEqual(region.mask.points, [
    { x: 50, y: 80 },
    { x: 240, y: 20 },
    { x: 300, y: 250 }
  ]);
  assert.deepEqual(polygonBounds(region.mask.points), {
    x: 50,
    y: 20,
    width: 250,
    height: 230
  });
  assert.deepEqual(validateMotionRegion(region), []);
});

test('brush corrections are preserved and unsafe values are clamped', () => {
  const region = normalizeMotionRegion({
    mask: {
      kind: 'polygon',
      width: 1080,
      height: 1440,
      points: [{ x: 10, y: 10 }, { x: 200, y: 20 }, { x: 80, y: 240 }],
      strokes: [
        { mode: 'add', size: 40, points: [{ x: 12, y: 18 }, { x: 42, y: 58 }] },
        { mode: 'erase', size: 9999, points: [{ x: -4, y: 30 }] }
      ]
    }
  });

  assert.deepEqual(region.mask.strokes[0], {
    mode: 'add',
    size: 40,
    points: [{ x: 12, y: 18 }, { x: 42, y: 58 }]
  });
  assert.deepEqual(region.mask.strokes[1], {
    mode: 'erase',
    size: 512,
    points: [{ x: 0, y: 30 }]
  });
  assert.deepEqual(validateMotionRegion(region), []);
  assert.equal(region.backgroundFill, true);
  assert.equal(normalizeMotionRegion({ backgroundFill: false }).backgroundFill, false);
});

test('landscape image can fit fully inside a portrait canvas', () => {
  const placement = calculateImagePlacement(
    { width: 1080, height: 720 },
    { width: 720, height: 960 },
    'contain'
  );

  assert.deepEqual(placement, {
    x: 0,
    y: 240,
    width: 720,
    height: 480,
    scale: 2 / 3,
    fit: 'contain'
  });
});

test('cover mode keeps the existing edge-cropping behavior', () => {
  const placement = calculateImagePlacement(
    { width: 1080, height: 720 },
    { width: 720, height: 960 },
    'cover'
  );

  assert.equal(placement.x, -360);
  assert.equal(placement.y, 0);
  assert.equal(placement.width, 1440);
  assert.equal(placement.height, 960);
});

test('v0.1 scene gains an empty motionRegions array', () => {
  const original = { name: '表紙', image: 'sample/maru/01.webp' };
  const normalized = normalizeSceneMotion(original);

  assert.deepEqual(normalized.motionRegions, []);
  assert.equal(original.motionRegions, undefined);
});

test('unsafe numeric inputs are clamped during normalization', () => {
  const region = normalizeMotionRegion({
    mask: {
      kind: 'rectangle',
      width: 1080,
      height: 1440,
      feather: 999,
      rect: { x: -20, y: -5, width: 200, height: 300 }
    },
    motion: {
      type: 'sway',
      amplitude: 3,
      speed: -2,
      pivot: { x: 2, y: -1 }
    }
  });

  assert.equal(region.motion.amplitude, 1);
  assert.equal(region.motion.speed, 0);
  assert.deepEqual(region.motion.pivot, { x: 1, y: 0 });
  assert.equal(region.mask.feather, 128);
  assert.equal(region.mask.rect.x, 0);
  assert.equal(region.mask.rect.y, 0);
});

test('unknown motion type is reported and safely disabled', () => {
  const input = { motion: { type: 'explode' } };
  const errors = validateMotionRegion(input);
  const normalized = normalizeMotionRegion(input);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /explode/);
  assert.equal(normalized.enabled, false);
  assert.deepEqual(evaluateMotion(input, 1), IDENTITY_TRANSFORM);
});

test('older scene-wide effect strength becomes the default for each effect', () => {
  const settings = normalizeEffectSettings({ effectStrength: 0.7 }, ['rain', 'dust']);
  assert.deepEqual(settings, {
    rain: { strength: 0.7, speed: 0.5 },
    dust: { strength: 0.7, speed: 0.5 }
  });
});

test('effect strength and speed are kept separately for every effect', () => {
  const settings = normalizeEffectSettings({
    effectSettings: {
      rain: { strength: 0.9, speed: 0.8 },
      dust: { strength: 0.25, speed: 0.15 }
    }
  }, ['rain', 'dust']);
  assert.deepEqual(settings.rain, { strength: 0.9, speed: 0.8 });
  assert.deepEqual(settings.dust, { strength: 0.25, speed: 0.15 });
});

test('scene duration follows narration with a short safety tail', () => {
  assert.equal(durationForNarration(7.34), 7.8);
  assert.deepEqual(fitSceneToNarration({ duration: 5 }, 7.34), {
    duration: 7.8,
    narrationDuration: 7.3
  });
});

test('the same input and time always produce the same transform', () => {
  const region = {
    id: 'tree',
    motion: { type: 'sway', amplitude: 0.5, speed: 0.3, phase: 0.25 }
  };

  assert.deepEqual(evaluateMotion(region, 1.25), evaluateMotion(region, 1.25));
});

test('motion returns to the same transform after one loop period', () => {
  const region = {
    motion: { type: 'drift', amplitude: 0.8, speed: 0.6, axis: 'both' }
  };
  const period = motionPeriodSeconds(0.6);
  const start = evaluateMotion(region, 0);
  const end = evaluateMotion(region, period);

  assert.ok(Math.abs(start.translateX - end.translateX) < 1e-12);
  assert.ok(Math.abs(start.translateY - end.translateY) < 1e-12);
});

test('regions are sorted by zIndex without mutating the source scene', () => {
  const scene = {
    motionRegions: [
      { id: 'front', zIndex: 5 },
      { id: 'back', zIndex: 1 }
    ]
  };
  const normalized = normalizeSceneMotion(scene);

  assert.deepEqual(normalized.motionRegions.map(region => region.id), ['back', 'front']);
  assert.deepEqual(scene.motionRegions.map(region => region.id), ['front', 'back']);
});

test('a drag in any direction becomes a positive rectangle', () => {
  assert.deepEqual(
    rectFromPoints({ x: 80, y: 90 }, { x: 20, y: 30 }),
    { x: 20, y: 30, width: 60, height: 60 }
  );
});

test('source and canvas coordinate mapping round trips', () => {
  const placement = { x: -20, y: 40, scale: 0.5 };
  const sourceRect = { x: 100, y: 200, width: 300, height: 400 };
  const canvasRect = sourceRectToCanvas(sourceRect, placement);

  assert.deepEqual(canvasRect, { x: 30, y: 140, width: 150, height: 200 });
  assert.deepEqual(
    canvasPointToSource(
      { x: canvasRect.x, y: canvasRect.y },
      placement,
      { width: 1080, height: 1440 }
    ),
    { x: sourceRect.x, y: sourceRect.y }
  );
});
