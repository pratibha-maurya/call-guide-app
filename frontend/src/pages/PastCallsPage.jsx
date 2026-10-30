import { api } from '../api/index.js';
import { useApi } from '../hooks/useApi.js';
import WhereCallsEnd from '../components/past/WhereCallsEnd.jsx';
import CallRow from '../components/past/CallRow.jsx';
import LoadError from '../components/LoadError.jsx';

export default function PastCallsPage() {
  const { data, error, loading, reload } = useApi(() => api.listCalls(50), []);
  const calls = data?.calls ?? [];

  return (
    <section className="past" aria-labelledby="past-title">
      <h1 id="past-title" className="page-title">Past calls</h1>

      {loading && <p className="empty" role="status">Loading calls... if the server was asleep this can take a minute.</p>}
      {error && <LoadError message="Couldn't load past calls." onRetry={reload} />}
      {!loading && !error && calls.length === 0 && (
        <p className="empty">No calls yet. Start one from New call and it will show up here.</p>
      )}

      {calls.length > 0 && (
        <>
          <WhereCallsEnd calls={calls} />
          <ul className="call-list">
            {calls.map((c) => (
              <CallRow key={c.id} call={c} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
