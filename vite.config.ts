import {defineConfig} from 'vite';
// Relative asset paths: the same build works at a domain root and under a sub-path such as
// https://<user>.github.io/<repo>/ (single page, no client-side router).
export default defineConfig({base:'./'});
