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
                    vue: ['vue'],
                    math: ['katex', 'markdown-it', 'markdown-it-texmath'],
                    mathlive: ['mathlive']
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
