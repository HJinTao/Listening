<script setup lang="ts">
import LeftSidebar from '../sidebar/LeftSidebar.vue';
import RightSidebar from '../sidebar/RightSidebar.vue';
import PlayerStage from '../player/PlayerStage.vue';
import PlayerControls from '../player/PlayerControls.vue';
</script>

<template>
  <main class="flex-grow flex flex-row overflow-hidden bg-[var(--color-near-black)] p-2 gap-2 relative min-h-0">
    <!-- Left Sidebar (Lists) -->
    <LeftSidebar class="flex" />
    
    <!-- Center Player -->
    <div class="flex flex-grow flex-col relative rounded-[8px] overflow-hidden shadow-[var(--shadow-spotify-heavy)] min-h-0 min-w-0">
      <PlayerStage class="bg-[var(--color-near-black)] min-h-0" />
      <PlayerControls />
    </div>

    <!-- Right Sidebar (Users and Chat) -->
    <RightSidebar class="flex" />
  </main>
</template>
