import { NavLink } from 'react-router-dom';
import HealthDot from './HealthDot.jsx';
import { useLiveCall } from '../hooks/useLiveCall.jsx';

export default function Header() {
  const { state } = useLiveCall();
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
            {onCall ? 'Live call' : 'New call'}
          </NavLink>
          <NavLink to="/calls" className="nav-link">
            Past calls
          </NavLink>
        </nav>
        <HealthDot />
      </div>
    </header>
  );
}
