import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useSession } from '../../api/session';
import { defaultTab } from '../../auth/tabs';
import { CafeError } from './CafeError';

/** A link that is not a screen of this app. */
export function NotFoundPage() {
  const user = useSession((s) => s.user);
  return <CafeError code="404" actions={<>
    <Link to={user ? `/${defaultTab(user)}` : '/'} className="btn btn-primary h-11 px-5">Back to the counter</Link>
    <a href="/menu" className="btn btn-secondary h-11 px-5">See our menu</a>
  </>} />;
}

/** A screen this person's role may not open. */
export function ForbiddenPage() {
  const user = useSession((s) => s.user);
  return <CafeError code="403" actions={<Link to={user ? `/${defaultTab(user)}` : '/'} className="btn btn-primary h-11 px-5">Back to my screen</Link>} />;
}

/** Catches a screen that crashed (or a screen file that could not be loaded after an update) so nobody is left with a blank page. */
export class CrashBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Screen crashed', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <CafeError fullPage code="crash" actions={<>
      <button type="button" id="btnCrashReload" onClick={() => window.location.reload()} className="btn btn-primary h-11 px-5">Reload</button>
      <a href="/" className="btn btn-secondary h-11 px-5">Back to the counter</a>
    </>} />;
  }
}
