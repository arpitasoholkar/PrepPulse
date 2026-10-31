import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { useUser } from '../../context/UserContext.jsx';
import { login } from '../../api/auth.js';
import { getErrorMessage } from '../../api/client.js';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import AnimatedLogo from '../../components/AnimatedLogo.jsx';
import { ArrowRight, UserCheck, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [loginErrorPose, setLoginErrorPose] = useState(false);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const { user, setUser } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const handleMouseMove = (event) => {
      setPointer({
        x: Math.max(-8, Math.min(8, (event.clientX / window.innerWidth - 0.5) * 16)),
        y: Math.max(-5, Math.min(5, (event.clientY / window.innerHeight - 0.5) * 10)),
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const showErrorPose = () => {
    setLoginErrorPose(true);
    window.setTimeout(() => setLoginErrorPose(false), 1300);
  };

  const completeLogin = async (loginName, loginEmail, loginPassword = '') => {
    try {
      setLoading(true);
      setError(null);
      const res = await login({ name: loginName.trim(), email: loginEmail.trim(), password: loginPassword });
      const userData = res.data.user;
      setUser(userData);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(getErrorMessage(err, 'Login failed. Please try again.'));
      showErrorPose();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setError('Enter your name to continue.');
      showErrorPose();
      return;
    }

    if (!email.trim()) {
      setError('Enter your email address.');
      showErrorPose();
      return;
    }

    if (!password) {
      setError('Enter your password.');
      showErrorPose();
      return;
    }

    await completeLogin(name, email, password);
  };

  const handleQuickDemoLogin = async () => {
    setName('Demo Student');
    setEmail('demo@intelliprep.dev');
    await completeLogin('Demo Student', 'demo@intelliprep.dev');
  };

  if (user) return <Navigate to="/dashboard" replace />;

  // password focused + hidden: eyes snap shut. Password visible: characters glance at the field.
  const hiding = passwordFocused && !showPassword;
  const peeking = passwordFocused && showPassword;
  const eyeTransform = peeking
    ? 'translate(3px, 2px)'
    : `translate(${pointer.x * 0.45}px, ${pointer.y * 0.4}px)`;
  // the dot eyes carry their own inline transform, so the squash has to be part of it
  const dotTransform = hiding ? `${eyeTransform} scaleY(.08)` : eyeTransform;

  return (
    <Layout bare>
      <div className="ip-login-shell">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

          .ip-login-shell, .ip-login-shell * { box-sizing: border-box; }
          /* background comes from Layout's lavender .app-bg, so the shell stays transparent */
          .ip-login-shell {
            height: 100vh;
            width: 100%;
            padding: 16px;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          }
          .ip-login-card {
            width: min(1020px, 100%);
            height: min(580px, 100%);
            display: grid;
            grid-template-columns: 1.04fr .96fr;
            overflow: hidden;
            border-radius: 24px;
            background: #fff;
            box-shadow: 0 30px 70px -24px rgba(70, 40, 140, .45);
          }
          .ip-login-left {
            position: relative;
            overflow: hidden;
            padding: 26px 34px;
            background: linear-gradient(145deg, #efedf3 0%, #e5e2eb 100%);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            color: #24212b;
          }
          .ip-login-left:before, .ip-login-left:after {
            content: "";
            position: absolute;
            border-radius: 999px;
            pointer-events: none;
            filter: blur(2px);
          }
          .ip-login-left:before {
            width: 260px; height: 260px; right: -110px; top: 12%;
            background: rgba(119, 74, 235, .07);
          }
          .ip-login-left:after {
            width: 220px; height: 220px; left: -100px; bottom: 7%;
            background: rgba(244, 145, 74, .08);
          }
          .ip-login-brand { position: relative; z-index: 2; }
          .ip-login-tagline {
            position: relative; z-index: 2; max-width: 400px;
            margin: 12px 0 0; font-size: clamp(19px, 2vw, 25px);
            line-height: 1.25; letter-spacing: -.04em; font-weight: 800; color: #24212b;
          }
          .ip-login-tagline span { color: #6734d7; }
          .ip-character-stage {
            position: relative; z-index: 2; width: 100%;
            flex: 1; min-height: 0; margin: 6px 0;
            display: flex; align-items: flex-end; justify-content: center;
          }
          .ip-character-scene {
            position: relative; width: 390px; height: 270px; flex: none;
            transform: scale(.92); transform-origin: bottom center;
          }
          .ip-character {
            position: absolute; bottom: 0; transform-origin: bottom center;
            transition: transform .45s cubic-bezier(.2,.8,.2,1), height .45s ease;
          }
          .ip-char-purple { left: 75px; width: 112px; height: 218px; background: #6735ed; border-radius: 5px 5px 0 0; z-index: 1; }
          .ip-char-black { left: 180px; width: 94px; height: 158px; background: #25232a; border-radius: 5px 5px 0 0; z-index: 2; }
          .ip-char-orange { left: 12px; width: 172px; height: 108px; background: #f28a43; border-radius: 100px 100px 0 0; z-index: 3; }
          .ip-char-yellow { left: 260px; width: 94px; height: 132px; background: #e9d900; border-radius: 52px 52px 0 0; z-index: 4; }
          .ip-character-eyes { position: absolute; display: flex; align-items: center; gap: 12px; transition: all .3s ease; }
          .ip-eye-white { display: grid; place-items: center; width: 14px; height: 14px; border-radius: 50%; background: #fff; overflow: hidden; }
          .ip-eye-pupil { width: 6px; height: 6px; background: #25232a; border-radius: 50%; transition: transform .12s ease; }
          .ip-eye-dot { display: block; width: 8px; height: 8px; border-radius: 50%; background: #25232a; transition: transform .12s ease; }
          .ip-mouth { position: absolute; width: 34px; height: 3px; background: #25232a; border-radius: 5px; }
          .ip-orange-mouth { position: absolute; left: 69px; top: 74px; width: 23px; height: 11px; border-bottom: 3px solid #25232a; border-radius: 0 0 20px 20px; transition: all .25s ease; }
          .ip-character-stage.is-error .ip-character-eyes, .ip-character-stage.is-error .ip-mouth { animation: ip-character-shake .55s ease-in-out; }
          .ip-character-stage.is-error .ip-orange-mouth { border-bottom: 0; border-top: 3px solid #25232a; border-radius: 20px 20px 0 0; }
          @keyframes ip-character-shake { 0%,100%{translate:0 0} 25%{translate:-5px 0} 50%{translate:4px 0} 75%{translate:-2px 0} }
          /* eyes shut fast when the password is hidden, open a little slower */
          .ip-eye-white, .ip-eye-dot { transition: transform .16s ease; }
          .ip-character-stage.is-hiding .ip-eye-white,
          .ip-character-stage.is-hiding .ip-eye-dot { transform: scaleY(.08); transition-duration: .07s; }
          .ip-character-stage.is-hiding .ip-orange-mouth { width: 14px; left: 74px; }
          .ip-pass-wrap { position: relative; }
          .ip-pass-wrap input { padding-right: 36px; }
          .ip-pass-toggle {
            position: absolute; right: 0; bottom: 8px; width: 28px; height: 28px; display: grid; place-items: center;
            border: 0; border-radius: 8px; background: transparent; color: #8d8996; cursor: pointer; transition: color .2s, background .2s;
          }
          .ip-pass-toggle:hover { color: #6735ed; background: #f0ebfc; }
          .ip-pass-toggle:focus-visible { outline: 2px solid #6735ed; outline-offset: 1px; }
          @keyframes ip-character-blink { 0%,94%,100%{transform:scaleY(1)} 97%{transform:scaleY(.12)} }
          .ip-blink { animation: ip-character-blink 5.8s infinite; }
          .ip-login-right {
            display: flex; align-items: center; justify-content: center;
            padding: 24px 40px; background: #fff; overflow-y: auto;
          }
          .ip-login-form-wrap { width: 100%; max-width: 350px; }
          .ip-form-spark { display: flex; justify-content: center; margin-bottom: 12px; color: #25232a; }
          .ip-form-heading { text-align: center; margin-bottom: 22px; }
          .ip-form-heading h1 { margin: 0; color: #24212b; font-size: 26px; line-height: 1.2; font-weight: 800; letter-spacing: -.045em; }
          .ip-form-heading p { margin: 7px 0 0; color: #92909a; font-size: 12px; }
          .ip-form-field { margin-bottom: 15px; }
          .ip-form-field label { display: block; margin: 0 0 4px; padding-left: 1px; color: #4d4954; font-size: 12px; font-weight: 600; }
          .ip-form-field input {
            width: 100%; height: 40px; border: 0; border-bottom: 1.5px solid #dedde2;
            border-radius: 0; outline: none; background: transparent; color: #24212b;
            font: 14px Inter, sans-serif; transition: border-color .2s ease;
          }
          .ip-form-field input::placeholder { color: #c5c2ca; }
          .ip-form-field input:focus { border-bottom-color: #6735ed; }
          .ip-login-submit {
            width: 100%; height: 44px; display: flex; align-items: center; justify-content: center; gap: 9px;
            margin-top: 20px; border: 0; border-radius: 999px; background: #202027; color: white;
            font: 700 12px Inter, sans-serif; cursor: pointer; transition: transform .2s, background .2s;
          }
          .ip-login-submit:hover { background: #6735ed; transform: translateY(-1px); }
          .ip-login-submit:disabled { opacity: .6; cursor: wait; transform: none; }
          .ip-login-divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; color: #aaa6b0; font-size: 10px; }
          .ip-login-divider:before, .ip-login-divider:after { content: ""; height: 1px; flex: 1; background: #ecebf0; }
          .ip-demo-button {
            width: 100%; min-height: 42px; display: flex; align-items: center; justify-content: center; gap: 10px;
            border: 1px solid #e7e5eb; border-radius: 999px; background: #f7f6f9; color: #393541;
            font: 700 12px Inter, sans-serif; cursor: pointer; transition: all .2s;
          }
          .ip-demo-button:hover { border-color: #d3c5f7; background: #f0ebfc; }
          .ip-demo-icon { width: 23px; height: 23px; display: grid; place-items: center; border-radius: 50%; background: #e9e1fb; color: #6735ed; }
          .ip-login-bottom { margin: 16px 0 0; text-align: center; color: #aaa6b0; font-size: 10px; }
          @media (max-width: 900px) {
            .ip-login-card { grid-template-columns: 1fr; max-width: 480px; }
            .ip-login-left { display: none; }
            .ip-login-right { padding: 24px 28px; }
          }
          @media (max-width: 480px) {
            .ip-login-shell { padding: 0; }
            .ip-login-card { height: 100%; border-radius: 0; box-shadow: none; }
          }
        `}</style>

        <main className="ip-login-card">
          <section className="ip-login-left">
            <div className="ip-login-brand">
              <AnimatedLogo className="w-32 sm:w-36" title="IntelliPrep" />
              <h2 className="ip-login-tagline">
                Learn smarter. <span>Improve faster.</span>
              </h2>
            </div>

            <div className={`ip-character-stage ${loginErrorPose ? 'is-error' : ''} ${hiding ? 'is-hiding' : ''}`}>
              <div className="ip-character-scene">
                <div
                  className="ip-character ip-char-purple"
                  style={{
                    transform: `skewX(${pointer.x * -0.25}deg) ${emailFocused ? 'translateX(12px)' : ''}`,
                    height: emailFocused ? 232 : 218,
                  }}
                >
                  <div className="ip-character-eyes ip-blink" style={{ left: 31 + pointer.x * .25, top: 25 + pointer.y * .2 }}>
                    <span className="ip-eye-white"><i className="ip-eye-pupil" style={{ transform: eyeTransform }} /></span>
                    <span className="ip-eye-white"><i className="ip-eye-pupil" style={{ transform: eyeTransform }} /></span>
                  </div>
                  <span style={{ position: 'absolute', left: 28, top: 52, width: 13, height: 4, borderBottom: '3px solid #25232a', borderRadius: '50%' }} />
                </div>

                <div className="ip-character ip-char-black" style={{ transform: `skewX(${pointer.x * .2}deg)` }}>
                  <div className="ip-character-eyes ip-blink" style={{ left: 17 + pointer.x * .2, top: 18 + pointer.y * .2 }}>
                    <span className="ip-eye-white"><i className="ip-eye-pupil" style={{ transform: eyeTransform }} /></span>
                    <span className="ip-eye-white"><i className="ip-eye-pupil" style={{ transform: eyeTransform }} /></span>
                  </div>
                </div>

                <div className="ip-character ip-char-orange" style={{ transform: `skewX(${pointer.x * -.15}deg)` }}>
                  <div className="ip-character-eyes" style={{ left: 35 + pointer.x * .25, top: 28 + pointer.y * .2 }}>
                    <i className="ip-eye-dot" style={{ transform: dotTransform }} />
                    <i className="ip-eye-dot" style={{ transform: dotTransform }} />
                  </div>
                  <div className="ip-orange-mouth" />
                </div>

                <div className="ip-character ip-char-yellow" style={{ transform: `skewX(${pointer.x * -.15}deg)` }}>
                  <div className="ip-character-eyes" style={{ left: 34 + pointer.x * .2, top: 27 + pointer.y * .2 }}>
                    <i className="ip-eye-dot" style={{ transform: dotTransform }} />
                    <i className="ip-eye-dot" style={{ transform: dotTransform }} />
                  </div>
                  <div className="ip-mouth" style={{ left: 27, top: 72 }} />
                </div>
              </div>
            </div>
          </section>

          <section className="ip-login-right">
            <div className="ip-login-form-wrap">
              <div className="ip-form-spark" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2.5L13.5 10.5L12 12L10.5 10.5L12 2.5Z" fill="currentColor" />
                  <path d="M12 21.5L10.5 13.5L12 12L13.5 13.5L12 21.5Z" fill="currentColor" />
                  <path d="M2.5 12L10.5 10.5L12 12L10.5 13.5L2.5 12Z" fill="currentColor" />
                  <path d="M21.5 12L13.5 13.5L12 12L13.5 10.5L21.5 12Z" fill="currentColor" />
                </svg>
              </div>

              <header className="ip-form-heading">
                <h1>Welcome back!</h1>
                <p>Enter your details to continue learning</p>
              </header>

              {error && (
                <ErrorBanner
                  error={error}
                  onDismiss={() => setError(null)}
                  className="mb-4"
                />
              )}

              <form onSubmit={handleLogin} noValidate>
                <div className="ip-form-field">
                  <label htmlFor="login-name">Your name</label>
                  <input
                    id="login-name"
                    type="text"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div className="ip-form-field">
                  <label htmlFor="login-email">Email address</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoComplete="email"
                  />
                </div>

                <div className="ip-form-field">
                  <label htmlFor="login-password">Password</label>
                  <div className="ip-pass-wrap">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="ip-pass-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      onMouseDown={(e) => e.preventDefault()}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button className="ip-login-submit" type="submit" disabled={loading}>
                  {loading ? 'Logging in…' : 'Continue to IntelliPrep'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <div className="ip-login-divider">or</div>

              <button
                className="ip-demo-button"
                type="button"
                onClick={handleQuickDemoLogin}
                disabled={loading}
              >
                <span className="ip-demo-icon"><UserCheck size={14} /></span>
                {loading ? 'Please wait…' : 'Explore with demo account'}
              </button>

              <p className="ip-login-bottom">Your progress and learning preferences stay yours.</p>
            </div>
          </section>
        </main>
      </div>
    </Layout>
  );
}