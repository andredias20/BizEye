import { createHmac, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getAdminBootstrapEnv,
  getDatabaseDriver,
  getOptionalServerEnv,
  requireAdminEnv,
} from '../config/env.js';
import { getPostgresPool } from '../lib/postgres.js';
import { createSupabaseAdminClient } from '../lib/supabase.js';

const BCRYPT_COST = 12;
const DUMMY_PASSWORD_HASH = '$2b$12$.uEuMAajQBCOxMgaKMoX0.iU8ZtKmSW4PN6g33HM2GMJzMtmBzFxy';

export type AdminUserRow = {
  disabled_at: string | null;
  display_name: string | null;
  email: string;
  id: string;
  password_hash: string;
};

export type AdminSessionRow = {
  admin_user_id: string;
  expires_at: string;
  id: string;
  revoked_at: string | null;
};

export type AdminUser = {
  displayName?: string;
  email: string;
  id: string;
};

type CreateAdminUserInput = {
  displayName?: string;
  email: string;
  passwordHash: string;
};

type CreateSessionInput = {
  adminUserId: string;
  expiresAt: Date;
  ipHash?: string;
  tokenHash: string;
  userAgent?: string;
};

type AdminAuthStore = {
  createAdminUser: (input: CreateAdminUserInput) => Promise<AdminUserRow>;
  createSession: (input: CreateSessionInput) => Promise<void>;
  findActiveSessionByTokenHash: (tokenHash: string, now: Date) => Promise<AdminSessionRow | null>;
  findAdminByEmail: (email: string) => Promise<AdminUserRow | null>;
  findAdminById: (id: string) => Promise<AdminUserRow | null>;
  revokeSessionByTokenHash: (tokenHash: string) => Promise<void>;
};

export const normalizeAdminEmail = (email: string) => email.trim().toLowerCase();

export const toAdminUser = (row: AdminUserRow): AdminUser => ({
  displayName: row.display_name?.trim() || undefined,
  email: row.email,
  id: row.id,
});

export const hashAdminPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

export const verifyAdminPassword = (password: string, passwordHash: string) => bcrypt.compare(password, passwordHash);

const hashWithAdminSecret = (value: string, purpose: string) => {
  const { ADMIN_SESSION_SECRET } = requireAdminEnv();

  return createHmac('sha256', ADMIN_SESSION_SECRET).update(`${purpose}:${value}`).digest('hex');
};

export const hashSessionToken = (token: string) => hashWithAdminSecret(token, 'admin-session');

export const hashIpAddress = (ipAddress: string | undefined) => {
  const value = ipAddress?.trim();
  return value ? hashWithAdminSecret(value, 'admin-ip') : undefined;
};

const createRawSessionToken = () => randomBytes(32).toString('base64url');

const createSupabaseAdminAuthStore = (client: SupabaseClient): AdminAuthStore => ({
  createAdminUser: async (input) => {
    const { data, error } = await client
      .from('admin_users')
      .insert({
        display_name: input.displayName ?? null,
        email: input.email,
        password_hash: input.passwordHash,
      })
      .select('id, email, password_hash, display_name, disabled_at')
      .single();

    if (error) throw new Error(`Failed to create admin user: ${error.message}`);
    return data as AdminUserRow;
  },
  createSession: async (input) => {
    const { error } = await client.from('admin_sessions').insert({
      admin_user_id: input.adminUserId,
      expires_at: input.expiresAt.toISOString(),
      ip_hash: input.ipHash ?? null,
      token_hash: input.tokenHash,
      user_agent: input.userAgent ?? null,
    });

    if (error) throw new Error(`Failed to create admin session: ${error.message}`);
  },
  findActiveSessionByTokenHash: async (tokenHash, now) => {
    const { data, error } = await client
      .from('admin_sessions')
      .select('id, admin_user_id, expires_at, revoked_at')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', now.toISOString())
      .maybeSingle();

    if (error) throw new Error(`Failed to read admin session: ${error.message}`);
    return (data as AdminSessionRow | null) ?? null;
  },
  findAdminByEmail: async (email) => {
    const { data, error } = await client
      .from('admin_users')
      .select('id, email, password_hash, display_name, disabled_at')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new Error(`Failed to read admin user: ${error.message}`);
    return (data as AdminUserRow | null) ?? null;
  },
  findAdminById: async (id) => {
    const { data, error } = await client
      .from('admin_users')
      .select('id, email, password_hash, display_name, disabled_at')
      .eq('id', id)
      .is('disabled_at', null)
      .maybeSingle();

    if (error) throw new Error(`Failed to read admin user: ${error.message}`);
    return (data as AdminUserRow | null) ?? null;
  },
  revokeSessionByTokenHash: async (tokenHash) => {
    const { error } = await client
      .from('admin_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .is('revoked_at', null);

    if (error) throw new Error(`Failed to revoke admin session: ${error.message}`);
  },
});

const createPostgresAdminAuthStore = (): AdminAuthStore => {
  const pool = getPostgresPool();

  return {
    createAdminUser: async (input) => {
      const result = await pool.query(
        `
          insert into public.admin_users (email, password_hash, display_name)
          values ($1, $2, $3)
          returning id, email::text as email, password_hash, display_name, disabled_at
        `,
        [input.email, input.passwordHash, input.displayName ?? null],
      );

      return result.rows[0] as AdminUserRow;
    },
    createSession: async (input) => {
      await pool.query(
        `
          insert into public.admin_sessions (admin_user_id, token_hash, user_agent, ip_hash, expires_at)
          values ($1, $2, $3, $4, $5)
        `,
        [
          input.adminUserId,
          input.tokenHash,
          input.userAgent ?? null,
          input.ipHash ?? null,
          input.expiresAt.toISOString(),
        ],
      );
    },
    findActiveSessionByTokenHash: async (tokenHash, now) => {
      const result = await pool.query(
        `
          select id, admin_user_id, expires_at, revoked_at
          from public.admin_sessions
          where token_hash = $1
            and revoked_at is null
            and expires_at > $2
          limit 1
        `,
        [tokenHash, now.toISOString()],
      );

      return (result.rows[0] as AdminSessionRow | undefined) ?? null;
    },
    findAdminByEmail: async (email) => {
      const result = await pool.query(
        `
          select id, email::text as email, password_hash, display_name, disabled_at
          from public.admin_users
          where email = $1
          limit 1
        `,
        [email],
      );

      return (result.rows[0] as AdminUserRow | undefined) ?? null;
    },
    findAdminById: async (id) => {
      const result = await pool.query(
        `
          select id, email::text as email, password_hash, display_name, disabled_at
          from public.admin_users
          where id = $1
            and disabled_at is null
          limit 1
        `,
        [id],
      );

      return (result.rows[0] as AdminUserRow | undefined) ?? null;
    },
    revokeSessionByTokenHash: async (tokenHash) => {
      await pool.query(
        `
          update public.admin_sessions
          set revoked_at = now()
          where token_hash = $1
            and revoked_at is null
        `,
        [tokenHash],
      );
    },
  };
};

export const createAdminAuthStore = () => {
  if (getDatabaseDriver() === 'postgres') {
    return createPostgresAdminAuthStore();
  }

  return createSupabaseAdminAuthStore(createSupabaseAdminClient());
};

const ensureBootstrapAdmin = async (store: AdminAuthStore, email: string) => {
  const bootstrapEnv = getAdminBootstrapEnv();
  if (!bootstrapEnv || normalizeAdminEmail(bootstrapEnv.ADMIN_BOOTSTRAP_EMAIL) !== email) {
    return null;
  }

  const existing = await store.findAdminByEmail(email);
  if (existing) return existing;

  const passwordHash = await hashAdminPassword(bootstrapEnv.ADMIN_BOOTSTRAP_PASSWORD);

  try {
    return await store.createAdminUser({
      displayName: 'Admin',
      email,
      passwordHash,
    });
  } catch {
    return store.findAdminByEmail(email);
  }
};

export const authenticateAdmin = async (emailInput: string, password: string) => {
  const store = createAdminAuthStore();
  const email = normalizeAdminEmail(emailInput);
  const row = (await store.findAdminByEmail(email)) ?? (await ensureBootstrapAdmin(store, email));
  const passwordHash = row?.password_hash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await verifyAdminPassword(password, passwordHash);

  if (!row || row.disabled_at || !passwordMatches) {
    return null;
  }

  return toAdminUser(row);
};

export const createAdminSession = async (adminUserId: string, userAgent?: string, ipAddress?: string) => {
  const store = createAdminAuthStore();
  const { ADMIN_SESSION_TTL_HOURS } = getOptionalServerEnv();
  const token = createRawSessionToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000);

  await store.createSession({
    adminUserId,
    expiresAt,
    ipHash: hashIpAddress(ipAddress),
    tokenHash: hashSessionToken(token),
    userAgent,
  });

  return {
    expiresAt,
    token,
  };
};

export const getAdminBySessionToken = async (token: string | undefined) => {
  if (!token) return null;

  const store = createAdminAuthStore();
  const session = await store.findActiveSessionByTokenHash(hashSessionToken(token), new Date());
  if (!session) return null;

  const admin = await store.findAdminById(session.admin_user_id);
  return admin ? toAdminUser(admin) : null;
};

export const revokeAdminSession = async (token: string | undefined) => {
  if (!token) return;

  const store = createAdminAuthStore();
  await store.revokeSessionByTokenHash(hashSessionToken(token));
};
