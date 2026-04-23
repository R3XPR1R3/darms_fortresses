import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { upsertUser, getUserById, type UserRow } from "./db.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface JwtPayload {
  userId: number;
  nickname: string;
}

/** Verify Google id_token and create/update user in DB. Returns JWT. */
export async function loginWithGoogle(idToken: string): Promise<{
  token: string;
  user: { id: number; nickname: string; email: string | null; avatarUrl: string | null; gold: number; diamonds: number };
}> {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error("Invalid Google token");
  }

  const user = await upsertUser(
    payload.sub,
    payload.email ?? null,
    payload.name ?? null,
    payload.picture ?? null,
  );

  const token = jwt.sign(
    { userId: user.id, nickname: user.nickname } satisfies JwtPayload,
    JWT_SECRET,
    { expiresIn: "30d" },
  );

  return {
    token,
    user: {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      avatarUrl: user.avatar_url,
      gold: user.gold,
      diamonds: user.diamonds,
    },
  };
}

/** Verify JWT and return user data */
export async function verifyToken(token: string): Promise<UserRow | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return getUserById(decoded.userId);
  } catch {
    return null;
  }
}
