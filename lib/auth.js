import { SignJWT, jwtVerify } from 'jose';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined. Halting for security.');
  }
  return new TextEncoder().encode(secret);
};



export async function signUserToken(userId, email) {
  const secret = getJwtSecret();
  return new SignJWT({ userId, email, role: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyUserToken(token) {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'user') return null;
    return payload;
  } catch (error) {
    return null;
  }
}

// Convenience: resolve the authenticated user id from a request's session cookie.
export async function getSessionUserId(request) {
  const token = request.cookies.get('bezar_user_session')?.value;
  if (!token) return null;
  const payload = await verifyUserToken(token);
  return payload?.userId || null;
}

export async function signAdminToken() {
  const secret = getJwtSecret();
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

export async function verifyAdminToken(token) {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'admin') return null;
    return payload;
  } catch (error) {
    return null;
  }
}

export async function signCmsToken(username) {
  const secret = getJwtSecret();
  return new SignJWT({ role: 'cms', username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

export async function verifyCmsToken(token) {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'cms') return null;
    return payload;
  } catch (error) {
    return null;
  }
}
