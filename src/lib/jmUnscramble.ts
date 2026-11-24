// Minimal pure-JS MD5 for JMComic deterministic strip count calculation
function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const len = bytes.length;
  const wordLen = (((len + 8) >>> 6) + 1) << 4;
  const words = new Uint32Array(wordLen);
  for (let i = 0; i < len; i++) {
    words[i >>> 2] |= bytes[i] << ((i % 4) * 8);
  }
  words[len >>> 2] |= 0x80 << ((len % 4) * 8);
  words[wordLen - 2] = (len << 3) >>> 0;
  words[wordLen - 1] = len >>> 29;

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let i = 0; i < wordLen; i += 16) {
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let j = 0; j < 64; j++) {
      let F = 0;
      let g = 0;
      if (j < 16) {
        F = (B & C) | (~B & D);
        g = j;
      } else if (j < 32) {
        F = (D & B) | (~D & C);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        F = B ^ C ^ D;
        g = (3 * j + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * j) % 16;
      }
      const sum = (F + A + K[j] + words[i + g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((sum << s[j]) | (sum >>> (32 - s[j])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const toHex = (n: number) => {
    let out = '';
    for (let i = 0; i < 4; i++) {
      out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return out;
  };
  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
}

export function getJmScramblePieces(aid: number, pageName: string): number {
  if (aid < 220980) return 0;
  if (aid < 268850) return 10;
  const hash = md5Hex(`${aid}${pageName}`);
  const lastCharCode = hash.charCodeAt(hash.length - 1);
  const mod = aid >= 421926 ? 8 : 10;
  return (lastCharCode % mod) * 2 + 2;
}

const unscrambledCache = new Map<string, string>();

export async function unscrambleJmImageUrl(
  proxiedUrl: string,
  aid: number,
  pageName: string
): Promise<string> {
  const pieces = getJmScramblePieces(aid, pageName);
  if (pieces <= 1) return proxiedUrl;

  const cacheKey = `${proxiedUrl}|${aid}|${pageName}`;
  const cached = unscrambledCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(proxiedUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return proxiedUrl;

  const remainder = height % pieces;
  const baseHeight = Math.floor(height / pieces);

  for (let i = 0; i < pieces; i++) {
    const srcH = i === 0 ? baseHeight + remainder : baseHeight;
    const srcY = height - baseHeight * (i + 1) - remainder;
    const dstY = i === 0 ? 0 : baseHeight * i + remainder;
    ctx.drawImage(bitmap, 0, srcY, width, srcH, 0, dstY, width, srcH);
  }
  bitmap.close();

  const outBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92)
  );
  if (!outBlob) return proxiedUrl;

  const objectUrl = URL.createObjectURL(outBlob);
  unscrambledCache.set(cacheKey, objectUrl);
  return objectUrl;
}
