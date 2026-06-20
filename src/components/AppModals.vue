<script setup>
defineProps({
    showMilestoneModal: {type: Boolean, required: true},
    showFailModal: {type: Boolean, required: true},
    showLoginModal: {type: Boolean, required: true},
    milestoneList: {type: Array, required: true},
    failedQuestionList: {type: Array, required: true},
    authMode: {type: String, required: true},
    authMessage: {type: String, required: true},
    loginForm: {type: Object, required: true},
    registerForm: {type: Object, required: true}
})

const emit = defineEmits([
    'close-milestones',
    'close-failures',
    'close-login',
    'set-auth-mode',
    'submit-login',
    'submit-register'
])
</script>

<template>
    <div v-if="showMilestoneModal" class="modal-mask" @click.self="emit('close-milestones')">
        <article class="modal-card">
            <h3>最大连胜里程碑</h3>
            <p v-if="milestoneList.length === 0">暂无后端返回数据。</p>
            <button class="secondary-btn" @click="emit('close-milestones')">关闭</button>
        </article>
    </div>

    <div v-if="showFailModal" class="modal-mask" @click.self="emit('close-failures')">
        <article class="modal-card">
            <h3>连胜中断题目</h3>
            <p v-if="failedQuestionList.length === 0">暂无后端返回数据。</p>
            <button class="secondary-btn" @click="emit('close-failures')">关闭</button>
        </article>
    </div>

    <div v-if="showLoginModal" class="modal-mask" @click.self="emit('close-login')">
        <article class="modal-card">
            <div class="auth-tabs">
                <button class="secondary-btn" type="button" @click="emit('set-auth-mode', 'login')">登录</button>
                <button class="secondary-btn" type="button" @click="emit('set-auth-mode', 'register')">注册</button>
            </div>

            <form v-if="authMode === 'login'" class="answer-form" @submit.prevent="emit('submit-login')">
                <input v-model="loginForm.account" class="auth-input" placeholder="账号" required type="text"/>
                <input v-model="loginForm.password" class="auth-input" placeholder="密码" required type="password"/>
                <button class="primary-btn" type="submit">登录</button>
            </form>

            <form v-else class="answer-form" @submit.prevent="emit('submit-register')">
                <input v-model="registerForm.account" class="auth-input" placeholder="账号" required type="text"/>
                <input v-model="registerForm.nickname" class="auth-input" placeholder="昵称" required type="text"/>
                <input v-model="registerForm.password" class="auth-input" placeholder="密码" required type="password"/>
                <button class="primary-btn" type="submit">注册</button>
            </form>

            <p v-if="authMessage" class="submit-message">{{ authMessage }}</p>
        </article>
    </div>
</template>
