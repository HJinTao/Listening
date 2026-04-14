<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { 
  isStandalone, users, isHost, socket, roomMode, chatMessages, chatInput 
} from '../../store/state';
import { useRoom } from '../../composables/useRoom';

const { t } = useI18n();
const { passHost, grantControl, revokeControl, initiateVote, kickUser, sendChat } = useRoom();
</script>

<template>
  <aside v-if="!isStandalone" class="w-[300px] flex-shrink-0 flex flex-col bg-[var(--color-near-black)] rounded-[8px] z-20 hidden lg:flex overflow-hidden">
    <!-- Active Nodes -->
    <div class="h-1/3 flex flex-col bg-[var(--color-dark-surface)] mb-2 rounded-[8px]">
      <div class="p-4">
        <span class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.activeNodes') }} ({{ users.length }})</span>
      </div>
      <div class="flex-grow overflow-y-auto p-4 pt-0 space-y-3 custom-scrollbar">
        <div v-for="u in users" :key="u.id" class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-2 h-2 rounded-full" :class="u.isHost ? 'bg-[var(--color-spotify-green)]' : 'bg-[var(--color-text-silver)]'"></div>
            <span class="text-sm font-semibold text-[var(--color-text-white)] truncate">{{ u.username }}</span>
          </div>
          <div class="flex items-center space-x-2">
            <span v-if="u.id === socket?.id" class="text-xs text-[var(--color-near-black)] font-bold px-2 py-0.5 rounded-[500px] bg-[var(--color-text-white)]">{{ t('app.me') }}</span>
            <template v-if="isHost && u.id !== socket?.id">
              <button @click="passHost(u.id)" class="text-xs bg-[var(--color-spotify-green)] text-[var(--color-near-black)] px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.transferHostTitle')">H</button>
              <button v-if="!u.canControl" @click="grantControl(u.id)" class="text-xs bg-[var(--color-text-silver)] text-[var(--color-near-black)] px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.grantControlTitle')">C</button>
              <button v-else @click="revokeControl(u.id)" class="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.revokeControlTitle')">-C</button>
              <button @click="kickUser(u.id)" class="text-xs bg-red-500 text-white px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.kickUserTitle')">K</button>
            </template>
            <template v-else-if="roomMode === 'democracy'">
              <template v-if="u.id !== socket?.id">
                <button v-if="!u.isHost" @click="initiateVote('CHANGE_HOST', u.id)" class="text-xs bg-[var(--color-spotify-green)] text-[var(--color-near-black)] px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.voteHostTitle')">V:H</button>
                <button @click="initiateVote('KICK_USER', u.id)" class="text-xs bg-red-500 text-white px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform" :title="t('app.voteKickTitle')">V:K</button>
              </template>
              <template v-else>
                <button v-if="!u.isHost" @click="initiateVote('CHANGE_HOST', u.id)" class="text-xs bg-[var(--color-spotify-green)] text-[var(--color-near-black)] px-2 py-0.5 rounded-[500px] font-bold hover:scale-105 transition-transform ml-2" :title="t('app.voteHostTitle')">V:H</button>
              </template>
            </template>
            <span v-if="u.canControl && u.id !== socket?.id && !isHost" class="text-xs text-[var(--color-text-silver)] font-bold px-2 py-0.5 border border-[var(--color-text-silver)] rounded-[500px]">C</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Chat / Log -->
    <div class="flex-grow flex flex-col min-h-0 bg-[var(--color-dark-surface)] rounded-[8px]">
      <div class="p-4 flex-shrink-0">
        <span class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.commsLog') }}</span>
      </div>
      <div id="chat-scroll" class="flex-grow overflow-y-auto px-4 space-y-4 custom-scrollbar">
        <div v-for="(msg, i) in chatMessages" :key="i">
          <div v-if="msg.isSystem" class="text-xs text-[var(--color-text-silver)] font-semibold text-center py-2">
            {{ msg.message }}
          </div>
          <div v-else class="space-y-1">
            <div class="text-xs font-semibold text-[var(--color-text-silver)]">{{ msg.sender }}</div>
            <div class="text-sm font-semibold text-[var(--color-text-white)] break-words">
              {{ msg.message }}
            </div>
          </div>
        </div>
      </div>
      <div class="p-4 flex-shrink-0">
        <div class="relative flex items-center">
          <input v-model="chatInput" @keyup.enter="sendChat" type="text" class="w-full bg-[var(--color-mid-dark)] p-3 pr-16 text-sm focus:outline-none text-[var(--color-text-white)] placeholder-[var(--color-text-silver)] rounded-[500px] shadow-[var(--shadow-spotify-inset)]" :placeholder="t('app.inputMessage')">
          <button @click="sendChat" class="absolute right-2 top-1.5 bottom-1.5 px-4 bg-[var(--color-text-white)] hover:bg-[var(--color-spotify-green)] hover:scale-105 text-[var(--color-near-black)] transition-all font-bold text-xs uppercase tracking-[1.4px] rounded-[500px] flex items-center justify-center">
            {{ t('app.send') }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>