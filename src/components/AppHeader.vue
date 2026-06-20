<script setup>
defineProps({
    accountState: {type: Object, required: true},
    showAccountMenu: {type: Boolean, required: true},
    titleBounce: {type: Boolean, required: true},
    titleBounceKey: {type: Number, required: true},
    titleEmoji: {type: String, required: true}
})

const emit = defineEmits(['toggle-auth-panel', 'logout', 'title-click', 'title-animation-end'])
</script>

<template>
    <header class="arena-header">
        <div>
            <button
                :key="titleBounceKey"
                :class="{ 'title-bounce': titleBounce }"
                class="title-btn"
                @animationend="emit('title-animation-end')"
                @click="emit('title-click')"
            >Math Streak Arena{{ titleEmoji }}
            </button>
            <p>按连胜进阶难度，实时协同同场挑战。</p>
        </div>

        <div class="account-area">
            <button v-if="false" class="secondary-btn" type="button" @click="emit('toggle-auth-panel')">
                {{ accountState.loggedIn ? (accountState.nickname || accountState.account) : '登录' }}
            </button>

            <article v-if="showAccountMenu && accountState.loggedIn" class="account-menu">
                <p><strong>当前等级：</strong>{{ accountState.accountLevel }}</p>
                <p><strong>正确率：</strong>{{ accountState.accuracy }}</p>
                <p><strong>历史题目：</strong>{{ accountState.historyQuestions.length }}</p>
                <button class="secondary-btn" type="button" @click="emit('logout')">退出登录</button>
            </article>
        </div>
    </header>
</template>
