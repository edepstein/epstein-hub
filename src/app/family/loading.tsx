export default function Loading() {
  return (
    <div className="family-panel family-state" role="status" aria-live="polite" data-state="loading">
      <h2>Opening the family space…</h2>
      <p className="form-hint">Checking your access. This only takes a moment.</p>
    </div>
  );
}
