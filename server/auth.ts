import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "prodai-secret-2026-szechenyi";

// Superadmin email-ek (te vagy)
const SUPERADMIN_EMAILS = ["fekete0410@gmail.com", "demo@prodai.hu"];

export function isSuperAdmin(email: string): boolean {
  return SUPERADMIN_EMAILS.includes(email.toLowerCase());
}

export interface JwtPayload {
  userId: number;
  companyId: number;
  email: string;
  role: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Middleware: superadmin ellenőrzése
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Nincs bejelentkezve" });
  }
  const token = authHeader.slice(7);
  // Demo token elfogadása superadminnak
  if (token === "demo-token-prodai-2026") {
    (req as any).user = { userId: 1, companyId: 1, email: "demo@prodai.hu", role: "superadmin" };
    return next();
  }
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Érvénytelen token" });
  if (!isSuperAdmin(payload.email)) return res.status(403).json({ error: "Nincs jogosultságod" });
  (req as any).user = payload;
  next();
}

// Middleware: bejelentkezés ellenőrzése
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Nincs bejelentkezve" });
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Érvénytelen vagy lejárt token" });
  }
  (req as any).user = payload;
  next();
}
