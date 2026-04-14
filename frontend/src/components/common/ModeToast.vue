<script setup lang="ts">
import { modeToast, roomMode } from '../../store/state';
</script>

<template>
  <transition name="fade">
    <div v-if="modeToast" class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[var(--color-dark-surface)]/90 backdrop-blur-md border border-[var(--color-border-gray)] rounded-[16px] p-8 shadow-[var(--shadow-spotify-heavy)] z-[100] flex flex-col items-center space-y-4 pointer-events-none">
      <div class="w-16 h-16 rounded-full bg-[var(--color-mid-dark)] flex items-center justify-center">
        <svg v-if="roomMode === 'dictator'" class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z"/></svg>
        <svg v-else class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
      </div>
      <div class="text-xl font-bold text-[var(--color-text-white)] tracking-wide">
        {{ modeToast }}
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>