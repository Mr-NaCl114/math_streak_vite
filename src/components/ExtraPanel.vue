<script setup>
import {computed, onMounted, ref, watch} from 'vue'

const props = defineProps({
    failInterruptData: {type: Object, required: true}
})

const activeType = ref(1) // 1 = 选择题, 2 = 填空题
const showSettings = ref(false)
const sortOrder = ref('count') // 'count' | 'id'

// Persist sort preference
const SORT_KEY = 'math-streak-fail-sort'
onMounted(() => {
    const saved = localStorage.getItem(SORT_KEY)
    if (saved === 'id' || saved === 'count') sortOrder.value = saved
})
watch(sortOrder, (val) => {
    localStorage.setItem(SORT_KEY, val)
})

const filteredList = computed(() => {
    const result = []
    const map = props.failInterruptData
    for (const key of Object.keys(map)) {
        const [typeStr, idStr] = key.split('-')
        const type = parseInt(typeStr)
        if (type !== activeType.value) continue
        result.push({
            type,
            questionId: parseInt(idStr),
            failTimes: map[key].failTimes || 0,
            interruptTimes: map[key].interruptTimes || 0,
            total: (map[key].failTimes || 0) + (map[key].interruptTimes || 0)
        })
    }
    if (sortOrder.value === 'count') {
        result.sort((a, b) => b.total - a.total || a.questionId - b.questionId)
    } else {
        result.sort((a, b) => a.questionId - b.questionId)
    }
    return result
})

function toggleType(type) {
    activeType.value = type
}

function toggleSettings() {
    showSettings.value = !showSettings.value
}

function getColor(total) {
    // Scale from gray (0) to deep red (5+)
    const max = 5
    const ratio = Math.min(total / max, 1)
    // Interpolate: gray #c8c8c8 -> red #d92e00
    const r = Math.round(200 - ratio * (200 - 217))
    const g = Math.round(200 - ratio * 200)
    const b = Math.round(200 - ratio * 200)
    return `rgb(${r}, ${g}, ${b})`
}

function getTextColor(total) {
    return total >= 3 ? '#fff' : '#0d1216'
}
</script>

<template>
    <section class="panel extra-panel">
        <div class="extra-heading">
            <h2>数据展示</h2>
            <button class="settings-btn" title="设置" type="button" @click="toggleSettings">⚙️</button>
        </div>

        <div class="type-tabs">
            <button
                :class="{ active: activeType === 1 }"
                class="type-tab"
                type="button"
                @click="toggleType(1)"
            >选择题
            </button>
            <button
                :class="{ active: activeType === 2 }"
                class="type-tab"
                type="button"
                @click="toggleType(2)"
            >填空题
            </button>
        </div>

        <div class="fail-grid">
            <div
                v-for="item in filteredList"
                :key="`${item.type}-${item.questionId}`"
                :style="{
                    backgroundColor: getColor(item.total),
                    color: getTextColor(item.total)
                }"
                :title="`题号 #${item.questionId} | 答错 ${item.failTimes} 次 | 中断 ${item.interruptTimes} 次`"
                class="fail-square"
            >
                {{ item.questionId }}
            </div>
            <p v-if="filteredList.length === 0" class="grid-empty">暂无数据</p>
        </div>

        <!-- Settings popup -->
        <Transition name="settings-fade">
            <div v-if="showSettings" class="settings-backdrop" @click.self="showSettings = false">
                <div class="settings-box">
                    <h3 class="settings-title">设置</h3>
                    <div class="settings-item">
                        <span class="settings-label">数据展示顺序</span>
                        <label class="settings-radio">
                            <input
                                v-model="sortOrder"
                                name="sortOrder"
                                type="radio"
                                value="count"
                            />
                            按答错/中断次数
                        </label>
                        <label class="settings-radio">
                            <input
                                v-model="sortOrder"
                                name="sortOrder"
                                type="radio"
                                value="id"
                            />
                            按题号顺序
                        </label>
                    </div>
                    <p class="settings-footer">xxxxxxxxx</p>
                </div>
            </div>
        </Transition>
    </section>
</template>
