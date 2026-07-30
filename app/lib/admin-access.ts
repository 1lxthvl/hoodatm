const adminUsernames = new Set([
  "rhoodatm",
  "1lxthvl",
]);

export function isAdminUsername(username: string | null | undefined) {
  return username ? adminUsernames.has(username.trim().replace(/^@/, "").toLowerCase()) : false;
}
