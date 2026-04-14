<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { 
  backendUrl, lxEngine, scriptLoaded, isLoggedIn, 
  isJoined, isHost, currentUrl, socket, audioRef, isStandalone 
} from './store/state';
import { LxEngine } from './utils/lx-engine';
import { usePlaylist } from './composables/usePlaylist';
import { usePlayer } from './composables/usePlayer';

import AppHeader from './components/layout/AppHeader.vue';
import AuthPanel from './components/auth/AuthPanel.vue';
import VoteToast from './components/common/VoteToast.vue';
import ModeToast from './components/common/ModeToast.vue';
import LeftSidebar from './components/sidebar/LeftSidebar.vue';
import RightSidebar from './components/sidebar/RightSidebar.vue';
import PlayerStage from './components/player/PlayerStage.vue';
import PlayerControls from './components/player/PlayerControls.vue';

const { fetchPlaylist } = usePlaylist();
const { sendSyncCommand, ensurePlaybackRate, getTrackId } = usePlayer();

let hostHeartbeatTimer: number | null = null;

onMounted(async () => {
  try {
    const resp = await axios.get(`${backendUrl}/api/script`);
    lxEngine.value = new LxEngine(backendUrl);
    const success = lxEngine.value.loadScript(resp.data);
    if (success) {
      scriptLoaded.value = true;
    }
  } catch (error) {
    console.error('Failed to auto-load script:', error);
  }
});

onUnmounted(() => { 
  if (socket.value) socket.value.disconnect(); 
});

watch(
  () => [isHost.value, isJoined.value],
  ([nextIsHost, nextIsJoined]) => {
    if (hostHeartbeatTimer) {
      clearInterval(hostHeartbeatTimer);
      hostHeartbeatTimer = null;
    }
    if (!nextIsJoined || !nextIsHost) return;

    ensurePlaybackRate(1);
    hostHeartbeatTimer = window.setInterval(() => {
      if (!isHost.value || !socket.value || !audioRef.value) return;
      if (!currentUrl.value) return;
      const audio = audioRef.value;
      sendSyncCommand('SYNC', { position: audio.currentTime, isPlaying: !audio.paused, trackId: getTrackId() });
    }, 1000);
  },
  { immediate: true }
);

watch(isLoggedIn, (val) => {
  if (val) {
    fetchPlaylist();
  }
}, { immediate: true });
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-[var(--color-near-black)] text-[var(--color-text-white)] font-spotify overflow-hidden selection:bg-[var(--color-spotify-green)] selection:text-[var(--color-near-black)]">
    
    <AppHeader />
    <VoteToast />
    <ModeToast />

    <transition name="fade">
      <AuthPanel />
    </transition>

    <transition name="fade">
      <main v-if="isJoined || isStandalone" class="flex-grow flex overflow-hidden bg-[var(--color-near-black)] p-2 gap-2">
        <LeftSidebar />
        
        <div class="flex-grow flex flex-col relative bg-[var(--color-near-black)] rounded-[8px] overflow-hidden shadow-[var(--shadow-spotify-heavy)]">
          <PlayerStage />
          <PlayerControls />
        </div>

        <RightSidebar />
      </main>
    </transition>
  </div>
</template>

<style>
/* Global styles for fade transitions, these were scoped before but better un-scoped or kept here */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>