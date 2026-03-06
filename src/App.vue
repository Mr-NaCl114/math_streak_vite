<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import 'mathlive'
import renderMathInElement from 'katex/contrib/auto-render'
import { fetchCurrentQuestion, GAME_WS_URL, loginAccount, registerAccount, submitAnswer } from './api/game'

const loadingQuestion = ref(false)
const prefetching = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const submitMessage = ref('')
const wsStatus = ref('连接中')
const showMilestoneModal = ref(false)
const showFailModal = ref(false)
const showLoginModal = ref(false)
const authMode = ref('login')
const authMessage = ref('')
const showAccountMenu = ref(false)
const reconnectTimer = ref(null)

const question = ref(null)
const prefetchedQuestion = ref(null)
const questionRenderRef = ref(null)

const answerForm = reactive({
  choice: '',
  latexAnswer: ''
})

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
  currentQuestionAnsweringCount: 0,
  failedAccountLevelHeatmap: []
})

const milestoneList = ref([])
const failedQuestionList = ref([])

let wsClient = null

const lifeProgress = computed(() => {
  if (!gameStats.maxLife) return 0
  return Math.min(100, Math.round((gameStats.life / gameStats.maxLife) * 100))
})

const canSubmit = computed(() => {
  if (!question.value || submitting.value) return false
  if (question.value.type === 1) return Boolean(answerForm.choice)
  return Boolean(answerForm.latexAnswer.trim())
})

function normalizeQuestionText(value) {
  return (value || '').replace(/\\n/g, '\n')
}

function resetAnswerInput() {
  answerForm.choice = ''
  answerForm.latexAnswer = ''
}

async function renderMathContent() {
  await nextTick()
  if (!questionRenderRef.value) return
  renderMathInElement(questionRenderRef.value, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true }
    ],
    throwOnError: false
  })
}

async function loadQuestion({ usePrefetch = true } = {}) {
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
  if (prefetching.value || prefetchedQuestion.value) return
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

    submitMessage.value = result.correct === 1
      ? '回答正确，连胜继续！'
      : `回答错误，参考答案：${result.correctLatexAnswer || '以后端返回为准'}`

    await loadQuestion({ usePrefetch: true })
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
        applyStats(message.data)
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

onMounted(async () => {
  await loadQuestion({ usePrefetch: false })
  connectWebsocket()
})

onBeforeUnmount(() => {
  if (reconnectTimer.value) clearTimeout(reconnectTimer.value)
  if (wsClient) wsClient.close()
})
</script>

<template>
  <main class="page">
    <header class="arena-header">
      <div>
        <h1>Math Streak Arena</h1>
        <p>按连胜进阶难度，实时协同同场挑战。</p>
      </div>

      <div class="account-area">
        <button class="secondary-btn" type="button" @click="toggleAuthPanel">
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
      <article class="stats-block life-block compact-card">
        <p class="stats-label">❤️ 生命值</p>
        <div class="life-inline">
          <p class="stats-value">{{ gameStats.life }}/{{ gameStats.maxLife }}</p>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${lifeProgress}%` }"></div>
          </div>
        </div>
      </article>
      <article class="stats-block compact-card">
        <p class="stats-label">🔥 当前连胜</p>
        <p class="stats-value">{{ gameStats.totalStreak }}</p>
      </article>
      <article class="stats-block compact-card">
        <p class="stats-label">🏆 最大连胜</p>
        <p class="stats-value">{{ gameStats.maxStreak }}</p>
      </article>
      <article class="stats-block compact-card">
        <p class="stats-label">📅 今日剩余次数</p>
        <p class="stats-value">{{ gameStats.accountTodayRemainingCount }}</p>
        <p class="tip">WebSocket：{{ wsStatus }}</p>
      </article>
    </section>

    <section class="panel question-panel">
      <h2>当前题目</h2>
      <p class="answering-count">当前题目正在答题人数：{{ gameStats.currentQuestionAnsweringCount }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <Transition name="fade-slide" mode="out-in" @after-enter="renderMathContent">
        <div v-if="question" :key="question.questionId" class="question-container" ref="questionRenderRef">
          <p class="question-meta">题号 #{{ question.questionId }} · 难度 {{ question.difficultyLevel }}</p>
          <div class="question-description">{{ normalizeQuestionText(question.description) }}</div>

          <form class="answer-form" @submit.prevent="handleSubmit">
            <template v-if="question.type === 1">
              <label
                class="option"
                v-for="item in ['A', 'B', 'C', 'D']"
                :key="item"
              >
                <input v-model="answerForm.choice" type="radio" name="choice" :value="item" />
                <span class="option-text">{{ item }}. {{ normalizeQuestionText(question[`opt${item}`]) }}</span>
              </label>
            </template>

            <template v-else>
              <label class="latex-label" for="latex-input">LaTeX 填空答案</label>
              <math-field
                id="latex-input"
                class="latex-editor"
                virtual-keyboard-mode="onfocus"
                :value="answerForm.latexAnswer"
                @input="handleMathInput"
              ></math-field>
            </template>

            <button class="primary-btn" type="submit" :disabled="!canSubmit">
              {{ submitting ? '提交中...' : '提交答案' }}
            </button>
          </form>
        </div>
      </Transition>

      <p v-if="loadingQuestion" class="loading-tip">正在切换题目...</p>
      <p v-if="submitMessage" class="submit-message">{{ submitMessage }}</p>
    </section>

    <section class="panel extra-panel">
      <h2>数据展示</h2>
      <div class="extra-actions">
        <button type="button" class="secondary-btn" @click="showMilestoneModal = true">查看里程碑</button>
        <button type="button" class="secondary-btn" @click="showFailModal = true">查看连胜中断题目</button>
      </div>
      <div class="heatmap-placeholder">
        <h3>失败账号等级热力图</h3>
        <p>后端 WebSocket 字段：failedAccountLevelHeatmap</p>
      </div>
    </section>

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
          <input v-model="loginForm.account" class="auth-input" type="text" placeholder="账号" required />
          <input v-model="loginForm.password" class="auth-input" type="password" placeholder="密码" required />
          <button class="primary-btn" type="submit">登录</button>
        </form>

        <form v-else class="answer-form" @submit.prevent="submitRegister">
          <input v-model="registerForm.account" class="auth-input" type="text" placeholder="账号" required />
          <input v-model="registerForm.nickname" class="auth-input" type="text" placeholder="昵称" required />
          <input v-model="registerForm.password" class="auth-input" type="password" placeholder="密码" required />
          <button class="primary-btn" type="submit">注册</button>
        </form>

        <p v-if="authMessage" class="submit-message">{{ authMessage }}</p>
      </article>
    </div>
  </main>
</template>
