// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://ittimenow-ittn-020d.twc1.net',
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()]
  }
});
