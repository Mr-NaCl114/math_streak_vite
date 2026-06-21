<script setup>
defineProps({
    accountState: {type: Object, required: true},
    compactMode: {type: Boolean, required: true},
    showAccountMenu: {type: Boolean, required: true},
    titleBounce: {type: Boolean, required: true},
    titleBounceKey: {type: Number, required: true},
    titleEmoji: {type: String, required: true}
})

const emit = defineEmits(['toggle-auth-panel', 'logout', 'title-click', 'title-animation-end', 'toggle-global-settings', 'toggle-compact-mode'])
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

        <div class="header-right">
            <button
                :class="{ 'header-compact-btn-active': compactMode }"
                class="header-compact-btn"
                title="简洁模式"
                type="button"
                @click="emit('toggle-compact-mode')"
            >🔴</button>
            <button class="header-settings-btn" title="设置" type="button" @click="emit('toggle-global-settings')">⚙️</button>
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
        </div>
    </header>
</template>
