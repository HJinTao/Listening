import { createI18n } from 'vue-i18n';

const messages = {
  en: {
    app: {
      title: 'ListenSync',
      login: 'Login',
      register: 'Register',
      username: 'Username',
      password: 'Password',
      rememberMe: 'Remember Password',
      needAccount: 'Need an account? Register',
      haveAccount: 'Already have an account? Login',
      authRequired: 'Authentication Required',
      joinRoom: 'Join Room',
      welcome: 'Welcome, {username}',
      channelId: 'Channel ID',
      connect: 'Connect',
      logout: 'Logout',
      freq: 'FREQ',
      op: 'OP',
      search: 'Search',
      playlist: 'Playlist',
      audioDb: 'Audio DB',
      query: 'Search for songs...',
      noResults: 'No Results',
      emptyPlaylist: 'Empty Playlist',
      notHost: 'Only host can play music',
      nowPlaying: 'Now Playing',
      idle: 'IDLE',
      waitingTrack: 'Waiting for track',
      mode: 'Mode',
      master: 'Master',
      slave: 'Slave',
      noLyric: 'No lyric data',
      activeNodes: 'Active Nodes',
      me: 'ME',
      commsLog: 'Comms Log',
      inputMessage: 'Type a message...',
      send: 'Send',
      quality: {
        std: 'Standard',
        hq: 'High Quality',
        lossless: 'Lossless'
      },
      player: {
        playMode: 'Play Mode',
        listLoop: 'List Loop',
        singleLoop: 'Single Loop',
        random: 'Random',
        prev: 'Previous',
        play: 'Play',
        pause: 'Pause',
        next: 'Next',
        volume: 'Volume'
      }
    }
  },
  zh: {
    app: {
      title: 'ListenSync',
      login: '登录',
      register: '注册',
      username: '用户名',
      password: '密码',
      rememberMe: '记住密码',
      needAccount: '没有账号？去注册',
      haveAccount: '已有账号？去登录',
      authRequired: '需要身份验证',
      joinRoom: '加入房间',
      welcome: '欢迎, {username}',
      channelId: '房间号',
      connect: '连接',
      logout: '退出登录',
      freq: '频道',
      op: '操作员',
      search: '搜索',
      playlist: '播放列表',
      audioDb: '曲库',
      query: '搜索歌曲...',
      noResults: '暂无结果',
      emptyPlaylist: '播放列表为空',
      notHost: '非房主无法播放音乐',
      nowPlaying: '正在播放',
      idle: '空闲',
      waitingTrack: '等待播放',
      mode: '模式',
      master: '房主',
      slave: '成员',
      noLyric: '暂无歌词',
      activeNodes: '在线成员',
      me: '我',
      commsLog: '聊天记录',
      inputMessage: '输入消息...',
      send: '发送',
      quality: {
        std: '标准音质',
        hq: '高音质',
        lossless: '无损音质'
      },
      player: {
        playMode: '播放模式',
        listLoop: '列表循环',
        singleLoop: '单曲循环',
        random: '随机播放',
        prev: '上一首',
        play: '播放',
        pause: '暂停',
        next: '下一首',
        volume: '音量'
      }
    }
  }
};

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'en',
  fallbackLocale: 'en',
  messages,
});
