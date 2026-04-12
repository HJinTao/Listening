import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import axios from 'axios'
import { i18n } from './i18n'

axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

createApp(App).use(i18n).mount('#app')
