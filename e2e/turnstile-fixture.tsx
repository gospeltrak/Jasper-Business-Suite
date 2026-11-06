import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TurnstileWidget from '../src/shared/components/TurnstileWidget';

// Isolated mock of Cloudflare's browser API; no network, keys, or real accounts.
// This checks the actual React widget's token, expiry and reset life cycle.
const handlers = new Map<string, { container: HTMLElement; options: Record<string, any> }>();
let nextId = 0;
let lastId = '';
let renderCount = 0;
let removeCount = 0;

(window as any).turnstile = {
  render(container: HTMLElement, options: Record<string, any>) {
    const id = 'mock-' + (++nextId);
    lastId = id;
    renderCount++;
    handlers.set(id, { container, options });
    const solve = document.createElement('button');
    solve.type = 'button';
    solve.textContent = 'Solve test challenge';
    solve.setAttribute('data-testid','mock-solve-challenge');
    solve.onclick = () => options.callback('mock-valid-token-' + id);
    container.replaceChildren(solve);
    document.body.dataset.renderCount = String(renderCount);
    return id;
  },
  reset(id: string) {
    const entry = handlers.get(id);
    entry?.options['expired-callback']?.();
  },
  remove(id: string) {
    const entry = handlers.get(id);
    entry?.container.replaceChildren();
    handlers.delete(id);
    removeCount++;
    document.body.dataset.removeCount = String(removeCount);
  },
};
(window as any).__turnstileQA = {
  error: (code = '110200') => handlers.get(lastId)?.options['error-callback']?.(code),
  expire: () => handlers.get(lastId)?.options['expired-callback']?.(),
  timeout: () => handlers.get(lastId)?.options['timeout-callback']?.(),
  activeWidgets: () => handlers.size,
};

function Fixture() {
  const [token,setToken] = useState('');
  const [resetKey,setResetKey] = useState(0);
  const refresh = () => { setToken(''); setResetKey(v => v + 1); };
  return <main style={{width:'min(100%,500px)',margin:'0 auto',boxSizing:'border-box',padding:16,fontFamily:'sans-serif'}}>
    <h1>Orvix Cloudflare verification test</h1>
    <TurnstileWidget onVerify={setToken} onExpire={() => setToken('')} resetKey={resetKey}/>
    <p data-testid="challenge-token">{token || 'NO_TOKEN'}</p>
    <button type="button" data-testid="consume-token" onClick={refresh}>Simulate server consumed token</button>
    <button type="button" data-testid="mock-error" onClick={()=>(window as any).__turnstileQA.error()}>Simulate error</button>
    <button type="button" data-testid="mock-expire" onClick={()=>(window as any).__turnstileQA.expire()}>Simulate expiry</button>
    <button type="button" data-testid="mock-timeout" onClick={()=>(window as any).__turnstileQA.timeout()}>Simulate timeout</button>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
