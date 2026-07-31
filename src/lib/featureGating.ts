export function isAdvancedUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.NEXT_PUBLIC_ALLOWED_ADVANCED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}