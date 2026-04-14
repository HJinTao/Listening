<script setup lang="ts">
import { 
  activeTab, isStandalone, isMobilePlayerOpen, isMobileDrawerOpen, currentUrl, currentSong, isPlaying
} from '../../store/state';
import { usePlayer } from '../../composables/usePlayer';
import { useI18n } from 'vue-i18n';
import LeftSidebar from '../sidebar/LeftSidebar.vue';
import RightSidebar from '../sidebar/RightSidebar.vue';
import PlayerStage from '../player/PlayerStage.vue';
import PlayerControls from '../player/PlayerControls.vue';
import { ref } from 'vue';

const { t } = useI18n();
const { togglePlayPause } = usePlayer();
const playerControlsRef = ref<any>(null);

const handlePlayPause = () => {
  if (playerControlsRef.value) {
    playerControlsRef.value.togglePlayPause();
  } else {
    togglePlayPause();
  }
};

const switchTab = (tab: string) => {
  activeTab.value = tab;
  isMobilePlayerOpen.value = false;
};
</script>

<template>
  <main class="flex-grow flex flex-col overflow-hidden bg-[var(--color-near-black)] p-2 gap-2 relative">
    
    <!-- Active Tab View (Lists) -->
    <LeftSidebar class="flex flex-grow" v-show="!isMobilePlayerOpen" />
    
    <!-- Player View -->
    <div v-show="isMobilePlayerOpen" class="flex-grow flex flex-col bg-[var(--color-near-black)] rounded-[8px] overflow-hidden shadow-[var(--shadow-spotify-heavy)] z-20 relative">
      <!-- Mobile Header for Player -->
      <div class="flex items-center justify-between p-4 bg-[var(--color-dark-surface)] flex-shrink-0 z-20">
        <button @click="isMobilePlayerOpen = false" class="p-2 text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <span class="text-xs font-bold tracking-widest text-[var(--color-text-white)] uppercase">{{ t('app.nowPlaying') }}</span>
        <div class="w-10"></div> <!-- Spacer -->
      </div>
      <PlayerStage class="bg-[var(--color-near-black)]" />
      <PlayerControls ref="playerControlsRef" />
    </div>

    <!-- Mobile Right Drawer Overlay (Chat/Users) -->
    <div v-if="isMobileDrawerOpen && !isStandalone" class="fixed inset-0 bg-black/60 z-40" @click="isMobileDrawerOpen = false"></div>
    <transition name="slide-right">
      <RightSidebar v-if="isMobileDrawerOpen && !isStandalone" class="fixed right-0 top-0 bottom-0 w-[300px] z-50 flex !h-full" />
    </transition>
    
    <!-- Floating Mini Player -->
    <div v-show="!isMobilePlayerOpen && currentUrl" class="absolute bottom-[72px] left-2 right-2 bg-[var(--color-mid-dark)] rounded-[6px] p-2 flex items-center shadow-lg border border-[var(--color-border-gray)] z-30" @click="isMobilePlayerOpen = true">
      <div class="w-10 h-10 bg-[var(--color-dark-surface)] rounded flex items-center justify-center mr-3 flex-shrink-0">
         <span class="w-2 h-2 rounded-full bg-[var(--color-spotify-green)]" :class="{'animate-pulse': isPlaying}"></span>
      </div>
      <div class="flex-grow min-w-0 mr-2">
        <div class="text-sm font-bold text-white truncate">{{ currentSong?.name || t('app.nowPlaying') }}</div>
        <div class="text-xs text-[var(--color-text-silver)] truncate">{{ currentSong?.singer || '' }}</div>
      </div>
      <div class="flex items-center space-x-2" @click.stop>
        <button @click="handlePlayPause" class="p-2 text-white">
          <svg v-if="isPlaying" class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          <svg v-else class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
    </div>

    <!-- Bottom Navigation Bar -->
    <div class="flex h-14 bg-[var(--color-dark-surface)] rounded-[8px] flex-shrink-0 items-center justify-around px-2 z-30 shadow-[var(--shadow-spotify-heavy)] border-t border-[var(--color-border-gray)] relative">
       <button v-if="!isStandalone" @click="switchTab('room')" :class="activeTab === 'room' && !isMobilePlayerOpen ? 'text-white' : 'text-[var(--color-text-silver)]'" class="flex flex-col items-center justify-center w-16 transition-colors">
         <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
         <span class="text-[10px] font-semibold">{{ t('app.roomPlaylist') }}</span>
       </button>
       <button @click="switchTab('search')" :class="activeTab === 'search' && !isMobilePlayerOpen ? 'text-white' : 'text-[var(--color-text-silver)]'" class="flex flex-col items-center justify-center w-16 transition-colors">
         <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
         <span class="text-[10px] font-semibold">{{ t('app.search') }}</span>
       </button>
       <button @click="switchTab('playlist')" :class="activeTab === 'playlist' && !isMobilePlayerOpen ? 'text-white' : 'text-[var(--color-text-silver)]'" class="flex flex-col items-center justify-center w-16 transition-colors">
         <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
         <span class="text-[10px] font-semibold">{{ t('app.playlist') }}</span>
       </button>
       <button v-if="!isStandalone" @click="isMobileDrawerOpen = true" :class="isMobileDrawerOpen ? 'text-white' : 'text-[var(--color-text-silver)]'" class="flex flex-col items-center justify-center w-16 transition-colors relative">
         <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
         <span class="text-[10px] font-semibold">{{ t('app.chat') }}</span>
       </button>
    </div>
  </main>
</template>

<style scoped>
.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.3s ease; }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); }
</style>
