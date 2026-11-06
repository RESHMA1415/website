import { useEffect, useState } from 'react';

// 6-digit SMS code entry with a resend countdown. `sent` is the server's answer
// to /auth/otp/request ({ mobile, resendInSeconds, devOtp? }).
export default function OtpStep({ id = 'otp-code', sent, code, onCode, onResend, onChangeNumber, busy }) {
  const [seconds, setSeconds] = useState(sent?.resendInSeconds ?? 30);

  // Restart the countdown whenever a new code is sent
  useEffect(() => {
    setSeconds(sent?.resendInSeconds ?? 30);
  }, [sent]);
  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <div className="otp-step">
      <div className="small text-muted mb-2">
        We sent a 6-digit code by SMS to <strong className="text-navy">{sent?.mobile}</strong>. It is valid for 5 minutes.
        {onChangeNumber && (
          <>
            {' '}
            <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onChangeNumber}>Change number</button>
          </>
        )}
      </div>
      {sent?.devOtp && (
        // Development only: no SMS gateway is fully set up yet, so the code is shown here
        <div className="alert alert-warning small py-2">
          <strong>Testing mode:</strong> SMS isn’t connected yet, so here is the code the customer would receive: <strong className="otp-dev">{sent.devOtp}</strong>
        </div>
      )}
      <label className="form-label" htmlFor={id}>Enter the code</label>
      <input
        id={id}
        className="form-control otp-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(e) => onCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        title="The 6-digit code from the SMS"
        autoFocus
      />
      <div className="d-flex justify-content-between align-items-center small mt-2">
        <span className="text-muted">Didn’t get it?</span>
        {seconds > 0 ? (
          <span className="text-muted" aria-live="polite">Resend code in 0:{String(seconds).padStart(2, '0')}</span>
        ) : (
          <button type="button" className="btn btn-link btn-sm p-0" onClick={onResend} disabled={busy}>Resend code</button>
        )}
      </div>
    </div>
  );
}
