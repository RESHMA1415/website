// Marks a screen whose layout is ready but whose function arrives in a later build phase
export default function PhaseNotice({ phase, children }) {
  return (
    <div className="alert d-flex gap-2 align-items-start small" style={{ background: '#fff6ee', border: '1px solid #ffd7b0' }}>
      <i className="bi bi-tools text-orange" />
      <div>
        <strong>Preview (Phase {phase}):</strong> {children}
      </div>
    </div>
  );
}
