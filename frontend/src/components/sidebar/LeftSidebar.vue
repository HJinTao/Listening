<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { 
  activeTab, isStandalone, searchSource, searchKeyword, searchResults, 
  isSearching, searchPage, hasControl, playlist, roomPlaylist, 
  isPlaying
} from '../../store/state';
import { useSearch } from '../../composables/useSearch';
import { usePlaylist } from '../../composables/usePlaylist';
import { usePlayer } from '../../composables/usePlayer';

const { t } = useI18n();
const { searchMusic, handleSearchScroll } = useSearch();
const { togglePlaylist, isInPlaylist, addToRoomPlaylist, removeSong } = usePlaylist();
const { playSong, getTrackId } = usePlayer();
</script>

<template>
  <aside class="w-full md:w-[350px] shrink md:shrink-0 min-h-0 flex flex-col bg-[var(--color-near-black)] rounded-[8px] z-20 relative overflow-hidden">
    
    <!-- Tabs -->
    <div class="hidden md:flex space-x-2 p-4 bg-[var(--color-near-black)]">
      <button v-if="!isStandalone" @click="activeTab = 'room'" :class="activeTab === 'room' ? 'bg-[var(--color-dark-surface)] text-[var(--color-text-white)]' : 'bg-transparent text-[var(--color-text-silver)] hover:text-[var(--color-text-white)]'" class="px-4 py-1.5 rounded-[9999px] text-sm font-semibold transition-colors">
        {{ t('app.roomPlaylist') }}
      </button>
      <button @click="activeTab = 'search'" :class="activeTab === 'search' ? 'bg-[var(--color-dark-surface)] text-[var(--color-text-white)]' : 'bg-transparent text-[var(--color-text-silver)] hover:text-[var(--color-text-white)]'" class="px-4 py-1.5 rounded-[9999px] text-sm font-semibold transition-colors">
        {{ t('app.search') }}
      </button>
      <button @click="activeTab = 'playlist'" :class="activeTab === 'playlist' ? 'bg-[var(--color-dark-surface)] text-[var(--color-text-white)]' : 'bg-transparent text-[var(--color-text-silver)] hover:text-[var(--color-text-white)]'" class="px-4 py-1.5 rounded-[9999px] text-sm font-semibold transition-colors">
        {{ t('app.playlist') }}
      </button>
    </div>

    <div class="flex-grow flex flex-col bg-[var(--color-near-black)] rounded-[8px] overflow-hidden mx-2 mb-2 min-h-0">
      <div v-if="activeTab === 'search'" class="p-4 flex flex-col space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-[var(--color-text-white)]">{{ t('app.audioDb') }}</span>
          <div class="flex space-x-1">
            <button v-for="s in [{id:'kw',n:'KW'}, {id:'kg',n:'KG'}, {id:'tx',n:'TX'}, {id:'wy',n:'WY'}]" :key="s.id" @click="searchSource = s.id" 
                    :class="{'bg-[var(--color-dark-surface)] text-[var(--color-text-white)]': searchSource === s.id, 'text-[var(--color-text-silver)] hover:text-[var(--color-text-white)]': searchSource !== s.id}" 
                    class="px-3 py-1 text-xs font-semibold rounded-[9999px] transition-colors">
              {{ s.n }}
            </button>
          </div>
        </div>
        <div class="relative">
          <input v-model="searchKeyword" @keyup.enter="searchMusic" type="text" class="w-full bg-[var(--color-dark-surface)] p-3 pl-10 text-sm focus:outline-none transition-colors text-[var(--color-text-white)] rounded-[500px] hover:bg-[var(--color-mid-dark)] focus:bg-[var(--color-mid-dark)] shadow-[var(--shadow-spotify-inset)]" :placeholder="t('app.query')">
          <svg class="absolute left-3 top-3 w-5 h-5 text-[var(--color-text-silver)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>
      
      <div class="flex-grow overflow-y-auto px-4 pb-4 space-y-1 custom-scrollbar" @scroll="handleSearchScroll">
        <div v-if="!hasControl" class="mb-4 text-[var(--color-text-silver)] text-sm font-semibold text-center flex items-center justify-center space-x-2">
          <span>{{ t('app.onlyHostCanControlPlayback') }}</span>
        </div>

        <template v-if="activeTab === 'search'">
          <div v-if="isSearching && searchPage === 1" class="flex items-center justify-center py-10">
            <div class="w-8 h-8 border-4 border-[var(--color-spotify-green)] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div v-else-if="searchResults.length === 0" class="text-center py-10 text-sm text-[var(--color-text-silver)] font-semibold">
            {{ t('app.noResults') }}
          </div>
          <div v-for="song in searchResults" :key="song.songmid" class="group flex items-center justify-between p-2 rounded-[6px] transition-all hover:bg-[var(--color-dark-surface)] cursor-pointer" @click="isStandalone ? playSong(song, 'search') : addToRoomPlaylist(song)">
            <div class="flex items-center space-x-3 min-w-0">
              <div class="w-10 h-10 bg-[var(--color-dark-surface)] rounded-[4px] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--color-mid-dark)] transition-colors">
                <svg class="w-5 h-5 text-[var(--color-text-silver)] group-hover:text-[var(--color-text-white)] transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <div class="min-w-0">
                <div class="text-base font-semibold truncate text-[var(--color-text-white)]">{{ song.name }}</div>
                <div class="text-sm text-[var(--color-text-silver)] truncate">{{ song.singer }}</div>
              </div>
            </div>
            <button @click.stop="togglePlaylist(song)" class="text-[var(--color-text-silver)] hover:text-[var(--color-text-white)] p-2 transition-colors focus:outline-none z-10 relative">
              <svg v-if="isInPlaylist(song)" class="w-5 h-5 text-[var(--color-spotify-green)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
          </div>
          <div v-if="isSearching && searchPage > 1" class="flex items-center justify-center py-4">
            <div class="w-5 h-5 border-2 border-[var(--color-spotify-green)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </template>

        <template v-else-if="activeTab === 'playlist'">
          <div v-if="playlist.length === 0" class="text-center py-10 text-sm text-[var(--color-text-silver)] font-semibold">
            {{ t('app.emptyPlaylist') }}
          </div>
          <div v-for="song in playlist" :key="song.songmid" class="group flex items-center justify-between p-2 rounded-[6px] transition-all hover:bg-[var(--color-dark-surface)] cursor-pointer" @click="isStandalone ? playSong(song, 'playlist') : addToRoomPlaylist(song)">
            <div class="flex items-center space-x-3 min-w-0">
              <div class="w-10 h-10 bg-[var(--color-dark-surface)] rounded-[4px] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--color-mid-dark)] transition-colors">
                <svg class="w-5 h-5 text-[var(--color-text-silver)] group-hover:text-[var(--color-text-white)] transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <div class="min-w-0">
                <div class="text-base font-semibold truncate text-[var(--color-text-white)]">{{ song.name }}</div>
                <div class="text-sm text-[var(--color-text-silver)] truncate">{{ song.singer }}</div>
              </div>
            </div>
            <button @click.stop="togglePlaylist(song)" class="text-[var(--color-spotify-green)] hover:text-[var(--color-text-white)] p-2 transition-colors focus:outline-none z-10 relative">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </template>

        <template v-else-if="activeTab === 'room'">
          <div v-if="roomPlaylist.length === 0" class="text-center py-10 text-sm text-[var(--color-text-silver)] font-semibold">
            {{ t('app.emptyRoomPlaylist') }}
          </div>
          <div v-for="(song, index) in roomPlaylist" :key="index" class="group flex items-center justify-between p-2 rounded-[6px] transition-all" :class="[hasControl ? 'hover:bg-[var(--color-dark-surface)] cursor-pointer' : 'opacity-50 cursor-not-allowed', (song.songmid || song.hash || song.id) === getTrackId() ? 'bg-[var(--color-dark-surface)]' : '']" @click="playSong(song, 'room')">
            <div class="flex items-center space-x-3 min-w-0">
              <div class="w-10 h-10 bg-[var(--color-dark-surface)] rounded-[4px] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--color-mid-dark)] transition-colors relative">
                <svg v-if="(song.songmid || song.hash || song.id) !== getTrackId()" class="w-5 h-5 text-[var(--color-text-silver)] group-hover:text-[var(--color-text-white)] transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                <div v-else class="flex space-x-[2px] h-4 items-end w-4 justify-center">
                  <div v-for="i in 3" :key="i" class="w-1 bg-[var(--color-spotify-green)] rounded-sm" :class="{'animate-pulse': isPlaying}" :style="{height: isPlaying ? `${Math.max(40, Math.random() * 100)}%` : '40%'}"></div>
                </div>
              </div>
              <div class="min-w-0">
                <div class="text-base font-semibold truncate" :class="(song.songmid || song.hash || song.id) === getTrackId() ? 'text-[var(--color-spotify-green)]' : 'text-[var(--color-text-white)]'">{{ song.name }}</div>
                <div class="text-sm text-[var(--color-text-silver)] truncate">{{ song.singer }} <span v-if="song.requesterName" class="ml-2 text-xs opacity-70">({{ song.requesterName }}{{ t('app.requesterSuffix') }})</span></div>
              </div>
            </div>
            <button @click.stop="removeSong(index)" v-if="hasControl" class="text-[var(--color-text-silver)] hover:text-red-500 p-2 transition-colors focus:outline-none z-10 relative opacity-0 group-hover:opacity-100">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </template>
      </div>
    </div>
  </aside>
</template>