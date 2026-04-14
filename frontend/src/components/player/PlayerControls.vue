<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { 
  audioRef, currentUrl, hasControl, canSeek, isPlaying, currentTime, 
  duration, volume, playMode 
} from '../../store/state';
import { usePlayer } from '../../composables/usePlayer';
import { watch } from 'vue';

const { t } = useI18n();
const { 
  onPlay, onPause, onSeeked, onSeeking, onTimeUpdate, 
  onRateChange, onLoadedMetadata, onEnded, togglePlayPause, 
  togglePlayMode, playNextSong, playPrevSong, seekTo, formatTime, hasPermission 
} = usePlayer() as any; // Temporary cast to avoid missing properties if not fully exported

// Export missing functions from usePlayer if needed or just define them here, 
// actually usePlayer returns these but let's make sure they exist in the composable.
// I will patch usePlayer.ts later to ensure they are returned.

const setAudioRef = (el: any) => {
  audioRef.value = el;
};

watch(volume, (val) => {
  if (audioRef.value) {
    audioRef.value.volume = val;
  }
});
</script>

<template>
  <div class="px-6 py-4 bg-[var(--color-near-black)] z-10 flex-shrink-0 flex items-center justify-between border-t border-[var(--color-dark-surface)] h-24">
    <audio 
      :ref="setAudioRef" 
      class="hidden" 
      :src="currentUrl" 
      @play="onPlay" 
      @pause="onPause" 
      @seeked="onSeeked" 
      @seeking="onSeeking" 
      @timeupdate="onTimeUpdate" 
      @ratechange="onRateChange" 
      @loadedmetadata="onLoadedMetadata" 
      @ended="onEnded">
    </audio>

    <!-- Left: Empty or Mini Info -->
    <div class="flex-1 min-w-0"></div>

    <!-- Center: Playback Controls & Progress Bar -->
    <div class="flex flex-col items-center justify-center flex-1 max-w-2xl w-full">
      <div class="flex items-center space-x-6 mb-2">
        <!-- Play Mode Toggle -->
        <button @click="togglePlayMode" :disabled="!hasControl" class="text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] disabled:opacity-50 transition-colors" :title="t(`app.player.${playMode.replace('-loop', 'Loop')}`)">
          <svg v-if="playMode === 'list-loop'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <svg v-else-if="playMode === 'single-loop'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            <text x="12" y="16" font-size="10" text-anchor="middle" fill="currentColor" stroke="none" font-weight="bold">1</text>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>

        <!-- Previous Track -->
        <button @click="playPrevSong" :disabled="!hasPermission('SKIP_SONG')" class="text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] disabled:opacity-50 transition-colors" :title="t('app.player.prev')">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
        </button>

        <!-- Play / Pause -->
        <button @click="togglePlayPause" :disabled="!hasPermission('PLAY_PAUSE')" class="w-9 h-9 flex items-center justify-center bg-[var(--color-text-white)] text-[var(--color-near-black)] rounded-full hover:scale-105 disabled:opacity-50 transition-transform" :title="isPlaying ? t('app.player.pause') : t('app.player.play')">
          <svg v-if="isPlaying" class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          <svg v-else class="w-5 h-5 fill-current ml-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>

        <!-- Next Track -->
        <button @click="playNextSong(true)" :disabled="!hasPermission('SKIP_SONG')" class="text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] disabled:opacity-50 transition-colors" :title="t('app.player.next')">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
        </button>

        <!-- Visualizer Hint -->
        <div class="hidden md:flex space-x-[2px] h-4 items-end w-8 flex-shrink-0 ml-4">
          <div v-for="i in 4" :key="i" class="w-1 bg-[var(--color-spotify-green)] transition-all duration-150 rounded-sm" :style="{height: isPlaying ? `${Math.max(20, Math.random() * 100)}%` : '20%'}"></div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="w-full flex items-center space-x-3 text-xs text-[var(--color-text-silver)] font-mono">
        <span class="w-10 text-right">{{ formatTime(currentTime) }}</span>
        <input type="range" :min="0" :max="duration || 100" :value="currentTime" @input="seekTo" :disabled="!canSeek" class="flex-grow h-1 bg-[var(--color-dark-surface)] rounded-full appearance-none cursor-pointer accent-[var(--color-text-white)] hover:accent-[var(--color-spotify-green)] custom-range">
        <span class="w-10">{{ formatTime(duration) }}</span>
      </div>
    </div>

    <!-- Right: Volume Control -->
    <div class="flex-1 flex justify-end items-center space-x-3">
      <svg class="w-4 h-4 text-[var(--color-text-silver)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5 10h4l5-5v14l-5-5H5a2 2 0 01-2-2v-4a2 2 0 012-2z" />
      </svg>
      <input type="range" min="0" max="1" step="0.01" v-model="volume" class="w-24 h-1 bg-[var(--color-dark-surface)] rounded-full appearance-none cursor-pointer accent-[var(--color-text-white)] hover:accent-[var(--color-spotify-green)] custom-range" :title="t('app.player.volume')">
    </div>
  </div>
</template>