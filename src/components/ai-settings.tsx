export default function AISettings({ model }: { model: string }) {
  return (
    <section className="credential-panel">
      <h3>Review settings</h3>
      <dl className="review-summary">
        <div><dt>Project type</dt><dd>JavaScript / Jest</dd></div>
        <div><dt>Gemini model</dt><dd>{model}</dd></div>
      </dl>
    </section>
  );
}
