<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { fetchCurrentQuestion, GAME_WS_URL, submitAnswer } from './api/game'

const loadingQuestion = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const submitMessage = ref('')
const wsStatus = ref('连接中')
const showMilestoneModal = ref(false)
const showFailModal = ref(false)
const reconnectTimer = ref(null)

const question = ref(null)

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

let wsClient = null

const lifeProgress = computed(() => {
  if (!gameStats.maxLife) {
    return 0
  }
  return Math.min(100, Math.round((gameStats.life / gameStats.maxLife) * 100))
})

const canSubmit = computed(() => {
  if (!question.value || submitting.value) {
    return false
  }
  if (question.value.type === 1) {
    return Boolean(answerForm.choice)
  }
  return Boolean(answerForm.latexAnswer.trim())
})

function resetAnswerInput() {
  answerForm.choice = ''
  answerForm.latexAnswer = ''
}

async function loadQuestion() {
  loadingQuestion.value = true
  errorMessage.value = ''

  try {
    question.value = await fetchCurrentQuestion()
    resetAnswerInput()
  } catch (error) {
    question.value = null
    errorMessage.value = error.message || '题目加载失败'
  } finally {
    loadingQuestion.value = false
  }
}

async function handleSubmit() {
  if (!question.value) {
    return
  }

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

    await loadQuestion()
  } catch (error) {
    submitMessage.value = error.message || '提交失败'
  } finally {
    submitting.value = false
  }
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
    } catch (error) {
      wsStatus.value = '消息解析失败'
    }
  }

  wsClient.onerror = () => {
    wsStatus.value = '连接异常'
  }

  wsClient.onclose = () => {
    wsStatus.value = '已断开，重连中'
    reconnectTimer.value = window.setTimeout(() => {
      connectWebsocket()
    }, 3000)
  }
}

onMounted(async () => {
  await loadQuestion()
  connectWebsocket()
})

onBeforeUnmount(() => {
  if (reconnectTimer.value) {
    clearTimeout(reconnectTimer.value)
  }

  if (wsClient) {
    wsClient.close()
  }
})
</script>

<template>
  <main class="page">
    <header class="page-header">
      <h1>数学连胜挑战</h1>
      <p>每个 IP 按连胜动态提升难度，答错会扣生命值。</p>
    </header>

    <section class="panel stats-panel">
      <div class="stats-grid">
        <article class="mini-card">
          <p class="label">生命值</p>
          <p class="value">{{ gameStats.life }}/{{ gameStats.maxLife }}</p>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${lifeProgress}%` }"></div>
          </div>
        </article>

        <article class="mini-card">
          <p class="label">当前连胜</p>
          <p class="value">totalStreak {{ gameStats.totalStreak }}</p>
        </article>

        <article class="mini-card">
          <p class="label">最大连胜</p>
          <p class="value">{{ gameStats.maxStreak }}</p>
        </article>

        <article class="mini-card">
          <p class="label">IP 限制</p>
          <p class="value">{{ gameStats.ipLimit }}</p>
          <p class="tip">WebSocket：{{ wsStatus }}</p>
        </article>
      </div>
    </section>

    <section class="panel question-panel">
      <h2>当前题目</h2>
      <p v-if="loadingQuestion">题目加载中...</p>
      <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>
      <template v-else-if="question">
        <p class="question-meta">题号 #{{ question.questionId }} · 难度 {{ question.difficultyLevel }}</p>
        <p class="question-description">{{ question.description || '题干由后端返回' }}</p>

        <form class="answer-form" @submit.prevent="handleSubmit">
          <template v-if="question.type === 1">
            <label class="option" v-for="item in ['A', 'B', 'C', 'D']" :key="item">
              <input v-model="answerForm.choice" type="radio" name="choice" :value="item" />
              <span>{{ item }}. {{ question[`opt${item}`] }}</span>
            </label>
          </template>

          <template v-else>
            <label class="latex-label" for="latex-input">LaTeX 填空答案</label>
            <textarea
              id="latex-input"
              v-model="answerForm.latexAnswer"
              class="latex-textarea"
              rows="4"
              placeholder="请输入 LaTeX 表达式，例如 \frac{1}{2}"
            ></textarea>
          </template>

          <button class="primary-btn" type="submit" :disabled="!canSubmit">
            {{ submitting ? '提交中...' : '提交答案' }}
          </button>
        </form>

        <p v-if="submitMessage" class="submit-message">{{ submitMessage }}</p>
      </template>
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
