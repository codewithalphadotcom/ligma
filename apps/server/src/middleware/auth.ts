import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

export interface AuthPayload {
  userId: string;
  name: string;
  email: string;
  color: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const auth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing or malformed Authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET as string) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
};

export default auth;
