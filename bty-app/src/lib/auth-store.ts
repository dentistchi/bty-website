/**
 * In-memory user store for demo. Replace with DB (e.g. Supabase, D1) in production.
 */

export type User = {
  id: string;
  email: string;
  passwordHash: string; // in production use proper hashing (bcrypt, etc.)
  createdAt: number;
};

const users = new Map<string, User>();

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return Array.from(users.values()).find((u) => u.email === normalized);
}

export function findUserById(id: string): User | undefined {
  return users.get(id);
}

export function createUser(
  id: string,
  email: string,
  passwordHash: string
): User {
  const user: User = {
    id,
    email: email.trim().toLowerCase(),
    passwordHash,
    createdAt: Date.now(),
  };
  users.set(id, user);
  return user;
}

export function getAllUsers(): User[] {
  return Array.from(users.values());
}

export function deleteUser(id: string): boolean {
  return users.delete(id);
}

export function updateUserPassword(id: string, newPasswordHash: string): boolean {
  const user = users.get(id);
  if (!user) return false;
  user.passwordHash = newPasswordHash;
  users.set(id, user);
  return true;
}
