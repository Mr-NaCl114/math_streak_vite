import {computed, ref} from 'vue'

const MIN_FRAME_MS = 32
const TARGET_DURATION_MS = 1800

export function useTypewriter(renderMarkdown) {
    const sourceText = ref('')
    const visibleText = ref('')
    const active = ref(false)
    let frameId = 0
    let lastFrameAt = 0
    let index = 0
    let chunkSize = 1

    const renderedText = computed(() => {
        if (!visibleText.value) return ''
        return renderMarkdown(visibleText.value)
    })

    function stop() {
        if (frameId) cancelAnimationFrame(frameId)
        frameId = 0
        active.value = false
    }

    function tick(timestamp) {
        if (!active.value) return
        if (timestamp - lastFrameAt < MIN_FRAME_MS) {
            frameId = requestAnimationFrame(tick)
            return
        }

        lastFrameAt = timestamp
        index = Math.min(index + chunkSize, sourceText.value.length)
        visibleText.value = sourceText.value.slice(0, index)

        if (index >= sourceText.value.length) {
            stop()
            return
        }

        frameId = requestAnimationFrame(tick)
    }

    function start(fullText) {
        stop()
        sourceText.value = fullText || ''
        visibleText.value = ''
        index = 0
        lastFrameAt = 0

        if (!sourceText.value) return

        chunkSize = Math.max(1, Math.ceil(sourceText.value.length / (TARGET_DURATION_MS / MIN_FRAME_MS)))
        active.value = true
        frameId = requestAnimationFrame(tick)
    }

    function clear() {
        stop()
        sourceText.value = ''
        visibleText.value = ''
    }

    return {
        active,
        visibleText,
        renderedText,
        start,
        stop,
        clear
    }
}
