import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        /*
         * html2canvas cai no fork mantido.
         *
         * O jspdf importa 'html2canvas' por dentro, para o método .html()
         * dele. O original parou em 2022 e quebra na primeira cor oklch() --
         * e o Tailwind 4, que este sistema usa, escreve as cores todas assim.
         * Com o apelido, qualquer caminho que peça html2canvas recebe a versão
         * que sabe ler as cores modernas, e o pacote antigo não precisa nem
         * estar instalado.
         */
        html2canvas: 'html2canvas-pro',
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
