import { Github, ShieldCheck } from 'lucide-react';
import { configured, sessionToken } from '@/lib/session';
import { identityFor } from '@/lib/identity';
export const dynamic = 'force-dynamic';
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const token = await sessionToken();
  const user = token ? await identityFor(token).catch(() => null) : null;
  return <main className="login-page"><section className="login-panel">
    <a className="brand" href="/login"><span className="brand-icon"><ShieldCheck size={26}/></span><span>Automated Quality Gate<small>AI-powered code review</small></span></a>
    <h1>Sign in with<br/>GitHub</h1>
    <p>Choose a repository to review code, generate tests and see the results in your pull request.</p>
    {notice === 'auth' && <p role="alert" className="notice">Your session expired or your account could not be verified. Sign in again.</p>}
    {notice === 'logout' && <p role="status" className="notice">You signed out of Automated Quality Gate.</p>}
    {user ? <div className="login-current"><p>Signed in as <strong>@{user.login}</strong></p><a className="primary" href="/">View repositories</a><form action="/api/auth/logout" method="post"><button className="text-button">Sign out to switch accounts</button></form></div> : configured() ? <a className="primary login-cta" href="/api/auth/login"><Github size={20}/> Sign in with GitHub</a> : <p role="alert" className="notice">Sign-in is temporarily unavailable. Try again later.</p>}
    <div className="login-help"><h2>Using another account?</h2><p>Check your account on <a href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a> and switch accounts before signing in, or open this site in a private window.</p><small>Signing out of Automated Quality Gate keeps your GitHub session active. You will see repositories your account can access and has shared with the app.</small></div>
  </section></main>;
}
