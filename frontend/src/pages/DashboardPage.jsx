import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { useApi } from '../hooks/useApi.js';
import LoadError from '../components/LoadError.jsx';
import StartCallCta from '../components/dashboard/StartCallCta.jsx';
import StatTiles from '../components/dashboard/StatTiles.jsx';
import WhereCallsEnd from '../components/dashboard/WhereCallsEnd.jsx';
import OutcomeBars from '../components/dashboard/OutcomeBars.jsx';
import RecentCalls from '../components/dashboard/RecentCalls.jsx';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton.jsx';

const loadDashboard = async () => {
  const [stats, recent] = await Promise.all([api.getStats(), api.listCalls({ limit: 5 })]);
  return { stats, calls: recent.calls };
};

export default function DashboardPage() {
  const { data, error, loading, slow, reload } = useApi(loadDashboard, []);

  return (
    <section className="dashboard" aria-labelledby="dash-title">
      <div className="dash-head">
        <h1 id="dash-title" className="page-title">Dashboard</h1>
        <StartCallCta />
      </div>

      {loading && !data && <DashboardSkeleton slow={slow} />}
      {error && <LoadError message="Couldn't load the dashboard." onRetry={reload} />}
      {data && <DashboardBody {...data} />}
    </section>
  );
}

function DashboardBody({ stats, calls }) {
  if (stats.total === 0) {
    return (
      <div className="empty-state">
        <p>No calls yet. Your numbers show up here after the first one.</p>
        <Link to="/call" className="btn">Start your first call</Link>
      </div>
    );
  }
  return (
    <>
      <StatTiles stats={stats} />
      <WhereCallsEnd byStage={stats.by_stage} total={stats.total} />
      <div className="dash-grid">
        <OutcomeBars byOutcome={stats.by_outcome} />
        <RecentCalls calls={calls} />
      </div>
    </>
  );
}
