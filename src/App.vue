<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef} from 'vue'
import 'mathlive'
import katex from 'katex'
import MarkdownIt from 'markdown-it'
import texmath from 'markdown-it-texmath'
import 'markdown-it-texmath/css/texmath.css'
import renderMathInElement from 'katex/contrib/auto-render'
import {preprocessMath} from './utils/math-preprocessor'
import {useAnimationFlag} from './composables/useAnimationFlags'
import {useTypewriter} from './composables/useTypewriter'
import {createIdleScheduler, createRafScheduler} from './utils/scheduler'
import {fetchAiAnswer, fetchCurrentQuestion, GAME_WS_URL, loginAccount, registerAccount, submitAnswer} from './api/game'

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

const wsStatus = ref('连接中')
const showMilestoneModal = ref(false)
const showFailModal = ref(false)
const showLoginModal = ref(false)
const authMode = ref('login')
const authMessage = ref('')
const showAccountMenu = ref(false)
const reconnectTimer = ref(null)

const question = shallowRef(null)
const prefetchedQuestion = shallowRef(null)
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
    answeringCount: 0,
    failedAccountLevelHeatmap: []
})

const isTodayCompleted = computed(() => gameStats.accountTodayRemainingCount === 0)

const milestoneList = ref([])
const failedQuestionList = ref([])

// Flip counter animation state
const streakFlip = useAnimationFlag()
const maxStreakFlip = useAnimationFlag()
const lifeFlip = useAnimationFlag()
const streakShake = useAnimationFlag()

// Title button easter egg state
const titleClickCount = ref(0)
let titleClickTimer = null
const titleBounce = useAnimationFlag()
const remainingCountShake = useAnimationFlag()
const titleEmoji = ref('')

const markdownRenderer = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true
}).use(texmath, {
    engine: katex,
    delimiters: ['dollars', 'brackets', 'beg_end'],
    katexOptions: {
        throwOnError: false,
        strict: false
    }
})

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

const renderMarkdown = text => markdownRenderer.render(preprocessMath(text))
const typewriter = useTypewriter(renderMarkdown)
const renderedSubmitMessage = computed(() => markdownRenderer.renderInline(preprocessMath(submitMessage.value)))

function resetAnswerInput() {
    answerForm.choice = ''
    answerForm.latexAnswer = ''
    answerCompleted.value = false
    submitMessage.value = ''
    correctChoice.value = ''
    currentQuestionSign.value = ''
    aiAnswerMessage.value = ''
    aiAnswerError.value = ''
    typewriter.clear()
    showAiAnswerPanel.value = false
}

const mathRenderOptions = {
    delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
    ],
    throwOnError: false
}

async function renderMathContent() {
    await nextTick()
    if (!questionRenderRef.value) return
    renderMathInElement(questionRenderRef.value, mathRenderOptions)
}

async function renderAiAnswerMath() {
    await nextTick()
    if (!aiAnswerRenderRef.value) return
    renderMathInElement(aiAnswerRenderRef.value, mathRenderOptions)
}

const questionMathScheduler = createRafScheduler(renderMathContent)
const aiAnswerMathScheduler = createIdleScheduler(renderAiAnswerMath)

async function requestAiAnswer() {
    if (!question.value || loadingAiAnswer.value) return

    showAiAnswerPanel.value = true
    loadingAiAnswer.value = true
    aiAnswerError.value = ''
    typewriter.clear()

    try {
        const data = await fetchAiAnswer({
            type: question.value.type,
            questionId: question.value.questionId,
            sign: currentQuestionSign.value
        })
        aiAnswerMessage.value = data?.msg || '暂无 AI 解析内容。'
        loadingAiAnswer.value = false
        typewriter.start(aiAnswerMessage.value)
        aiAnswerMathScheduler.schedule()
    } catch (error) {
        aiAnswerError.value = error.message || 'AI 解析加载失败'
        loadingAiAnswer.value = false
    }
}

async function handleNextQuestion() {
    showAiAnswerPanel.value = false
    aiAnswerMessage.value = ''
    aiAnswerError.value = ''
    typewriter.clear()
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
            streakShake.trigger()
        }
        streakFlip.trigger()
    }
    if (newMaxStreak !== undefined && newMaxStreak !== gameStats.maxStreak) {
        maxStreakFlip.trigger()
    }
    if (newLife !== undefined && newLife !== gameStats.life) {
        lifeFlip.trigger()
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
                questionMathScheduler.schedule()
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
    titleBounce.trigger()

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
                remainingCountShake.trigger()
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
    typewriter.clear()
    questionMathScheduler.cancel()
    aiAnswerMathScheduler.cancel()
    streakFlip.dispose()
    maxStreakFlip.dispose()
    lifeFlip.dispose()
    streakShake.dispose()
    titleBounce.dispose()
    remainingCountShake.dispose()
})
</script>

<template>
    <main class="page">
        <header class="arena-header">
            <div>
                <button
                    :class="{ 'title-bounce': titleBounce.active.value }"
                    class="title-btn"
                    @animationend="titleBounce.reset"
                    @click="handleTitleClick"
                >Math Streak Arena{{ titleEmoji }}
                </button>
                <p>按连胜进阶难度，实时协同同场挑战。</p>
            </div>

            <div class="account-area">
                <button v-if="false" class="secondary-btn" type="button" @click="toggleAuthPanel">
                    {{ accountState.loggedIn ? (accountState.nickname || accountState.account) : '登录' }}
                </button>

                <article v-if="showAccountMenu && accountState.loggedIn" class="account-menu">
                    <p><strong>当前等级：</strong>{{ accountState.accountLevel }}</p>
                    <p><strong>正确率：</strong>{{ accountState.accuracy }}</p>
                    <p><strong>历史题目：</strong>{{ accountState.historyQuestions.length }}</p>
                    <button class="secondary-btn" type="button" @click="logout">退出登录</button>
                </article>
            </div>
        </header>

        <section class="stats-banner">
            <article :class="{ 'life-low-glow': isLifeLow }" class="stats-block life-block compact-card">
                <p class="stats-label">❤️ 生命值</p>
                <div class="life-inline">
                    <p class="stats-value">
            <span
                :class="{ flipping: lifeFlip.active.value }"
                class="flip-number"
                @animationend="lifeFlip.reset"
            >{{ gameStats.life }}</span>/{{ gameStats.maxLife }}
                    </p>
                    <div class="progress-track">
                        <div :style="{ width: `${lifeProgress}%` }" class="progress-fill"></div>
                    </div>
                </div>
            </article>
            <article
                :class="{ 'streak-shaking': streakShake.active.value }"
                class="stats-block compact-card"
                @animationend="streakShake.reset"
            >
                <p class="stats-label">🔥 当前连胜</p>
                <p class="stats-value">
          <span
              :class="{ flipping: streakFlip.active.value }"
              class="flip-number"
              @animationend="streakFlip.reset"
          >{{ gameStats.totalStreak }}</span>
                </p>
            </article>
            <article class="stats-block compact-card">
                <p class="stats-label">🏆 最大连胜</p>
                <p class="stats-value">
          <span
              :class="{ flipping: maxStreakFlip.active.value }"
              class="flip-number"
              @animationend="maxStreakFlip.reset"
          >{{ gameStats.maxStreak }}</span>
                </p>
            </article>
            <article
                :class="{ 'streak-shaking': remainingCountShake.active.value }"
                class="stats-block compact-card"
                @animationend="remainingCountShake.reset"
            >
                <p class="stats-label">📅 今日剩余次数</p>
                <p class="stats-value">{{ gameStats.accountTodayRemainingCount }}</p>
            </article>
        </section>

        <section class="content-grid">
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
                            @click="requestAiAnswer"
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

                    <Transition mode="out-in" name="fade-slide" @after-enter="renderMathContent">
                        <div v-if="question" :key="question.questionId" ref="questionRenderRef"
                             class="question-container">
                            <div class="question-description">{{ preprocessMath(question.description) }}</div>

                            <form :class="{ 'answer-completed': answerCompleted }" class="answer-form"
                                  @submit.prevent="handleSubmit">
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
                                        <input v-model="answerForm.choice" :disabled="answerCompleted" :value="item" name="choice"
                                               type="radio"/>
                                        <span class="option-text">{{ item }}. {{
                                                preprocessMath(question[`opt${item}`])
                                            }}</span>
                                    </label>
                                </template>

                                <template v-else>
                                    <label class="latex-label" for="latex-input">LaTeX 填空答案</label>
                                    <math-field
                                        id="latex-input"
                                        :value="answerForm.latexAnswer"
                                        class="latex-editor"
                                        virtual-keyboard-mode="onfocus"
                                        @input="handleMathInput"
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
                                            @click="handleNextQuestion"
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
                        <p class="answering-count">正在答题人数：{{ gameStats.answeringCount }}</p>
                    </div>
                </template>
            </section>

            <section class="panel extra-panel">
                <h2>数据展示</h2>
                <div class="extra-actions">
                    <button class="secondary-btn" type="button" @click="showMilestoneModal = true">查看里程碑</button>
                    <button class="secondary-btn" type="button" @click="showFailModal = true">查看连胜中断题目</button>
                </div>
                <div class="heatmap-placeholder">
                    <h3>失败账号等级热力图</h3>
                    <p>failedAccountLevelHeatmap</p>
                </div>
            </section>
        </section>

        <Transition name="fade-slide">
            <section v-if="showAiAnswerPanel" class="panel ai-answer-panel">
                <div class="modal-heading">
                    <div>
                        <p class="stats-label">当前题号 #{{ question?.questionId }}</p>
                        <h3>AI 解析</h3>
                    </div>
                    <button class="secondary-btn" type="button" @click="showAiAnswerPanel = false">收起解析</button>
                </div>

                <p v-if="loadingAiAnswer" class="loading-tip">正在生成 AI 解析...</p>
                <p v-if="aiAnswerError" class="error">{{ aiAnswerError }}</p>
                <div
                    v-if="aiAnswerMessage"
                    ref="aiAnswerRenderRef"
                    class="markdown-body ai-answer-content"
                >
                    <span v-html="typewriter.renderedText.value"></span>
                    <span v-if="typewriter.active.value" class="typewriter-cursor"></span>
                </div>
            </section>
        </Transition>

        <div v-if="showMilestoneModal" class="modal-mask" @click.self="showMilestoneModal = false">
            <article class="modal-card">
                <h3>最大连胜里程碑</h3>
                <p v-if="milestoneList.length === 0">暂无后端返回数据。</p>
                <button class="secondary-btn" @click="showMilestoneModal = false">关闭</button>
            </article>
        </div>

        <div v-if="showFailModal" class="modal-mask" @click.self="showFailModal = false">
            <article class="modal-card">
                <h3>连胜中断题目</h3>
                <p v-if="failedQuestionList.length === 0">暂无后端返回数据。</p>
                <button class="secondary-btn" @click="showFailModal = false">关闭</button>
            </article>
        </div>


        <div v-if="showLoginModal" class="modal-mask" @click.self="showLoginModal = false">
            <article class="modal-card">
                <div class="auth-tabs">
                    <button class="secondary-btn" type="button" @click="authMode = 'login'">登录</button>
                    <button class="secondary-btn" type="button" @click="authMode = 'register'">注册</button>
                </div>

                <form v-if="authMode === 'login'" class="answer-form" @submit.prevent="submitLogin">
                    <input v-model="loginForm.account" class="auth-input" placeholder="账号" required type="text"/>
                    <input v-model="loginForm.password" class="auth-input" placeholder="密码" required type="password"/>
                    <button class="primary-btn" type="submit">登录</button>
                </form>

                <form v-else class="answer-form" @submit.prevent="submitRegister">
                    <input v-model="registerForm.account" class="auth-input" placeholder="账号" required type="text"/>
                    <input v-model="registerForm.nickname" class="auth-input" placeholder="昵称" required type="text"/>
                    <input v-model="registerForm.password" class="auth-input" placeholder="密码" required
                           type="password"/>
                    <button class="primary-btn" type="submit">注册</button>
                </form>

                <p v-if="authMessage" class="submit-message">{{ authMessage }}</p>
            </article>
        </div>
    </main>
</template>
