const BASE_URL = 'https://lodsced.cloud'

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  })

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`)
  }

  const json = await response.json()
  if (json.code !== '0000') {
    throw new Error(json.info || '业务请求失败')
  }

  return json.data
}

export function fetchCurrentQuestion() {
  return requestJson('/api/game/current-question')
}

export function submitAnswer(payload) {
  return requestJson('/api/game/submit', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export const GAME_WS_URL = 'wss://lodsced.cloud/ws/game'

// 以下接口为后续后端扩展预留
export const RESERVED_ENDPOINTS = {
  milestones: '/api/game/milestones',
  failedQuestions: '/api/game/failed-questions',
  chinaHeatmap: '/api/game/failed-heatmap'
}
