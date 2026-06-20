export function createRafScheduler(callback) {
    let frameId = 0

    function cancel() {
        if (!frameId) return
        cancelAnimationFrame(frameId)
        frameId = 0
    }

    function schedule() {
        if (frameId) return
        frameId = requestAnimationFrame(() => {
            frameId = 0
            callback()
        })
    }

    return {schedule, cancel}
}

export function createIdleScheduler(callback, timeout = 600) {
    let handle = 0

    function cancel() {
        if (!handle) return
        if ('cancelIdleCallback' in window) {
            window.cancelIdleCallback(handle)
        } else {
            clearTimeout(handle)
        }
        handle = 0
    }

    function schedule() {
        if (handle) return
        if ('requestIdleCallback' in window) {
            handle = window.requestIdleCallback(() => {
                handle = 0
                callback()
            }, {timeout})
            return
        }

        handle = window.setTimeout(() => {
            handle = 0
            callback()
        }, 0)
    }

    return {schedule, cancel}
}
