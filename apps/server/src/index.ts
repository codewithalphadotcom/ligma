import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import authRoutes from '@/routes/auth.js';
import roomsRoutes from '@/routes/rooms.js';
import intentRoutes from '@/routes/intent.js';
import { handleConnection } from '@/services/yjs-server.js';
import type { AuthPayload } from '@/middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'ligma-server', ts: Date.now() });
});

app.use('/auth', authRoutes);
app.use('/rooms', roomsRoutes);
app.use('/intent', intentRoutes);

const PORT = Number(process.env.PORT ?? 8080);
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/room\/([^/]+)$/);

    if (!match) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
    }

    const roomId = match[1]!;
    const token = url.searchParams.get('token');

    // Public-room guest path: when no token is supplied, mint a per-connection
    // guest userId. The yjs-server treats `guest_*` users as contributors and
    // bypasses DB-backed RBAC so unauthenticated visitors can collaborate on
    // open rooms without first registering.
    let userId: string;
    let isGuest = false;
    if (!token) {
        userId = `guest_${Math.random().toString(36).slice(2, 10)}`;
        isGuest = true;
    } else {
        try {
            const payload = jwt.verify(token, JWT_SECRET as string) as AuthPayload;
            userId = payload.userId;
        } catch {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
    }

    const lastSeqId = url.searchParams.has('last_seq_id')
        ? Number(url.searchParams.get('last_seq_id'))
        : undefined;

    wss.handleUpgrade(req, socket, head, (ws) => {
        handleConnection(ws, roomId, userId, lastSeqId, isGuest).catch((err) => {
            console.error('[ws] handleConnection error:', err);
            ws.close();
        });
    });
});

server.listen(PORT, () => console.log(`[ligma-server] listening on :${PORT}`));
