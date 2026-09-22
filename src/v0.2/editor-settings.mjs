const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Keeps the old scene-wide strength as the starting value for older projects. */
export function normalizeEffectSettings(scene = {}, effectKeys = []) {
  const legacyStrength = clamp(finiteNumber(scene.effectStrength, 0.55), 0, 1);
  const stored = scene.effectSettings && typeof scene.effectSettings === 'object'
    ? scene.effectSettings
    : {};

  return Object.fromEntries(effectKeys.map(key => {
    const raw = stored[key] && typeof stored[key] === 'object' ? stored[key] : {};
    return [key, {
      strength: clamp(finiteNumber(raw.strength, legacyStrength), 0, 1),
      speed: clamp(finiteNumber(raw.speed, 0.5), 0, 1)
    }];
  }));
}

/** Gives narration a small tail so the last syllable is not clipped. */
export function durationForNarration(audioDuration, padding = 0.4) {
  const duration = finiteNumber(audioDuration, 0);
  if (duration <= 0) return null;
  return clamp(Math.ceil((duration + Math.max(0, padding)) * 10) / 10, 1, 120);
}

export function fitSceneToNarration(scene = {}, audioDuration, padding = 0.4) {
  const fitted = durationForNarration(audioDuration, padding);
  if (fitted == null) return { ...scene };
  return {
    ...scene,
    duration: fitted,
    narrationDuration: Math.round(audioDuration * 10) / 10
  };
}
