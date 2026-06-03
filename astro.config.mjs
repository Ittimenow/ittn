// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://ittimenow-ittn-27f0.twc1.net',
  vite: {
    plugins: [tailwindcss()]
  }
});
