import { ref, onMounted, onUnmounted } from 'vue';

export function useDevice() {
  const isMobile = ref(false);

  const checkDevice = () => {
    isMobile.value = window.innerWidth < 768; // Tailwind's md breakpoint is 768px
  };

  onMounted(() => {
    checkDevice();
    window.addEventListener('resize', checkDevice);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', checkDevice);
  });

  return {
    isMobile
  };
}
