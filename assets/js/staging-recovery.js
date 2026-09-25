// Pure policy helpers. Neither function makes a write or requests a Firebase token.
export function canRecoverProfile(account, emailVerified) {
  return !!account && !!emailVerified && !account.username;
}
export function recoveryPayload(username, bio, confirmed) {
  const name = String(username ?? '').trim();
  const description = String(bio ?? '');
  if (confirmed !== true) throw new Error('consent_required');
  if (!/^[A-Za-z0-9_.-]{2,30}$/.test(name)) throw new Error('invalid_username');
  if (description.length > 500) throw new Error('invalid_bio');
  return { username: name, bio: description };
}
