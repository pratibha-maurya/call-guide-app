import { NavLink } from 'react-router-dom';
import HealthDot from './HealthDot.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useLiveCall } from '../hooks/useLiveCall.jsx';
import { usingMock } from '../api/index.js';

export default function Header() {
  const { state } = useLiveCall();
  const { user, logout } = useAuth();
  const onCall = state.phase === 'live' || state.phase === 'closing';

  return (
    <header className="header">
      <div className="header-inner">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Call Guide
        </span>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end className="nav-link">
            Dashboard
          </NavLink>
          <NavLink to="/call" className="nav-link">
            {onCall ? 'Live call' : 'New call'}
            {onCall && <span className="nav-live" aria-hidden="true" />}
          </NavLink>
          <NavLink to="/calls" className="nav-link">
            Past calls
          </NavLink>
        </nav>
        <HealthDot />
        {!usingMock && (
          <span className="account">
            <span className="account-email" title={user.email}>{user.email}</span>
            <button type="button" className="btn btn-small" onClick={logout}>Log out</button>
          </span>
        )}
      </div>
    </header>
  );
}
