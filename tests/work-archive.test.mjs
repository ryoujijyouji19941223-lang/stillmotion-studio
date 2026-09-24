import test from 'node:test';
import assert from 'node:assert/strict';

import { readWorkZip, writeWorkZip } from '../src/v0.2/work-archive.mjs';

test('editing ZIP keeps JSON, image, narration and BGM bytes intact', async () => {
  const media = new Uint8Array([0, 1, 2, 3, 252, 253, 254, 255]);
  const zip = await writeWorkZip([
    { path: 'project.json', blob: new Blob([JSON.stringify({ title: 'まると おともだち', scenes: [{ duration: 8.4 }] })]) },
    { path: 'media/001-image.webp', blob: new Blob([media]) },
    { path: 'media/001-narration.webm', blob: new Blob([media]) },
    { path: 'media/002-bgm.mp3', blob: new Blob([media]) }
  ]);
  const files = await readWorkZip(zip);
  assert.equal(JSON.parse(new TextDecoder().decode(files.get('project.json'))).scenes[0].duration, 8.4);
  for (const path of ['media/001-image.webp', 'media/001-narration.webm', 'media/002-bgm.mp3']) {
    assert.deepEqual(files.get(path), media);
  }
});

test('editing ZIP rejects damaged media instead of loading an incomplete project', async () => {
  const zip = await writeWorkZip([{ path: 'project.json', blob: new Blob(['{"scenes":[]}']) }]);
  const damaged = new Uint8Array(await zip.arrayBuffer());
  damaged[30 + new TextEncoder().encode('project.json').length] ^= 1;
  await assert.rejects(readWorkZip(new Blob([damaged])), /壊れています/);
});
