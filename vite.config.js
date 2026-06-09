import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    define: {
        __VERSION__: JSON.stringify('0.0.0')
    },
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: tag => tag === 'math-field'
                }
            }
        })
    ],
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:10001',
                changeOrigin: true,
                // 如果后端接口本身不带 /api 前缀，需要使用 rewrite 去掉
                // rewrite: (path) => path.replace(/^\/api/, '')
            }
        }
    }
})
