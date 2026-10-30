// Grey placeholders in the shape of the dashboard while /stats loads.
export default function DashboardSkeleton({ slow }) {
  return (
    <div className="skeleton" role="status" aria-label="Loading dashboard">
      {slow && (
        <p className="waking">
          <span className="waking-pulse" aria-hidden="true" />
          Waking the server… the first visit of the day can take up to a minute.
        </p>
      )}
      <div className="tiles">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="tile skel-block" />
        ))}
      </div>
      <div className="panel skel-block skel-tall" />
    </div>
  );
}
