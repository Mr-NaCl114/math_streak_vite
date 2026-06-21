<script setup>
import {computed, ref} from 'vue'

const props = defineProps({
    failInterruptData: {type: Object, required: true},
    activeMetric: {type: String, required: true},
    sortOrder: {type: String, required: true}
})

const activeType = ref(1) // 1 = 选择题, 2 = 填空题

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
            total: (map[key].failTimes || 0) + (map[key].interruptTimes || 0),
            metricValue: props.activeMetric === 'fail'
                ? (map[key].failTimes || 0)
                : (map[key].interruptTimes || 0)
        })
    }
    if (props.sortOrder === 'count') {
        result.sort((a, b) => b.metricValue - a.metricValue || a.questionId - b.questionId)
    } else {
        result.sort((a, b) => a.questionId - b.questionId)
    }
    return result
})

function toggleType(type) {
    activeType.value = type
}

function getColor(value) {
    const max = 5
    const ratio = Math.min(value / max, 1)
    const r = Math.round(200 - ratio * (200 - 217))
    const g = Math.round(200 - ratio * 200)
    const b = Math.round(200 - ratio * 200)
    return `rgb(${r}, ${g}, ${b})`
}

function getTextColor(value) {
    return value >= 3 ? '#fff' : '#0d1216'
}
</script>

<template>
    <section class="panel extra-panel">
        <div class="extra-heading">
            <h2>{{ activeMetric === 'fail' ? '答错次数' : '中断次数' }}</h2>
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
                    backgroundColor: getColor(item.metricValue),
                    color: getTextColor(item.metricValue)
                }"
                :title="`题号 #${item.questionId} | 答错 ${item.failTimes} 次 | 中断 ${item.interruptTimes} 次`"
                class="fail-square"
            >
                {{ item.questionId }}
            </div>
            <p v-if="filteredList.length === 0" class="grid-empty">暂无数据</p>
        </div>
    </section>
</template>
