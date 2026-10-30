// The only free-text box. At stage 5 (wordsRequired) it becomes the focus of the
// screen: the prospect's exact words are what the next call is built on.
export default function WordsBox({ stage, value, onChange }) {
  const key = Boolean(stage.wordsRequired);
  const id = `words-${stage.no}`;
  return (
    <div className={`words${key ? ' words-key' : ''}`}>
      <label htmlFor={id} className={key ? 'words-label-key' : 'section-label'}>
        {key ? 'Write their exact words' : 'Their words'}
      </label>
      {key && <p className="words-why">This is the line the next call is built on. Quote them, don't summarise.</p>}
      <textarea
        id={id}
        key={id}
        className="textarea words-input"
        rows={key ? 4 : 2}
        value={value}
        placeholder={stage.wordsHint}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
