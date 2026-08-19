export const ADMIN_EMAIL =
  'poshocreative@gmail.com';

export function isAdminEmail(
  email,
) {
  return (
    email
      ?.trim()
      ?.toLowerCase() ===
    ADMIN_EMAIL
  );
}