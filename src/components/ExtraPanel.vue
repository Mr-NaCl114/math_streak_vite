<script setup>
const emit = defineEmits(['show-milestones', 'show-failures'])
</script>

<template>
    <section class="panel extra-panel">
        <h2>数据展示</h2>
        <div class="extra-actions">
            <button class="secondary-btn" type="button" @click="emit('show-milestones')">查看里程碑</button>
            <button class="secondary-btn" type="button" @click="emit('show-failures')">查看连胜中断题目</button>
        </div>
        <div class="heatmap-placeholder">
            <h3>失败账号等级热力图</h3>
            <p>failedAccountLevelHeatmap</p>
        </div>
    </section>
</template>
