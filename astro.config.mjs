// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { writeFile } from 'node:fs/promises';
import { releaseConfig } from './config/release.mjs';

const release = releaseConfig();
export default defineConfig({
  site: release.site,
  trailingSlash: 'always',
  compressHTML: true,
  redirects: release.redirects,
  integrations: [
    ...(release.production ? [sitemap({ filter: (url) => release.production && !release.internalPaths.includes(new URL(url).pathname) && !Object.hasOwn(release.redirects, new URL(url).pathname.replace(/\/$/, '')) })] : []),
    {
      name: 'release-metadata',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          const robots = release.production
            ? `User-agent: *\nAllow: /\nDisallow: /design-system/\nDisallow: /global-styles/\nSitemap: ${release.site}/sitemap-index.xml\n`
            : 'User-agent: *\nDisallow: /\n';
          const headers = `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n${release.production ? '' : '  X-Robots-Tag: noindex, nofollow\n'}\n` + release.internalPaths.map(path => `${path}\n  X-Robots-Tag: noindex, nofollow\n`).join('\n');
          await Promise.all([
            writeFile(new URL('robots.txt', dir), robots),
            writeFile(new URL('_headers', dir), headers),
            writeFile(new URL('.release.json', dir), JSON.stringify(release)),
            writeFile(new URL('_redirects', dir), Object.entries(release.redirects).flatMap(([from, to]) => [`${from} ${to} 301`, `${from}/ ${to} 301`]).join('\n') + '\n'),
          ]);
        },
      },
    },
  ],
  vite: {
    define: { 'import.meta.env.PUBLIC_INDEXABLE': JSON.stringify(release.production) },
    plugins: [tailwindcss()],
  },
});
