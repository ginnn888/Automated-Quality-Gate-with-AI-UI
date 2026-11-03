'use client';

import { flushSync } from 'react-dom';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const Account = createContext<number | null>(null);
const channelName = 'quality-gate-session';
export function notifyLogout() {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage('logout'); channel.close();
  }
}
export function useAccountFetch() {
  const id = useContext(Account);
  return async (url: string, init: RequestInit = {}) => {
    if (!id) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    const headers = new Headers(init.headers);
    headers.set('X-QG-User-ID', String(id));
    const response = await fetch(url, {...init, headers, cache:'no-store'});
    if ([401,409].includes(response.status)) {
      const data = await response.clone().json().catch(() => ({}));
      if (response.status === 401 || data.code === 'ACCOUNT_CHANGED') {
        window.dispatchEvent(new Event('qg-account-invalid'));
        throw new Error('บัญชีเปลี่ยนหรือหมดอายุ กรุณาโหลดหน้าใหม่');
      }
    }
    return response;
  };
}

export default function AccountBoundary({userId, children}: {userId:number; children:ReactNode}) {
  const [state, setState] = useState<'checking'|'ready'|'invalid'>('checking');
  useEffect(() => {
    let disposed = false, invalid = false, sequence = 0;
    const clear = () => { invalid = true; sequence++; setState('invalid'); };
    const check = async () => {
      if (invalid) return;
      const current = ++sequence;
      try {
        const response = await fetch('/api/auth/me', {cache:'no-store'});
        const data = await response.json();
        if (disposed || current !== sequence) return;
        if (!response.ok || data.user?.id !== userId) clear();
        else setState('ready');
      } catch { if (!disposed && current === sequence) clear(); }
    };
    const hide = () => { sequence++; flushSync(() => setState('checking')); };
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName);
    if (channel) channel.onmessage = event => { if (event.data === 'logout') clear(); else void check(); };
    channel?.postMessage('check');
    void check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    window.addEventListener('pagehide', hide);
    window.addEventListener('qg-account-invalid', clear);
    return () => {
      disposed = true; channel?.close(); window.clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('qg-account-invalid', clear);
    };
  }, [userId]);
  if (state !== 'ready') return <main><p>{state === 'checking' ? 'กำลังยืนยันบัญชี…' : 'บัญชีเปลี่ยน หมดอายุ หรือยืนยันไม่ได้ ล้างข้อมูลจากหน้านี้แล้ว'}</p><a href="/">โหลดหน้าใหม่เพื่อเข้าสู่บัญชีปัจจุบัน</a></main>;
  return <Account.Provider value={userId}>{children}</Account.Provider>;
}
