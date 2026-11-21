import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { Tracker } from './tracker';
import { errorMessage, localPreview, supabase } from './store';
import './style.css';

function Masthead() {
  return <header className="masthead">
    <div className="shell brand"><span aria-hidden="true" className="brand-mark">✦</span> PAX TRACKER <span className="brand-edition">UNPLUGGED EDITION</span></div>
  </header>;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (sentTo && (event.nativeEvent as SubmitEvent).submitter?.id !== 'resend') {
        const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' });
        if (error) throw error;
      } else {
        const address = sentTo || email.trim();
        const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
        if (error) throw error;
        setSentTo(address);
        setMessage('Code sent. Check your inbox or spam folder.');
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <main className="shell welcome">
    <section className="welcome-copy">
      <p className="eyebrow"><span className="dot" /> TABLETOP EXPO FIELD GUIDE</p>
      <h1>Make the<br />show <em>yours.</em></h1>
      <p className="lede">Plan your booth stops, track the games you want to see, and pick up where you left off on any device.</p>
      <div className="features"><span>01 / Plan your stops</span><span>02 / Check off games</span><span>03 / Keep your notes</span></div>
    </section>
    <section className="panel signin" aria-labelledby="signin-heading">
      <p className="eyebrow">YOUR PRIVATE FIELD GUIDE</p>
      <h2 id="signin-heading">{sentTo ? 'Check your email' : 'Sign in'}</h2>
      {!supabase ? <p>This deployment is waiting for its Supabase connection. Sign-in is not available yet.</p> :
        <form onSubmit={submit}>
          {sentTo ? <>
            <p>Enter the one-time code sent to <strong>{sentTo}</strong>.</p>
            <label>One-time code<input autoFocus autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" required value={code} onChange={(e) => setCode(e.target.value)} /></label>
            <button className="primary full" disabled={busy}>{busy ? 'Working…' : 'Verify code'}</button>
            <div className="actions">
              <button id="resend" type="submit" formNoValidate className="text-button" disabled={busy}>Resend code</button>
              <button type="button" className="text-button" disabled={busy} onClick={() => { setSentTo(''); setCode(''); setError(''); setMessage(''); }}>Change email</button>
            </div>
          </> : <>
            <p>Invite-only access. Use the email address that was added for you.</p>
            <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <button className="primary full" disabled={busy}>{busy ? 'Sending…' : 'Send me a code'} <span aria-hidden="true">→</span></button>
          </>}
          {message && <p role="status">{message}</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </form>}
    </section>
  </main>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setReady(true);
    }).data.subscription;
    return () => subscription?.unsubscribe();
  }, []);

  return <><Masthead />
    {!ready ? <main className="shell loading" role="status">Checking your sign-in…</main> :
      localPreview ? <Tracker ownerId="local-preview" email="Local preview · saved in this browser" /> :
      session ? <Tracker key={session.user.id} ownerId={session.user.id} email={session.user.email} /> : <SignIn />}
    <footer className="shell footer">PAX TRACKER <span>Unofficial personal planner · Not affiliated with PAX</span></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
