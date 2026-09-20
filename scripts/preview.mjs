// Vinext 0.0.50 stores static-cache keys using Windows path separators.
// Normalize lookups for local preview without modifying installed dependencies.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const vinextDirectory = dirname(fileURLToPath(import.meta.resolve('vinext')));
if (process.platform === 'win32') {
  const { StaticFileCache } = await import(pathToFileURL(join(vinextDirectory, 'server/static-file-cache.js')));
  const lookup = StaticFileCache.prototype.lookup;
  StaticFileCache.prototype.lookup = function (pathname) {
    if (pathname === '/.vite' || pathname.startsWith('/.vite/')) return undefined;
    return lookup.call(this, pathname)
      ?? lookup.call(this, '/' + pathname.slice(1).replaceAll('/', '\\'));
  };
}
const { startProdServer } = await import(pathToFileURL(join(vinextDirectory, 'server/prod-server.js')));
await startProdServer({ port: Number(process.env.PORT || 3001), host: '127.0.0.1' });
