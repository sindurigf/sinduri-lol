// @ts-check
import { defineConfig } from 'astro/config';

import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://sinduri.lol',
  output: 'static',
  integrations: [vue()],

  vite: {
    plugins: [tailwindcss()],
  },
});
