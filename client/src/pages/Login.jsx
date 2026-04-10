import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast, { Toaster } from 'react-hot-toast';
import { HiOutlineSun, HiOutlineMoon } from 'react-icons/hi';
import { Spinner } from '../components/Loaders';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(identifier, password);
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <Toaster position="top-center" />
      <div className="login-card slide-up" style={{ position: 'relative' }}>
        <button className="theme-toggle" onClick={toggleTheme} style={{ position: 'absolute', top: 20, right: 20 }}>
          {theme === 'dark' ? <HiOutlineSun /> : <HiOutlineMoon />}
        </button>
        <div className="login-brand">
          <div className="login-icon">B</div>
          <h1>Bumblebee</h1>
          <p>Car Wash Management System</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username or Phone</label>
            <input
              type="text"
              className="form-control"
              placeholder="Name or phone number"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className={`btn btn-primary ${loading ? 'loading' : ''}`} disabled={loading}>
            {loading ? <><Spinner size={15} /> <span className="btn-text">Signing in...</span></> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
