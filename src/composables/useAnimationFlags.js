import {nextTick, ref} from 'vue'

export function useAnimationFlag() {
    const active = ref(false)
    let frameId = 0

    function trigger() {
        if (frameId) cancelAnimationFrame(frameId)
        active.value = false
        nextTick(() => {
            frameId = requestAnimationFrame(() => {
                frameId = 0
                active.value = true
            })
        })
    }

    function reset() {
        active.value = false
    }

    function dispose() {
        if (frameId) cancelAnimationFrame(frameId)
        frameId = 0
    }

    return {active, trigger, reset, dispose}
}
