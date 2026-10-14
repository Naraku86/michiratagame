import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';

const output = resolve(process.argv[2] ?? 'dist/michiratagame-itch.zip');
assert(output.endsWith('.zip'), 'El destino debe terminar en .zip');
const temporary = await mkdtemp(join(tmpdir(), 'michi-itch-'));
try {
  const files = join(temporary, 'game');
  await build({
    base: './',
    build: { outDir: files, emptyOutDir: true },
    plugins: [{
      name: 'itch-relative-images', enforce: 'pre',
      transform(source, id) {
        if (!id.includes('/src/') || !id.endsWith('.ts')) return;
        // Los paths dinámicos no los reescribe Vite al configurar base.
        return source.replace(/(['"`])\/assets\//g, '$1./assets/');
      },
    }],
  });
  await copyFile(resolve('LICENSE'), join(files, 'LICENSE'));
  await copyFile(resolve('node_modules/vite/LICENSE.md'), join(files, 'VITE_LICENSE.md'));
  const html = await readFile(join(files, 'index.html'), 'utf8');
  assert(!/(?:src|href)=["']\//.test(html), 'HTML con rutas absolutas');
  const assets = await readdir(join(files, 'assets'));
  for (const name of assets.filter(name => name.endsWith('.js'))) {
    const source = await readFile(join(files, 'assets', name), 'utf8');
    assert(!/['"`]\/assets\//.test(source), 'JS con imágenes absolutas');
    for (const match of source.matchAll(/\.\/assets\/([a-zA-Z0-9._-]+\.(?:jpg|png|webp))/g)) {
      assert(assets.includes(match[1]), `Falta imagen ${match[1]}`);
    }
  }
  await mkdir(resolve(output, '..'), { recursive: true });
  const archive = join(temporary, 'game.zip');
  execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: files });
  execFileSync('unzip', ['-tq', archive]);
  const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).split('\n');
  assert(entries.includes('index.html'), 'index.html debe estar en la raíz');
  assert(entries.includes('LICENSE') && entries.includes('VITE_LICENSE.md'), 'El paquete debe conservar las licencias');
  assert(!entries.some(entry => /(?:^|\/)(?:node_modules|data|server)(?:\/|$)/.test(entry)), 'ZIP contiene archivos privados');
  await copyFile(archive, output);
  console.log(`ZIP verificado: ${output} (${(await stat(output)).size} bytes). El tablero requiere otro despliegue; el juego local funciona sin API.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
