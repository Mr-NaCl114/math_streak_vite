import {preprocessMath} from '../utils/math-preprocessor'

const mathRenderOptions = {
    delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
    ],
    throwOnError: false
}

let autoRenderPromise
let markdownPromise
let mathlivePromise
let idleCallbackId = null

function requestIdleWork(callback) {
    if ('requestIdleCallback' in window) {
        return window.requestIdleCallback(callback, {timeout: 350})
    }
    return window.setTimeout(callback, 1)
}

function cancelIdleWork(id) {
    if (id == null) return
    if ('cancelIdleCallback' in window) {
        window.cancelIdleCallback(id)
    } else {
        window.clearTimeout(id)
    }
}

async function loadAutoRenderer() {
    if (!autoRenderPromise) {
        autoRenderPromise = import('katex/contrib/auto-render').then(module => module.default)
    }
    return autoRenderPromise
}

async function loadMarkdownRenderer() {
    if (!markdownPromise) {
        markdownPromise = Promise.all([
            import('katex'),
            import('markdown-it'),
            import('markdown-it-texmath'),
            import('markdown-it-texmath/css/texmath.css')
        ]).then(([katexModule, MarkdownItModule, texmathModule]) => {
            const MarkdownIt = MarkdownItModule.default
            const texmath = texmathModule.default
            return new MarkdownIt({
                html: false,
                linkify: true,
                breaks: true
            }).use(texmath, {
                engine: katexModule.default,
                delimiters: ['dollars', 'brackets', 'beg_end'],
                katexOptions: {
                    throwOnError: false,
                    strict: false
                }
            })
        })
    }
    return markdownPromise
}

export function ensureMathliveLoaded() {
    if (!mathlivePromise) {
        mathlivePromise = import('mathlive')
    }
    return mathlivePromise
}

export function cancelScheduledMathRender() {
    cancelIdleWork(idleCallbackId)
    idleCallbackId = null
}

export async function renderMathIn(container) {
    if (!container) return
    const renderMathInElement = await loadAutoRenderer()
    renderMathInElement(container, mathRenderOptions)
}

export function scheduleMathRender(containerProvider) {
    cancelScheduledMathRender()
    idleCallbackId = requestIdleWork(async () => {
        idleCallbackId = null
        await renderMathIn(containerProvider())
    })
}

export async function renderMarkdown(text, {inline = false} = {}) {
    if (!text) return ''
    const markdownRenderer = await loadMarkdownRenderer()
    const prepared = preprocessMath(text)
    return inline ? markdownRenderer.renderInline(prepared) : markdownRenderer.render(prepared)
}
