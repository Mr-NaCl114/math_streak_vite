import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    define: {
        __VERSION__: JSON.stringify('0.0.0')
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    mathlive: ['mathlive'],
                    markdown: ['markdown-it', 'markdown-it-texmath'],
                    katex: ['katex', 'katex/contrib/auto-render']
                }
            }
        }
    },
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: tag => tag === 'math-field'
                }
            }
        })
    ]
})
