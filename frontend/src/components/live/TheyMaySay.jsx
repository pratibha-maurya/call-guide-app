export default function TheyMaySay({ lines }) {
  return (
    <div className="maysay">
      <h2 className="section-label">They may say</h2>
      <ul className="maysay-list">
        {lines.map((line) => (
          <li key={line} className="maysay-line">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
