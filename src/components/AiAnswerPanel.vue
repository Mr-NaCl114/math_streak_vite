<script setup>
defineProps({
    showAiAnswerPanel: {type: Boolean, required: true},
    questionId: {type: [Number, String], default: ''},
    loadingAiAnswer: {type: Boolean, required: true},
    aiAnswerError: {type: String, required: true},
    aiAnswerMessage: {type: String, required: true},
    renderedTypewriterText: {type: String, required: true},
    typewriterActive: {type: Boolean, required: true}
})

const emit = defineEmits(['close', 'ai-answer-render-ref'])

function registerAiAnswerRef(element) {
    emit('ai-answer-render-ref', element)
}
</script>

<template>
    <Transition name="fade-slide">
        <section v-if="showAiAnswerPanel" class="panel ai-answer-panel">
            <div class="modal-heading">
                <div>
                    <p class="stats-label">当前题号 #{{ questionId }}</p>
                    <h3>AI 解析</h3>
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
