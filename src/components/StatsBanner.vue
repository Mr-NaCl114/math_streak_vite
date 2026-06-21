<script setup>
defineProps({
    compact: {type: Boolean, required: true},
    gameStats: {type: Object, required: true},
    isLifeLow: {type: Boolean, required: true},
    lifeProgress: {type: Number, required: true},
    lifeFlipping: {type: Boolean, required: true},
    streakFlipping: {type: Boolean, required: true},
    maxStreakFlipping: {type: Boolean, default: false},
    streakShaking: {type: Boolean, required: true},
    remainingCountShaking: {type: Boolean, default: false}
})

const emit = defineEmits([
    'life-animation-end',
    'streak-animation-end',
    'max-streak-animation-end',
    'streak-shake-end',
    'remaining-shake-end'
])
</script>

<template>
    <!-- Compact mode: life + streak inline, no background boxes -->
    <section v-if="compact" class="compact-stats-row">
        <div class="compact-stat-item">
            <span class="compact-stat-emoji">❤️</span>
            <span class="stats-value">
                <span
                    :class="{ flipping: lifeFlipping }"
                    class="flip-number"
                    @animationend="emit('life-animation-end')"
                >{{ gameStats.life }}</span>/{{ gameStats.maxLife }}
            </span>
            <div class="progress-track compact-progress">
                <div :style="{ width: `${lifeProgress}%` }" class="progress-fill"></div>
            </div>
        </div>
        <div
            :class="{ 'streak-shaking': streakShaking }"
            class="compact-stat-item"
            @animationend="emit('streak-shake-end')"
        >
            <span class="compact-stat-emoji">🔥</span>
            <span class="stats-value">
                <span
                    :class="{ flipping: streakFlipping }"
                    class="flip-number"
                    @animationend.stop="emit('streak-animation-end')"
                >{{ gameStats.totalStreak }}</span>
            </span>
        </div>
    </section>

    <!-- Normal mode: full stats banner -->
    <section v-else class="stats-banner">
        <article :class="{ 'life-low-glow': isLifeLow }" class="stats-block life-block compact-card">
            <p class="stats-label">❤️ 生命值</p>
            <div class="life-inline">
                <p class="stats-value">
                    <span
                        :class="{ flipping: lifeFlipping }"
                        class="flip-number"
                        @animationend="emit('life-animation-end')"
                    >{{ gameStats.life }}</span>/{{ gameStats.maxLife }}
                </p>
                <div class="progress-track">
                    <div :style="{ width: `${lifeProgress}%` }" class="progress-fill"></div>
                </div>
            </div>
        </article>
        <article
            :class="{ 'streak-shaking': streakShaking }"
            class="stats-block compact-card"
            @animationend="emit('streak-shake-end')"
        >
            <p class="stats-label">🔥 当前连胜</p>
            <p class="stats-value">
                <span
                    :class="{ flipping: streakFlipping }"
                    class="flip-number"
                    @animationend.stop="emit('streak-animation-end')"
                >{{ gameStats.totalStreak }}</span>
            </p>
        </article>
        <article class="stats-block compact-card">
            <p class="stats-label">🏆 最大连胜</p>
            <p class="stats-value">
                <span
                    :class="{ flipping: maxStreakFlipping }"
                    class="flip-number"
                    @animationend="emit('max-streak-animation-end')"
                >{{ gameStats.maxStreak }}</span>
            </p>
        </article>
        <article
            :class="{ 'streak-shaking': remainingCountShaking }"
            class="stats-block compact-card"
            @animationend="emit('remaining-shake-end')"
        >
            <p class="stats-label">📅 今日剩余次数</p>
            <p class="stats-value">{{ gameStats.accountTodayRemainingCount }}</p>
        </article>
    </section>
</template>
