// Minimal ambient types for the `qrcode` package (we only use SVG string output).
declare module 'qrcode' {
  interface QRCodeToStringOptions {
    type?: 'svg' | 'utf8' | 'terminal';
    margin?: number;
    width?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    color?: { dark?: string; light?: string };
  }
  const QRCode: {
    toString(text: string, options?: QRCodeToStringOptions): Promise<string>;
  };
  export default QRCode;
}
