<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { 
  username, password, roomId, isLoginMode, 
  rememberPassword, isLoggedIn, isJoined, isStandalone 
} from '../../store/state';
import { useAuth } from '../../composables/useAuth';
import { useSocket } from '../../composables/useSocket';
import { useRoom } from '../../composables/useRoom';

const { t } = useI18n();
const { handleAuth, handleLogout } = useAuth();
const { connectSocket } = useSocket();
const { startStandaloneMode } = useRoom();
</script>

<template>
  <main v-if="!isJoined && !isStandalone" class="flex-grow flex items-center justify-center relative bg-[var(--color-near-black)]">
    <div class="w-full max-w-[450px] p-12 bg-[var(--color-dark-surface)] rounded-[8px] relative z-10 shadow-[var(--shadow-spotify-heavy)]">
      <div v-if="!isLoggedIn">
        <h2 class="font-spotify-title text-3xl font-bold mb-2 tracking-tight text-[var(--color-text-white)] text-center">{{ isLoginMode ? t('app.login') : t('app.register') }}</h2>
        <p class="text-[var(--color-text-silver)] text-sm mb-8 text-center font-semibold">{{ t('app.authRequired') }}</p>
        
        <div class="space-y-5">
          <div class="space-y-2">
            <label class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.username') }}</label>
            <input v-model="username" @keyup.enter="handleAuth" type="text" class="w-full bg-[var(--color-mid-dark)] p-3.5 text-base focus:outline-none transition-colors text-[var(--color-text-white)] rounded-[500px] shadow-[var(--shadow-spotify-inset)]" :placeholder="t('app.username')">
          </div>
          <div class="space-y-2">
            <label class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.password') }}</label>
            <input v-model="password" @keyup.enter="handleAuth" type="password" class="w-full bg-[var(--color-mid-dark)] p-3.5 text-base focus:outline-none transition-colors text-[var(--color-text-white)] rounded-[500px] shadow-[var(--shadow-spotify-inset)]" :placeholder="t('app.password')">
          </div>
          <div v-if="isLoginMode" class="flex items-center space-x-3 mt-2">
            <input type="checkbox" v-model="rememberPassword" id="rememberMe" class="accent-[var(--color-spotify-green)] w-4 h-4 cursor-pointer">
            <label for="rememberMe" class="text-sm text-[var(--color-text-silver)] cursor-pointer select-none">{{ t('app.rememberMe') }}</label>
          </div>
          <button @click="handleAuth" class="w-full bg-[var(--color-spotify-green)] text-[var(--color-near-black)] p-3.5 rounded-[500px] font-bold text-base hover:scale-105 transition-transform mt-8 flex items-center justify-center space-x-2 tracking-[1.4px] uppercase">
            <span>{{ isLoginMode ? t('app.login') : t('app.register') }}</span>
          </button>
          <div class="text-center mt-6">
            <button @click="isLoginMode = !isLoginMode" class="text-sm font-semibold text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] transition-colors">
              {{ isLoginMode ? t('app.needAccount') : t('app.haveAccount') }}
            </button>
          </div>
        </div>
      </div>
      
      <div v-else>
        <h2 class="font-spotify-title text-3xl font-bold mb-2 tracking-tight text-[var(--color-text-white)] text-center">{{ t('app.joinRoom') }}</h2>
        <p class="text-[var(--color-text-silver)] text-sm mb-8 text-center font-semibold">{{ t('app.welcome', { username }) }}</p>
        
        <div class="space-y-5">
          <div class="space-y-2">
            <label class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.channelId') }}</label>
            <input v-model.number="roomId" @keyup.enter="connectSocket" type="number" min="1" class="w-full bg-[var(--color-mid-dark)] p-3.5 text-base focus:outline-none transition-colors text-[var(--color-text-white)] rounded-[500px] shadow-[var(--shadow-spotify-inset)]" placeholder="e.g. 8888">
          </div>
          <div class="grid grid-cols-2 gap-3 mt-8">
            <button @click="connectSocket" class="w-full bg-[var(--color-spotify-green)] text-[var(--color-near-black)] p-3.5 rounded-[500px] font-bold text-sm hover:scale-105 transition-transform flex items-center justify-center space-x-2 tracking-[1px] uppercase">
              <span>{{ t('app.connect') }}</span>
            </button>
            <button @click="startStandaloneMode" class="w-full bg-[var(--color-mid-dark)] text-[var(--color-text-white)] p-3.5 rounded-[500px] font-bold text-sm hover:bg-[var(--color-text-silver)] hover:text-[var(--color-near-black)] transition-colors flex items-center justify-center space-x-2 tracking-[1px]">
              <span>{{ t('app.standalone') }}</span>
            </button>
          </div>
          <div class="text-center mt-6">
            <button @click="handleLogout" class="text-sm font-semibold text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] transition-colors">
              {{ t('app.logout') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>