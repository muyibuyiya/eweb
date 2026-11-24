import type { EhSite } from '../../shared/types.js';

export async function ehAddFavorite(
  site: EhSite,
  gid: string,
  token: string,
  cookie: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; message: string }> {
  if (!cookie?.trim() || !cookie.includes('ipb_member_id')) {
    throw new Error('请先导入 E-Hentai 的登录 Cookie（ipb_member_id 与 ipb_pass_hash）');
  }
  const base = site === 'exhentai' ? 'https://exhentai.org' : 'https://e-hentai.org';
  const url = `${base}/gallerypopups.php?gid=${gid}&t=${token}&act=addfav`;

  const body = new URLSearchParams({
    favcat: '0',
    favnote: '',
    apply: 'Add to Favorites',
    update: '1',
  });

  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie.includes('nw=1') ? cookie : `nw=1; ${cookie}`,
      Referer: url,
      Origin: base,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`E-Hentai 官方收藏失败 (HTTP ${res.status})`);
  }
  return { ok: true, message: '已同步收藏到你的 E-Hentai 账号（收藏夹 0）！' };
}
