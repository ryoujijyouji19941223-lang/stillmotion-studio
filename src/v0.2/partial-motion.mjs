export const MOTION_TYPES = Object.freeze([
  'sway',
  'drift',
  'ripple',
  'flicker',
  'breathe'
]);

export const MASK_TYPES = Object.freeze([
  'rectangle',
  'paint',
  'polygon',
  'ai'
]);

export const IDENTITY_TRANSFORM = Object.freeze({
  translateX: 0,
  translateY: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1
});

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function positiveInteger(value, fallback) {
  return Math.max(1, Math.round(finiteNumber(value, fallback)));
}

function normalizeRect(rect = {}) {
  return {
    x: Math.max(0, finiteNumber(rect.x, 0)),
    y: Math.max(0, finiteNumber(rect.y, 0)),
    width: Math.max(1, finiteNumber(rect.width, 1)),
    height: Math.max(1, finiteNumber(rect.height, 1))
  };
}

/** Creates a positive rectangle from two points in the same coordinate space. */
export function rectFromPoints(start, end) {
  const x1 = finiteNumber(start?.x, 0);
  const y1 = finiteNumber(start?.y, 0);
  const x2 = finiteNumber(end?.x, x1);
  const y2 = finiteNumber(end?.y, y1);

  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  };
}

/**
 * Calculates a centered image placement for a Canvas.
 * "cover" fills the Canvas and may crop; "contain" keeps the whole image visible.
 */
export function calculateImagePlacement(imageSize, canvasSize, fit = 'cover') {
  const imageWidth = positiveInteger(imageSize?.width, 1);
  const imageHeight = positiveInteger(imageSize?.height, 1);
  const canvasWidth = positiveInteger(canvasSize?.width, 1);
  const canvasHeight = positiveInteger(canvasSize?.height, 1);
  const normalizedFit = fit === 'contain' ? 'contain' : 'cover';
  const scale = normalizedFit === 'contain'
    ? Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight)
    : Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
    scale,
    fit: normalizedFit
  };
}

/** Maps a Canvas point back to the original image coordinate system. */
export function canvasPointToSource(point, placement, imageSize) {
  const scale = Math.max(Number.EPSILON, finiteNumber(placement?.scale, 1));
  const width = positiveInteger(imageSize?.width, 1);
  const height = positiveInteger(imageSize?.height, 1);

  return {
    x: clamp((finiteNumber(point?.x, 0) - finiteNumber(placement?.x, 0)) / scale, 0, width),
    y: clamp((finiteNumber(point?.y, 0) - finiteNumber(placement?.y, 0)) / scale, 0, height)
  };
}

/** Maps an original-image rectangle to its current Canvas placement. */
export function sourceRectToCanvas(rect, placement) {
  const normalized = normalizeRect(rect);
  const scale = Math.max(Number.EPSILON, finiteNumber(placement?.scale, 1));

  return {
    x: finiteNumber(placement?.x, 0) + normalized.x * scale,
    y: finiteNumber(placement?.y, 0) + normalized.y * scale,
    width: normalized.width * scale,
    height: normalized.height * scale
  };
}

function normalizeMask(mask = {}) {
  const kind = MASK_TYPES.includes(mask.kind) ? mask.kind : 'rectangle';

  return {
    kind,
    width: positiveInteger(mask.width, 1),
    height: positiveInteger(mask.height, 1),
    rect: kind === 'rectangle' ? normalizeRect(mask.rect) : null,
    source: typeof mask.source === 'string' && mask.source ? mask.source : null,
    feather: clamp(finiteNumber(mask.feather, 0), 0, 128),
    invert: mask.invert === true
  };
}

function normalizeMotion(motion = {}) {
  const type = MOTION_TYPES.includes(motion.type) ? motion.type : 'sway';
  const axis = ['x', 'y', 'both'].includes(motion.axis) ? motion.axis : 'x';
  const phase = finiteNumber(motion.phase, 0);

  return {
    type,
    amplitude: clamp(finiteNumber(motion.amplitude, 0.25), 0, 1),
    speed: clamp(finiteNumber(motion.speed, 0.4), 0, 1),
    phase: ((phase % 1) + 1) % 1,
    axis,
    pivot: {
      x: clamp(finiteNumber(motion.pivot?.x, 0.5), 0, 1),
      y: clamp(finiteNumber(motion.pivot?.y, 0.5), 0, 1)
    }
  };
}

/**
 * Converts saved or user-entered data into the stable v0.2 draft shape.
 * Unknown motion types are disabled so a bad region never stops the scene.
 */
export function normalizeMotionRegion(input = {}, index = 0) {
  const requestedType = input.motion?.type;
  const hasKnownType = requestedType == null || MOTION_TYPES.includes(requestedType);

  return {
    id: typeof input.id === 'string' && input.id ? input.id : `region-${index + 1}`,
    name: typeof input.name === 'string' && input.name ? input.name : `領域 ${index + 1}`,
    enabled: input.enabled !== false && hasKnownType,
    zIndex: Math.round(finiteNumber(input.zIndex, index)),
    mask: normalizeMask(input.mask),
    motion: normalizeMotion(input.motion)
  };
}

/** Adds v0.2 fields without changing the original scene object. */
export function normalizeSceneMotion(scene = {}) {
  const regions = Array.isArray(scene.motionRegions) ? scene.motionRegions : [];

  return {
    ...scene,
    motionRegions: regions
      .map((region, index) => normalizeMotionRegion(region, index))
      .sort((a, b) => a.zIndex - b.zIndex)
  };
}

/** Returns readable validation messages for editor UI and import warnings. */
export function validateMotionRegion(input) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    return ['領域データがオブジェクトではありません。'];
  }

  if (input.motion?.type != null && !MOTION_TYPES.includes(input.motion.type)) {
    errors.push(`未対応のモーション種別です: ${input.motion.type}`);
  }

  if (input.mask?.kind != null && !MASK_TYPES.includes(input.mask.kind)) {
    errors.push(`未対応のマスク種別です: ${input.mask.kind}`);
  }

  if (input.mask?.kind === 'rectangle') {
    if (!(Number(input.mask.rect?.width) > 0) || !(Number(input.mask.rect?.height) > 0)) {
      errors.push('矩形マスクの幅と高さは0より大きい必要があります。');
    }
  }

  if (['paint', 'ai'].includes(input.mask?.kind) && !input.mask?.source) {
    errors.push('画像マスクにはsourceが必要です。');
  }

  return errors;
}

/**
 * Maps the normalized speed (0..1) to a safe loop period in seconds.
 * Lower speed means a longer, calmer loop.
 */
export function motionPeriodSeconds(speed) {
  return 4.5 - clamp(finiteNumber(speed, 0.4), 0, 1) * 4;
}

/**
 * Evaluates a motion without touching Canvas or the DOM.
 * translateX/Y are fractions of the selected region, rotation is degrees.
 */
export function evaluateMotion(regionInput, elapsedSeconds) {
  const region = normalizeMotionRegion(regionInput);
  if (!region.enabled) return { ...IDENTITY_TRANSFORM };

  const { motion } = region;
  const period = motionPeriodSeconds(motion.speed);
  const angle = (finiteNumber(elapsedSeconds, 0) / period + motion.phase) * Math.PI * 2;
  const wave = Math.sin(angle);
  const pulse = (wave + 1) / 2;
  const strength = motion.amplitude;
  const transform = { ...IDENTITY_TRANSFORM };

  switch (motion.type) {
    case 'sway':
      transform.rotation = wave * strength * 4;
      break;
    case 'drift': {
      const distance = wave * strength * 0.025;
      if (motion.axis === 'x' || motion.axis === 'both') transform.translateX = distance;
      if (motion.axis === 'y' || motion.axis === 'both') transform.translateY = distance;
      break;
    }
    case 'ripple':
      transform.scaleX = 1 + wave * strength * 0.008;
      transform.scaleY = 1 - wave * strength * 0.004;
      break;
    case 'flicker':
      transform.scaleX = transform.scaleY = 1 + pulse * strength * 0.012;
      transform.opacity = 1 - (1 - pulse) * strength * 0.12;
      break;
    case 'breathe':
      transform.scaleX = 1 + wave * strength * 0.006;
      transform.scaleY = 1 + wave * strength * 0.015;
      break;
  }

  return transform;
}
