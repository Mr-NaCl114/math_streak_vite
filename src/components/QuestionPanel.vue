<script setup>
import {preprocessMath} from '../utils/math-preprocessor'

defineProps({
    question: {type: Object, default: null},
    isTodayCompleted: {type: Boolean, required: true},
    answerCompleted: {type: Boolean, required: true},
    loadingAiAnswer: {type: Boolean, required: true},
    errorMessage: {type: String, required: true},
    answerForm: {type: Object, required: true},
    correctChoice: {type: String, required: true},
    canSubmit: {type: Boolean, required: true},
    submitting: {type: Boolean, required: true},
    loadingQuestion: {type: Boolean, required: true},
    submitMessage: {type: String, required: true},
    renderedSubmitMessage: {type: String, required: true},
    answeringCount: {type: Number, required: true}
})

const emit = defineEmits([
    'request-ai-answer',
    'after-question-enter',
    'submit-answer',
    'next-question',
    'math-input',
    'question-render-ref'
])

function registerQuestionRef(element) {
    emit('question-render-ref', element)
}
</script>

<template>
    <section :class="{ 'question-panel-completed': isTodayCompleted }" class="panel question-panel">
        <div class="question-heading">
            <div class="question-heading-left">
                <h2>{{ isTodayCompleted ? '' : '当前题目' }}</h2>
                <span v-if="question && !isTodayCompleted" class="question-meta">题号 #{{ question.questionId }} · 难度 {{
                        question.difficultyLevel
                    }}</span>
            </div>
            <Transition name="ai-button">
                <button
                    v-if="answerCompleted && !isTodayCompleted"
                    :disabled="loadingAiAnswer"
                    class="ai-analysis-btn"
                    type="button"
                    @click="emit('request-ai-answer')"
                >
                    {{ loadingAiAnswer ? '解析中...' : 'AI解析' }}
                </button>
            </Transition>
        </div>

        <div v-if="isTodayCompleted" class="today-completed">
            <span class="today-completed-emoji">📜</span>
            <p class="today-completed-text">今日答题已完成</p>
            <p class="today-completed-sub">请明日再来挑战，继续冲刺连胜！</p>
        </div>

        <template v-if="!isTodayCompleted">
            <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

            <Transition mode="out-in" name="fade-slide" @after-enter="emit('after-question-enter')">
                <div v-if="question" :key="question.questionId" :ref="registerQuestionRef" class="question-container">
                    <div class="question-description">{{ preprocessMath(question.description) }}</div>

                    <form :class="{ 'answer-completed': answerCompleted }" class="answer-form" @submit.prevent="emit('submit-answer')">
                        <template v-if="question.type === 1">
                            <label
                                v-for="item in ['A', 'B', 'C', 'D']"
                                :key="item"
                                :class="{
                                    'option-correct': answerCompleted && correctChoice === item,
                                    'option-wrong': answerCompleted && answerForm.choice === item && correctChoice !== item,
                                    'option-unselected': answerCompleted && correctChoice !== item && answerForm.choice !== item
                                }"
                                class="option"
                            >
                                <input v-model="answerForm.choice" :disabled="answerCompleted" :value="item" name="choice" type="radio"/>
                                <span class="option-text">{{ item }}. {{ preprocessMath(question[`opt${item}`]) }}</span>
                            </label>
                        </template>

                        <template v-else>
                            <label class="latex-label" for="latex-input">LaTeX 填空答案</label>
                            <math-field
                                id="latex-input"
                                :value="answerForm.latexAnswer"
                                class="latex-editor"
                                virtual-keyboard-mode="onfocus"
                                @input="emit('math-input', $event)"
                            ></math-field>
                        </template>

                        <div :class="{ 'has-next-action': answerCompleted }" class="answer-actions">
                            <button :disabled="!canSubmit" class="primary-btn answer-action-btn" type="submit">
                                {{ submitting ? '提交中...' : '提交答案' }}
                            </button>
                            <Transition name="next-button">
                                <button
                                    v-if="answerCompleted"
                                    :disabled="loadingQuestion"
                                    class="secondary-btn answer-action-btn"
                                    type="button"
                                    @click="emit('next-question')"
                                >
                                    {{ loadingQuestion ? '加载中...' : '下一题' }}
                                </button>
                            </Transition>
                        </div>
                    </form>
                </div>
            </Transition>

            <p v-if="loadingQuestion" class="loading-tip">正在切换题目...</p>
            <div class="question-footer">
                <p v-if="submitMessage" class="submit-message" v-html="renderedSubmitMessage"></p>
                <p class="answering-count">正在答题人数：{{ answeringCount }}</p>
            </div>
        </template>
    </section>
</template>
