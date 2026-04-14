<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ref, watch, onUnmounted } from 'vue';
import { activeVote, getSyncedTime } from '../../store/state';
import { useRoom } from '../../composables/useRoom';

const { t } = useI18n();
const { voteYes, voteNo } = useRoom();

const timeLeft = ref(0);
let timer: any = null;

watch(() => activeVote.value, (newVote) => {
  if (timer) clearInterval(timer);
  if (newVote && newVote.expiresAt && !newVote.result) {
    const updateTime = () => {
      const remaining = Math.max(0, Math.ceil((newVote.expiresAt - getSyncedTime()) / 1000));
      timeLeft.value = remaining;
    };
    updateTime();
    timer = setInterval(updateTime, 1000);
  }
}, { immediate: true });

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <transition name="fade">
    <div v-if="activeVote" class="fixed top-24 left-1/2 transform -translate-x-1/2 bg-[var(--color-dark-surface)] border border-[var(--color-border-gray)] rounded-[8px] p-4 shadow-[var(--shadow-spotify-heavy)] z-[100] flex flex-col items-center space-y-3 min-w-[300px]">
      <div class="text-sm font-bold text-[var(--color-text-white)]">
        {{ activeVote.initiatorName }}{{ t('app.initiatedVote') }}
        <span v-if="activeVote.expiresAt && !activeVote.result" class="text-xs font-mono text-[var(--color-spotify-green)] ml-2">({{ timeLeft }}s)</span>
      </div>
      <div class="text-xs text-[var(--color-text-silver)] font-semibold">
        {{ activeVote.type === 'SKIP_SONG' ? t('app.voteTypeSkip') : (activeVote.type === 'CHANGE_HOST' ? `${t('app.voteTypeChangeHost')}${activeVote.targetName}` : `${t('app.voteTypeKick')}${activeVote.targetName}`) }}
      </div>
      
      <template v-if="!activeVote.result">
        <div class="w-full bg-[var(--color-near-black)] h-2 rounded-full overflow-hidden flex">
          <div class="h-full bg-[var(--color-spotify-green)] transition-all" :style="{ width: `${(activeVote.yesCount / activeVote.required) * 100}%` }"></div>
        </div>
        <div class="flex items-center justify-between w-full text-xs font-mono text-[var(--color-text-silver)]">
          <span>{{ t('app.agreedCount') }}{{ activeVote.yesCount }} / {{ activeVote.required }}</span>
          <span>{{ t('app.rejectedCount') }}{{ activeVote.noCount }}</span>
        </div>
        <div v-if="!activeVote.hasVoted" class="flex space-x-2 w-full">
          <button @click="voteYes" class="flex-1 bg-[var(--color-spotify-green)] text-[var(--color-near-black)] py-1.5 rounded-[500px] font-bold text-xs hover:scale-105 transition-transform uppercase">
            {{ t('app.agree') }}
          </button>
          <button @click="voteNo" class="flex-1 bg-red-500 text-white py-1.5 rounded-[500px] font-bold text-xs hover:scale-105 transition-transform uppercase">
            {{ t('app.reject') }}
          </button>
        </div>
        <div v-else class="w-full text-center text-xs text-[var(--color-text-silver)] py-1.5 font-bold uppercase">
          {{ t('app.voted') }}
        </div>
      </template>

      <template v-else>
        <div class="w-full text-center text-sm font-bold py-2 uppercase" :class="activeVote.result === 'passed' ? 'text-[var(--color-spotify-green)]' : 'text-red-500'">
          {{ activeVote.result === 'passed' ? t('app.votePassed') : t('app.voteFailed') }}
        </div>
      </template>

      <button v-if="!activeVote.result" @click="activeVote = null" class="w-full bg-[var(--color-mid-dark)] text-[var(--color-text-white)] py-1.5 rounded-[500px] font-bold text-xs hover:scale-105 transition-transform uppercase mt-2">
        {{ t('app.close') }}
      </button>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>