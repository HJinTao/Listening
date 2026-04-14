<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { 
  isJoined, isStandalone, isHost, roomMode, 
  roomId, username, isPlaying 
} from '../../store/state';
import { useAuth } from '../../composables/useAuth';
import { useRoom } from '../../composables/useRoom';

const { t, locale } = useI18n();
const { handleLogout } = useAuth();
const { changeRoomMode } = useRoom();

const isMobileModeMenuOpen = ref(false);

const handleClickOutside = () => {
  if (isMobileModeMenuOpen.value) {
    isMobileModeMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

const toggleLanguage = () => {
  locale.value = locale.value === 'en' ? 'zh' : 'en';
  localStorage.setItem('locale', locale.value);
};
</script>

<template>
  <header class="h-16 flex items-center justify-between px-6 bg-[var(--color-near-black)] z-50 flex-shrink-0">
    <div class="flex items-center space-x-3">
      <div class="w-8 h-8 bg-[var(--color-spotify-green)] rounded-full flex items-center justify-center">
        <svg class="w-4 h-4 text-[var(--color-near-black)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      </div>
      <h1 class="font-spotify-title font-bold text-2xl tracking-tight">{{ t('app.title') }}</h1>
    </div>
    
    <div class="flex items-center space-x-6">
      <div v-if="isJoined" class="flex items-center space-x-4">
        <div class="hidden md:flex items-center space-x-2 bg-[var(--color-mid-dark)] px-4 py-1.5 rounded-[500px]">
          <span class="w-2 h-2 rounded-full bg-[var(--color-spotify-green)]" :class="{'animate-pulse': isPlaying}"></span>
          <span class="text-xs text-[var(--color-text-silver)] font-semibold">{{ t('app.freq') }}: {{ roomId }}</span>
        </div>
        <div class="hidden md:block text-xs text-[var(--color-text-white)] px-4 py-1.5 bg-[var(--color-mid-dark)] rounded-[500px] font-semibold">
          {{ t('app.op') }}: {{ username }}
        </div>
        <!-- Mode Tag -->
        <div class="relative group cursor-pointer" @click.stop="isMobileModeMenuOpen = !isMobileModeMenuOpen">
          <div class="text-xs px-4 py-1.5 rounded-[500px] font-semibold flex items-center space-x-1 transition-colors" :class="roomMode === 'dictator' ? 'bg-red-900/50 text-red-200 border border-red-800' : 'bg-blue-900/50 text-blue-200 border border-blue-800'">
            <span>{{ roomMode === 'dictator' ? t('app.dictatorMode') : t('app.democracyMode') }}</span>
            <svg class="w-3 h-3 ml-1 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <!-- Permissions Card (Hover for Desktop, Click for Mobile) -->
          <div :class="{'opacity-100 visible': isMobileModeMenuOpen, 'opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible': !isMobileModeMenuOpen}" class="absolute top-full right-0 pt-2 w-64 transition-all z-50">
            <div class="p-4 bg-[var(--color-dark-surface)] border border-[var(--color-border-gray)] rounded-[8px] shadow-[var(--shadow-spotify-heavy)] pointer-events-auto">
                <div class="text-sm font-bold text-[var(--color-text-white)] mb-2">{{ roomMode === 'dictator' ? t('app.dictatorMode') : t('app.democracyMode') }}</div>
                <ul class="text-xs text-[var(--color-text-silver)] space-y-1">
                  <li v-if="roomMode === 'dictator'">{{ t('app.ruleAllCanAdd') }}</li>
                  <li v-if="roomMode === 'dictator'">{{ t('app.ruleDictatorControl') }}</li>
                  <li v-if="roomMode === 'democracy'">{{ t('app.ruleAllCanAdd') }}</li>
                  <li v-if="roomMode === 'democracy'">{{ t('app.ruleDemocracyControl') }}</li>
                  <li v-if="roomMode === 'democracy'">{{ t('app.ruleDemocracyVote') }}</li>
                </ul>
                <div v-if="isHost" class="mt-3 pt-3 border-t border-[var(--color-border-gray)]">
                    <button @click="changeRoomMode(roomMode === 'dictator' ? 'democracy' : 'dictator')" class="w-full py-1.5 bg-[var(--color-mid-dark)] hover:bg-[var(--color-text-white)] hover:text-[var(--color-near-black)] text-[var(--color-text-white)] text-xs font-bold rounded-[500px] transition-colors">
                      {{ t('app.switchModeTo') }}{{ roomMode === 'dictator' ? t('app.democracyMode') : t('app.dictatorMode') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
      <div v-else-if="isStandalone" class="flex items-center space-x-4">
        <div class="flex items-center space-x-2 bg-[var(--color-mid-dark)] px-4 py-1.5 rounded-[500px]">
          <span class="w-2 h-2 rounded-full bg-[var(--color-spotify-green)]" :class="{'animate-pulse': isPlaying}"></span>
          <span class="text-xs text-[var(--color-text-silver)] font-semibold">{{ t('app.standalone') }}</span>
        </div>
        <button @click="handleLogout" class="text-xs text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] transition-colors">{{ t('app.logout') }}</button>
      </div>
      <button @click="toggleLanguage" class="text-sm font-semibold text-[var(--color-text-white)] hover:text-[var(--color-spotify-green)] transition-colors px-4 py-2 bg-[var(--color-mid-dark)] rounded-[500px]">
        {{ locale === 'en' ? '中' : 'EN' }}
      </button>
    </div>
  </header>
</template>