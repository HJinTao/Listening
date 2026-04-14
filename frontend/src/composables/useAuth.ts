import axios from 'axios';
import { 
  backendUrl, username, password, token, isLoggedIn, 
  isLoginMode, rememberPassword, isJoined, isStandalone, socket 
} from '../store/state';

export function useAuth() {
  const handleAuth = async () => {
    if (!username.value || !password.value) return alert('Username and password required');
    try {
      const endpoint = isLoginMode.value ? '/api/auth/login' : '/api/auth/register';
      const resp = await axios.post(`${backendUrl}${endpoint}`, {
        username: username.value,
        password: password.value
      });
      token.value = resp.data.token;
      username.value = resp.data.user.username;
      localStorage.setItem('token', token.value);
      localStorage.setItem('username', username.value);
      
      if (isLoginMode.value) {
        if (rememberPassword.value) {
          localStorage.setItem('rememberPassword', 'true');
          localStorage.setItem('saved_username', username.value);
          localStorage.setItem('saved_password', password.value);
        } else {
          localStorage.setItem('rememberPassword', 'false');
          localStorage.removeItem('saved_username');
          localStorage.removeItem('saved_password');
        }
      }

      isLoggedIn.value = true;
    } catch (error: any) {
      alert(error.response?.data?.error || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    token.value = '';
    username.value = '';
    password.value = '';
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    isLoggedIn.value = false;
    isJoined.value = false;
    isStandalone.value = false;
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  };

  return {
    handleAuth,
    handleLogout
  };
}