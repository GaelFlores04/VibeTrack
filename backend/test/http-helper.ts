import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
export function httpRequest(app: any) {
  return (path: string, method = 'GET', body?: any, cookie?: string, extraHeaders: any = {}): Promise<Response> => new Promise((resolve, reject) => {
    const bytes: Buffer[] = [];
    const socket = new Duplex({ read() {}, write(chunk, _encoding, done) { bytes.push(Buffer.from(chunk)); done(); } });
    const req = new IncomingMessage(socket as any);
    const text = body ? JSON.stringify(body) : '';
    req.method = method; req.url = path;
    req.headers = Object.fromEntries(Object.entries({ 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(text)), 'X-VibeTrack': '1', ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders }).map(([key, value]) => [key.toLowerCase(), value as string]));
    let sent = false;
    req._read = () => { if (!sent) { sent = true; if (text) req.push(Buffer.from(text)); req.push(null); } };
    const res = new ServerResponse(req);
    res.on('error', reject);
    res.write = ((chunk: any) => { bytes.push(Buffer.from(chunk)); return true; }) as any;
    res.end = ((chunk: any) => {
      if (chunk) bytes.push(Buffer.from(chunk));
      const bodyText = Buffer.concat(bytes);
      const headers = new Headers();
      for (const [key, value] of Object.entries(res.getHeaders())) for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) headers.append(key, String(item));
      resolve(new Response(bodyText, { status: res.statusCode, headers })); socket.destroy();
      return res;
    }) as any;
    app.getHttpAdapter().getInstance().handle(req, res);
  });
}
