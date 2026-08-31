import { access, readFile } from 'node:fs/promises';

const requiredArtifacts = ['dist/widget.js', 'dist/preview.html'];

await Promise.all(requiredArtifacts.map((artifact) => access(artifact)));

const previewHtml = await readFile('dist/preview.html', 'utf8');

if (!previewHtml.includes('src="/assets/')) {
  throw new Error(
    'dist/preview.html does not reference its built preview entry.',
  );
}
