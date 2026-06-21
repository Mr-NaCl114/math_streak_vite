<script setup>
import {computed} from 'vue'

const props = defineProps({
    showAiAnswerPanel: {type: Boolean, required: true},
    question: {type: Object, default: null},
    questionId: {type: [Number, String], default: ''},
    loadingAiAnswer: {type: Boolean, required: true},
    aiAnswerError: {type: String, required: true},
    aiAnswerMessage: {type: String, required: true},
    renderedTypewriterText: {type: String, required: true},
    typewriterActive: {type: Boolean, required: true},
    activeMetric: {type: String, required: true},
    failInterruptData: {type: Object, required: true}
})

const emit = defineEmits(['close', 'ai-answer-render-ref'])

function registerAiAnswerRef(element) {
    emit('ai-answer-render-ref', element)
}

const questionMetricValue = computed(() => {
    if (!props.question) return 0
    const key = `${props.question.type}-${props.question.questionId}`
    const entry = props.failInterruptData[key]
    if (!entry) return 0
    return props.activeMetric === 'fail' ? (entry.failTimes || 0) : (entry.interruptTimes || 0)
})

const questionNumberColor = computed(() => {
    const value = questionMetricValue.value
    if (value === 0) return '#c8c8c8'
    const max = 5
    const ratio = Math.min(value / max, 1)
    const r = Math.round(200 - ratio * (200 - 217))
    const g = Math.round(200 - ratio * 200)
    const b = Math.round(200 - ratio * 200)
    return `rgb(${r}, ${g}, ${b})`
})
</script>

<template>
    <Transition name="fade-slide">
        <section v-if="showAiAnswerPanel" class="panel ai-answer-panel">
            <div class="question-heading">
                <div class="question-heading-left">
                    <h3>AI 解析</h3>
                    <span v-if="question" class="question-meta">
                        题号 <span class="question-number" :style="{ color: questionNumberColor }">#{{ question.questionId }}</span>
                        · 难度 {{ question.difficultyLevel }}
                    </span>
                </div>
                <button class="secondary-btn" type="button" @click="emit('close')">收起解析</button>
            </div>

            <p v-if="loadingAiAnswer" class="loading-tip">正在生成 AI 解析...</p>
            <p v-if="aiAnswerError" class="error">{{ aiAnswerError }}</p>
            <div
                v-if="aiAnswerMessage"
                :ref="registerAiAnswerRef"
                class="markdown-body ai-answer-content"
            >
                <span v-html="renderedTypewriterText"></span>
                <span v-if="typewriterActive" class="typewriter-cursor"></span>
            </div>
        </section>
    </Transition>
</template>
