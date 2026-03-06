<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import 'mathlive'
import renderMathInElement from 'katex/contrib/auto-render'
import { fetchCurrentQuestion, GAME_WS_URL, submitAnswer } from './api/game'

const loadingQuestion = ref(false)
const prefetching = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const submitMessage = ref('')
const wsStatus = ref('连接中')
const showMilestoneModal = ref(false)
const showFailModal = ref(false)
const reconnectTimer = ref(null)

const question = ref(null)
const prefetchedQuestion = ref(null)

const answerForm = reactive({
  choice: '',
  latexAnswer: ''
})

const gameStats = reactive({
  totalStreak: 0,
  maxStreak: 0,
  life: 0,
  maxLife: 1,
  ipLimit: 0
})

const milestoneList = ref([])
const failedQuestionList = ref([])
const questionContentRef = ref(null)

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

async function renderMathBlocks() {
  await nextTick()
  const optionNodes = Array.from(document.querySelectorAll('.option-text'))
  const targets = [questionContentRef.value, ...optionNodes].filter(Boolean)
  targets.forEach(target => {
    renderMathInElement(target, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    })
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
    await renderMathBlocks()
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
    const payload = {
      type: question.value.type,
      questionId: question.value.questionId,
      answerContent: question.value.type === 1 ? answerForm.choice : answerForm.latexAnswer
    }

    const result = await submitAnswer(payload)
    const correct = result.correct === 1
    submitMessage.value = correct
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
  gameStats.totalStreak = data.totalStreak ?? 0
  gameStats.maxStreak = data.maxStreak ?? 0
  gameStats.life = data.life ?? 0
  gameStats.maxLife = data.maxLife ?? 1
  gameStats.ipLimit = data.ipLimit ?? 0
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
      if (message.code === '0000' && message.data) {
        applyStats(message.data)
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

watch(
  () => question.value?.questionId,
  async () => {
    await renderMathBlocks()
  }
)

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
      <h1>Math Streak Arena</h1>
      <p>按连胜进阶难度，实时协同同场挑战。</p>
    </header>

    <section class="stats-banner">
      <article class="stats-block life-block">
        <p class="stats-label">生命值</p>
        <p class="stats-value">{{ gameStats.life }}/{{ gameStats.maxLife }}</p>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${lifeProgress}%` }"></div>
        </div>
      </article>
      <article class="stats-block">
        <p class="stats-label">当前连胜</p>
        <p class="stats-value">{{ gameStats.totalStreak }}</p>
      </article>
      <article class="stats-block">
        <p class="stats-label">最大连胜</p>
        <p class="stats-value">{{ gameStats.maxStreak }}</p>
      </article>
      <article class="stats-block">
        <p class="stats-label">IP 限制</p>
        <p class="stats-value">{{ gameStats.ipLimit }}</p>
        <p class="tip">WebSocket：{{ wsStatus }}</p>
      </article>
    </section>

    <section class="panel question-panel">
      <h2>当前题目</h2>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <Transition name="fade-slide" mode="out-in">
        <div v-if="question" :key="question.questionId" class="question-container">
          <p class="question-meta">题号 #{{ question.questionId }} · 难度 {{ question.difficultyLevel }}</p>
          <p ref="questionContentRef" class="question-description">{{ normalizeQuestionText(question.description) }}</p>

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
        <h3>失败来源地理热力图（中国省区）</h3>
        <p>前端仅预留图层容器，数据与模糊地址由后端接口提供。</p>
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
  </main>
</template>
