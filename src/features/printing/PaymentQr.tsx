import { usePaymentQr } from './usePaymentQr';

/** UPI "Scan to pay" block of the customer bill: under the payment mode, above the thank-you line (inline styles: it is copied into the print iframe). Nothing is printed when no QR is set up. */
export function PaymentQr({ small = false }: { small?: boolean }) {
  const qr = usePaymentQr();
  if (!qr.data) return null;
  return (
    <div className="rcpt-payment-qr" style={{ textAlign: 'center', marginTop: 5 }}>
      <div style={{ fontSize: small ? 8.5 : 9, fontWeight: 800, color: '#000', letterSpacing: 0.3 }}>SCAN TO PAY (UPI)</div>
      <img src={qr.data} alt="UPI payment QR code" style={{ display: 'block', margin: '2px auto 0', width: small ? '44%' : '42mm', maxWidth: '80%', height: 'auto', imageRendering: 'pixelated' }} />
    </div>
  );
}
