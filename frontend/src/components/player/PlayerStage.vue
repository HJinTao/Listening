<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { 
  currentSong, isPlaying, isHost, hasControl, 
  songQuality, lyrics, currentLyricIndex 
} from '../../store/state';
import { ref, watch } from 'vue';

const { t } = useI18n();
const lyricScrollRef = ref<HTMLElement | null>(null);

// Auto scroll lyrics is handled here now via watch
watch(currentLyricIndex, (newIndex) => {
  if (lyricScrollRef.value && newIndex !== -1) {
    const activeEl = lyricScrollRef.value.children[newIndex] as HTMLElement;
    if (activeEl) {
      lyricScrollRef.value.scrollTo({
        top: activeEl.offsetTop - lyricScrollRef.value.offsetHeight / 2 + activeEl.offsetHeight / 2,
        behavior: 'smooth'
      });
    }
  }
});
</script>

<template>
  <section class="flex-grow flex flex-col relative bg-[var(--color-near-black)] rounded-[8px] overflow-hidden shadow-[var(--shadow-spotify-heavy)]">
    <!-- Top: Track Info -->
    <div class="px-8 pt-8 pb-6 flex-shrink-0 z-10 bg-gradient-to-b from-[var(--color-dark-surface)] to-[var(--color-near-black)]">
      <div class="flex flex-col justify-between gap-4 h-full">
        <div class="max-w-full">
          <div class="text-sm font-bold text-[var(--color-text-white)] uppercase tracking-[1.4px] mb-4 flex items-center">
            <span class="w-2 h-2 bg-[var(--color-spotify-green)] rounded-full mr-3" :class="{'animate-pulse': isPlaying}"></span>
            {{ t('app.nowPlaying') }}
          </div>
          <h2 class="font-spotify-title text-5xl md:text-7xl font-bold tracking-tighter text-[var(--color-text-white)] mb-4 truncate leading-none">{{ currentSong?.name || t('app.idle') }}</h2>
          <p class="text-lg md:text-2xl font-bold text-[var(--color-text-silver)]">{{ currentSong?.singer || t('app.waitingTrack') }}</p>
        </div>
        <div class="text-sm text-[var(--color-text-silver)] font-semibold flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <span>{{ t('app.mode') }}: {{ isHost ? t('app.master') : (hasControl ? 'Controller' : t('app.slave')) }}</span>
          </div>
          <select v-model="songQuality" class="bg-transparent text-[var(--color-text-white)] font-semibold focus:outline-none cursor-pointer border-b border-[var(--color-border-gray)]">
            <option class="bg-[var(--color-dark-surface)]" value="128k">{{ t('app.quality.std') }}</option>
            <option class="bg-[var(--color-dark-surface)]" value="320k">{{ t('app.quality.hq') }}</option>
            <option class="bg-[var(--color-dark-surface)]" value="flac">{{ t('app.quality.lossless') }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Middle: Lyrics -->
    <div class="flex-grow relative z-10 overflow-hidden mb-6">
      <div ref="lyricScrollRef" class="absolute inset-0 overflow-y-auto scroll-smooth custom-scrollbar px-8 md:px-12 py-[20%] lyric-mask">
        <div v-for="(line, index) in lyrics" :key="index" 
             :class="['lyric-line text-left py-2 md:py-3 text-2xl md:text-4xl font-bold tracking-tight', { 'active': index === currentLyricIndex }]" 
             :id="`lyric-${index}`">
          {{ line.text }}
        </div>
        <div v-if="lyrics.length === 0" class="text-left py-10 text-2xl font-bold text-[var(--color-text-silver)] opacity-50">
          {{ t('app.noLyric') }}
        </div>
      </div>
    </div>
  </section>
</template>