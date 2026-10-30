// "Completed" or "In progress", used in lists and on the detail page.
export default function StatusBadge({ status }) {
  const live = status === 'in_progress';
  return <span className={`pill${live ? ' pill-live' : ' pill-done'}`}>{live ? 'In progress' : 'Completed'}</span>;
}
