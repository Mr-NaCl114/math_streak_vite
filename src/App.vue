<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch} from 'vue'
import {cancelScheduledMathRender, ensureMathliveLoaded, renderMarkdown, scheduleMathRender} from './services/math-renderer'
import {fetchAiAnswer, fetchCurrentQuestion, GAME_WS_URL, loginAccount, registerAccount, submitAnswer} from './api/game'
import AiAnswerPanel from './components/AiAnswerPanel.vue'
import AppHeader from './components/AppHeader.vue'
import AppModals from './components/AppModals.vue'
import ExtraPanel from './components/ExtraPanel.vue'
import QuestionPanel from './components/QuestionPanel.vue'
import StatsBanner from './components/StatsBanner.vue'

const loadingQuestion = ref(false)
const prefetching = ref(false)
const submitting = ref(false)
const answerCompleted = ref(false)
const loadingAiAnswer = ref(false)
const showAiAnswerPanel = ref(false)
const errorMessage = ref('')
const submitMessage = ref('')
const aiAnswerMessage = ref('')
const aiAnswerError = ref('')
const typewriterText = ref('')
const typewriterActive = ref(false)
const renderedTypewriterText = ref('')
const renderedSubmitMessage = ref('')
let typewriterTimer = null
let typewriterFrame = null
let typewriterLastPaint = 0
const wsStatus = ref('连接中')
const showLoginModal = ref(false)
const authMode = ref('login')
const authMessage = ref('')
const showAccountMenu = ref(false)
const reconnectTimer = ref(null)

const question = ref(null)
const prefetchedQuestion = ref(null)
const questionRenderRef = ref(null)
const aiAnswerRenderRef = ref(null)

const answerForm = reactive({
    choice: '',
    latexAnswer: ''
})

const correctChoice = ref('')
const currentQuestionSign = ref('')

const loginForm = reactive({
    account: '',
    password: ''
})

const registerForm = reactive({
    account: '',
    nickname: '',
    password: ''
})

const accountState = reactive({
    loggedIn: false,
    account: '',
    nickname: '',
    accountLevel: '--',
    accuracy: '--',
    historyQuestions: []
})

const gameStats = reactive({
    totalStreak: 0,
    maxStreak: 0,
    life: 0,
    maxLife: 1,
    accountTodayRemainingCount: 0,
    answeringCount: 0
})

const isTodayCompleted = computed(() => gameStats.accountTodayRemainingCount === 0)

// Incremental fail/interrupt tracking: key = "type-questionId"
const failInterruptData = reactive({})

// Flip counter animation state
const streakFlipping = ref(false)
const maxStreakFlipping = ref(false)
const lifeFlipping = ref(false)
const streakShaking = ref(false)

// Global settings state
const showGlobalSettings = ref(false)
const activeMetric = ref('fail') // 'fail' | 'interrupt'
const sortOrder = ref('count') // 'count' | 'id'

const SETTINGS_KEY = 'math-streak-global-settings'
onMounted(() => {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
        if (saved) {
            if (saved.activeMetric === 'fail' || saved.activeMetric === 'interrupt') activeMetric.value = saved.activeMetric
            if (saved.sortOrder === 'id' || saved.sortOrder === 'count') sortOrder.value = saved.sortOrder
        }
    } catch { /* ignore */ }
})
watch([activeMetric, sortOrder], () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        activeMetric: activeMetric.value,
        sortOrder: sortOrder.value
    }))
})

function toggleGlobalSettings() {
    showGlobalSettings.value = !showGlobalSettings.value
}

// Title button easter egg state
const titleClickCount = ref(0)
let titleClickTimer = null
const titleBounce = ref(false)
const titleBounceKey = ref(0)
const remainingCountShaking = ref(false)
const titleEmoji = ref('')

let wsClient = null

const lifeProgress = computed(() => {
    if (!gameStats.maxLife) return 0
    return Math.min(100, Math.round((gameStats.life / gameStats.maxLife) * 100))
})

const isLifeLow = computed(() => gameStats.life === 1)

const canSubmit = computed(() => {
    if (!question.value || submitting.value || answerCompleted.value) return false
    if (question.value.type === 1) return Boolean(answerForm.choice)
    return Boolean(answerForm.latexAnswer.trim())
})



function setQuestionRenderRef(element) {
    questionRenderRef.value = element
}

function setAiAnswerRenderRef(element) {
    aiAnswerRenderRef.value = element
}

function resetAnswerInput() {
    answerForm.choice = ''
    answerForm.latexAnswer = ''
    answerCompleted.value = false
    submitMessage.value = ''
    renderedSubmitMessage.value = ''
    correctChoice.value = ''
    currentQuestionSign.value = ''
    aiAnswerMessage.value = ''
    aiAnswerError.value = ''
    stopTypewriter()
    typewriterText.value = ''
    renderedTypewriterText.value = ''
    typewriterActive.value = false
    showAiAnswerPanel.value = false
}

async function renderMathContent() {
    await nextTick()
    scheduleMathRender(() => questionRenderRef.value)
}

async function renderAiAnswerMath() {
    await nextTick()
    scheduleMathRender(() => aiAnswerRenderRef.value)
}

async function paintTypewriter(force = false) {
    if (!force && performance.now() - typewriterLastPaint < 80) return
    typewriterLastPaint = performance.now()
    renderedTypewriterText.value = await renderMarkdown(typewriterText.value)
    renderAiAnswerMath()
}

async function requestAiAnswer() {
    if (!question.value || loadingAiAnswer.value) return

    showAiAnswerPanel.value = true
    loadingAiAnswer.value = true
    aiAnswerError.value = ''
    stopTypewriter()
    typewriterText.value = ''
    renderedTypewriterText.value = ''
    typewriterActive.value = false

    try {
        const data = await fetchAiAnswer({
            type: question.value.type,
            questionId: question.value.questionId,
            sign: currentQuestionSign.value
        })
        aiAnswerMessage.value = data?.msg || '暂无 AI 解析内容。'
        startTypewriter(aiAnswerMessage.value)
    } catch (error) {
        aiAnswerError.value = error.message || 'AI 解析加载失败'
        loadingAiAnswer.value = false
    }
}

function startTypewriter(fullText) {
    loadingAiAnswer.value = false
    typewriterActive.value = true
    let index = 0
    const speed = 25

    typewriterTimer = setInterval(() => {
        if (index < fullText.length) {
            // Batch several characters per tick for longer texts to feel snappy
            const batchSize = fullText.length > 2000 ? 4 : fullText.length > 500 ? 2 : 1
            index = Math.min(index + batchSize, fullText.length)
            typewriterText.value = fullText.slice(0, index)
            if (!typewriterFrame) {
                typewriterFrame = requestAnimationFrame(async () => {
                    typewriterFrame = null
                    await paintTypewriter()
                })
            }
        } else {
            stopTypewriter()
            paintTypewriter(true)
        }
    }, speed)
}

function stopTypewriter() {
    if (typewriterTimer) {
        clearInterval(typewriterTimer)
        typewriterTimer = null
    }
    if (typewriterFrame) {
        cancelAnimationFrame(typewriterFrame)
        typewriterFrame = null
    }
    typewriterActive.value = false
}

async function handleNextQuestion() {
    showAiAnswerPanel.value = false
    aiAnswerMessage.value = ''
    aiAnswerError.value = ''
    stopTypewriter()
    typewriterText.value = ''
    renderedTypewriterText.value = ''
    typewriterActive.value = false
    await loadQuestion({usePrefetch: true})
}


async function loadQuestion({usePrefetch = true} = {}) {
    if (isTodayCompleted.value) {
        question.value = null
        prefetchedQuestion.value = null
        resetAnswerInput()
        loadingQuestion.value = false
        return
    }

    loadingQuestion.value = true
    errorMessage.value = ''

    try {
        if (usePrefetch && prefetchedQuestion.value && prefetchedQuestion.value.questionId !== question.value?.questionId) {
            question.value = prefetchedQuestion.value
            prefetchedQuestion.value = null
        } else {
            question.value = await fetchCurrentQuestion()
        }

        resetAnswerInput()
        if (question.value?.type !== 1) await ensureMathliveLoaded()
        await renderMathContent()
        prefetchNextQuestion()
    } catch (error) {
        errorMessage.value = error.message || '题目加载失败'
    } finally {
        loadingQuestion.value = false
    }
}

async function prefetchNextQuestion() {
    if (isTodayCompleted.value || prefetching.value || prefetchedQuestion.value) return
    prefetching.value = true
    try {
        const incoming = await fetchCurrentQuestion()
        if (incoming?.questionId !== question.value?.questionId) {
            prefetchedQuestion.value = incoming
        }
    } catch {
        // 预取失败不阻塞主流程
    } finally {
        prefetching.value = false
    }
}

async function handleSubmit() {
    if (!question.value) return

    submitting.value = true
    submitMessage.value = ''

    try {
        const result = await submitAnswer({
            type: question.value.type,
            questionId: question.value.questionId,
            answerContent: question.value.type === 1 ? answerForm.choice : answerForm.latexAnswer
        })

        currentQuestionSign.value = result.sign || ''
        correctChoice.value = question.value.type === 1 ? (result.correctLatexAnswer || '') : ''
        submitMessage.value = result.isCorrect
            ? '回答正确，连胜继续！'
            : result.correctLatexAnswer
                ? `回答错误，参考答案：\\(${result.correctLatexAnswer}\\)`
                : '回答错误，参考答案：以后端返回为准'
        renderedSubmitMessage.value = await renderMarkdown(submitMessage.value, {inline: true})
        answerCompleted.value = true
    } catch (error) {
        submitMessage.value = error.message || '提交失败'
    } finally {
        submitting.value = false
    }
}

function handleMathInput(event) {
    answerForm.latexAnswer = event.target.value
}

function applyStats(data) {
    if (!data) return

    // Detect changes for flip animation (before applying new values)
    const newStreak = data.totalStreak
    const newMaxStreak = data.maxStreak
    const newLife = data.life

    if (newStreak !== undefined && newStreak !== gameStats.totalStreak) {
        if (gameStats.totalStreak > 0 && newStreak === 0) {
            streakShaking.value = true
        }
        streakFlipping.value = true
    }
    if (newMaxStreak !== undefined && newMaxStreak !== gameStats.maxStreak) {
        maxStreakFlipping.value = true
    }
    if (newLife !== undefined && newLife !== gameStats.life) {
        lifeFlipping.value = true
    }

    // Incrementally merge failInterruptList — only update changed entries
    if (Array.isArray(data.failInterruptList)) {
        for (const item of data.failInterruptList) {
            const key = `${item.type}-${item.questionId}`
            failInterruptData[key] = {
                failTimes: item.failTimes ?? 0,
                interruptTimes: item.interruptTimes ?? 0
            }
        }
    }

    Object.assign(gameStats, data)
    if (data.accountLevel !== undefined) accountState.accountLevel = data.accountLevel
    if (data.accuracy !== undefined) accountState.accuracy = data.accuracy
    if (data.historyQuestions !== undefined) accountState.historyQuestions = data.historyQuestions || []
}

function connectWebsocket() {
    wsStatus.value = '连接中'
    wsClient = new WebSocket(GAME_WS_URL)

    wsClient.onopen = () => {
        wsStatus.value = '已连接'
    }

    wsClient.onmessage = event => {
        try {
            const message = JSON.parse(event.data)
            if (message.code === '0000') {
                const prevCount = gameStats.accountTodayRemainingCount
                applyStats(message.data)
                // 监听今日剩余次数从 0 变为正整数时自动恢复答题
                if (prevCount === 0 && gameStats.accountTodayRemainingCount > 0) {
                    loadQuestion({usePrefetch: false})
                }
                renderMathContent()
            }
        } catch {
            wsStatus.value = '消息解析失败'
        }
    }

    wsClient.onerror = () => {
        wsStatus.value = '连接异常'
    }

    wsClient.onclose = () => {
        wsStatus.value = '已断开，重连中'
        reconnectTimer.value = window.setTimeout(connectWebsocket, 3000)
    }
}

async function submitLogin() {
    authMessage.value = ''
    try {
        const data = await loginAccount({
            account: loginForm.account,
            password: loginForm.password
        })
        accountState.loggedIn = true
        accountState.account = data?.account || loginForm.account
        accountState.nickname = data?.nickname || ''
        if (data?.accountLevel !== undefined) accountState.accountLevel = data.accountLevel
        if (data?.accuracy !== undefined) accountState.accuracy = data.accuracy
        if (data?.historyQuestions !== undefined) accountState.historyQuestions = data.historyQuestions
        showLoginModal.value = false
    } catch (error) {
        authMessage.value = error.message || '登录失败'
    }
}

async function submitRegister() {
    authMessage.value = ''
    try {
        await registerAccount({
            account: registerForm.account,
            nickname: registerForm.nickname,
            password: registerForm.password
        })
        authMode.value = 'login'
        authMessage.value = '注册成功，请登录。'
    } catch (error) {
        authMessage.value = error.message || '注册失败'
    }
}

function toggleAuthPanel() {
    if (accountState.loggedIn) {
        showAccountMenu.value = !showAccountMenu.value
        return
    }
    showLoginModal.value = true
    authMode.value = 'login'
}

function logout() {
    accountState.loggedIn = false
    accountState.account = ''
    accountState.nickname = ''
    accountState.accountLevel = '--'
    accountState.accuracy = '--'
    accountState.historyQuestions = []
    showAccountMenu.value = false
}

async function handleTitleClick() {
    // Shrink animation
    titleBounce.value = true
    titleBounceKey.value += 1

    // Reset the gap timer
    if (titleClickTimer) clearTimeout(titleClickTimer)

    titleClickCount.value++
    titleClickTimer = window.setTimeout(() => {
        titleClickCount.value = 0
    }, 1000)

    if (titleClickCount.value >= 99) {
        titleClickCount.value = 0
        clearTimeout(titleClickTimer)
        titleClickTimer = null

        try {
            // const resp = await fetch('https://lodsced.cloud/api/game/reset_count', { method: 'POST' })
            const resp = await fetch('http://127.0.0.1:10001/api/game/reset_count', {method: 'POST'})
            if (resp.ok) {
                remainingCountShaking.value = true
                const emojis = ['🎉', '✨', '🌟', '💫', '🔥', '🎯', '🏆', '💎', '⚡', '🍀', '🎲', '🃏', '👑', '🚀', '🌈']
                titleEmoji.value = emojis[Math.floor(Math.random() * emojis.length)]
            }
        } catch {
            // Silently fail - this is an easter egg
        }
    }
}

onMounted(async () => {
    await loadQuestion({usePrefetch: false})
    connectWebsocket()
})

onBeforeUnmount(() => {
    if (reconnectTimer.value) clearTimeout(reconnectTimer.value)
    if (titleClickTimer) clearTimeout(titleClickTimer)
    if (wsClient) wsClient.close()
    stopTypewriter()
    cancelScheduledMathRender()
})
</script>

<template>
    <main class="page">
        <AppHeader
            :account-state="accountState"
            :show-account-menu="showAccountMenu"
            :show-global-settings="showGlobalSettings"
            :title-bounce="titleBounce"
            :title-bounce-key="titleBounceKey"
            :title-emoji="titleEmoji"
            @logout="logout"
            @title-animation-end="titleBounce = false"
            @title-click="handleTitleClick"
            @toggle-auth-panel="toggleAuthPanel"
            @toggle-global-settings="toggleGlobalSettings"
        />

        <StatsBanner
            :game-stats="gameStats"
            :is-life-low="isLifeLow"
            :life-flipping="lifeFlipping"
            :life-progress="lifeProgress"
            :max-streak-flipping="maxStreakFlipping"
            :remaining-count-shaking="remainingCountShaking"
            :streak-flipping="streakFlipping"
            :streak-shaking="streakShaking"
            @life-animation-end="lifeFlipping = false"
            @max-streak-animation-end="maxStreakFlipping = false"
            @remaining-shake-end="remainingCountShaking = false"
            @streak-animation-end="streakFlipping = false"
            @streak-shake-end="streakShaking = false"
        />

        <section class="content-grid">
            <QuestionPanel
                :active-metric="activeMetric"
                :answer-completed="answerCompleted"
                :answer-form="answerForm"
                :answering-count="gameStats.answeringCount"
                :can-submit="canSubmit"
                :correct-choice="correctChoice"
                :error-message="errorMessage"
                :fail-interrupt-data="failInterruptData"
                :is-today-completed="isTodayCompleted"
                :loading-ai-answer="loadingAiAnswer"
                :loading-question="loadingQuestion"
                :question="question"
                :rendered-submit-message="renderedSubmitMessage"
                :submit-message="submitMessage"
                :submitting="submitting"
                @after-question-enter="renderMathContent"
                @math-input="handleMathInput"
                @next-question="handleNextQuestion"
                @question-render-ref="setQuestionRenderRef"
                @request-ai-answer="requestAiAnswer"
                @submit-answer="handleSubmit"
            />

            <div class="extra-panel-cell">
                <ExtraPanel
                    :active-metric="activeMetric"
                    :fail-interrupt-data="failInterruptData"
                    :sort-order="sortOrder"
                />
            </div>
        </section>

        <AiAnswerPanel
            :ai-answer-error="aiAnswerError"
            :ai-answer-message="aiAnswerMessage"
            :loading-ai-answer="loadingAiAnswer"
            :question-id="question?.questionId"
            :rendered-typewriter-text="renderedTypewriterText"
            :show-ai-answer-panel="showAiAnswerPanel"
            :typewriter-active="typewriterActive"
            @ai-answer-render-ref="setAiAnswerRenderRef"
            @close="showAiAnswerPanel = false"
        />

        <AppModals
            :auth-message="authMessage"
            :auth-mode="authMode"
            :login-form="loginForm"
            :register-form="registerForm"
            :show-login-modal="showLoginModal"
            @close-login="showLoginModal = false"
            @set-auth-mode="authMode = $event"
            @submit-login="submitLogin"
            @submit-register="submitRegister"
        />

        <!-- Global Settings Popup -->
        <Transition name="settings-fade">
            <div v-if="showGlobalSettings" class="settings-backdrop" @click.self="showGlobalSettings = false">
                <div class="settings-box">
                    <h3 class="settings-title">设置</h3>
                    <div class="settings-item">
                        <span class="settings-label">数据展示类型</span>
                        <label class="settings-radio">
                            <input
                                v-model="activeMetric"
                                name="activeMetric"
                                type="radio"
                                value="fail"
                            />
                            答错次数
                        </label>
                        <label class="settings-radio">
                            <input
                                v-model="activeMetric"
                                name="activeMetric"
                                type="radio"
                                value="interrupt"
                            />
                            中断次数
                        </label>
                    </div>
                    <div class="settings-item">
                        <span class="settings-label">排序方式</span>
                        <label class="settings-radio">
                            <input
                                v-model="sortOrder"
                                name="sortOrder"
                                type="radio"
                                value="count"
                            />
                            按次数排序
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
    </main>
</template>
