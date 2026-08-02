const ACCESS_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const encoder = new TextEncoder();

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createAccessCode(length = 12) {
  const result: string[] = [];
  const ceiling = Math.floor(256 / ACCESS_ALPHABET.length) * ACCESS_ALPHABET.length;
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte >= ceiling) continue;
      result.push(ACCESS_ALPHABET[byte % ACCESS_ALPHABET.length]!);
      if (result.length === length) break;
    }
  }
  return result.join("");
}

export function createManagementToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
