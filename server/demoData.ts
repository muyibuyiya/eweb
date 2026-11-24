import type {
  EhCategory,
  GalleryDetail,
  GalleryListResponse,
  GallerySummary,
  ReaderImageResponse,
} from '../shared/types.js';

interface DemoGallerySeed {
  gid: string;
  token: string;
  title: string;
  titleJpn: string;
  category: EhCategory;
  uploader: string;
  posted: string;
  rating: number;
  ratingCount: number;
  pages: number;
  fileSize: string;
  language: string;
  favoritedCount: number;
  palette: [string, string, string];
  tags: { namespace: string; tags: string[] }[];
}

const DEMO_SEEDS: DemoGallerySeed[] = [
  {
    gid: '900001',
    token: 'a1b2c3d4e5',
    title: '[C106] Neon Harbor Sketchbook — Cyber Tokyo Architecture & Nightscapes [Chinese]',
    titleJpn: '(C106) ネオンハーバー・スケッチブック 深夜都市建築画集',
    category: 'Artist CG',
    uploader: 'KurokawaLab',
    posted: '2026-11-24 21:15',
    rating: 4.9,
    ratingCount: 342,
    pages: 18,
    fileSize: '42.6 MiB',
    language: 'Chinese (Translated)',
    favoritedCount: 1284,
    palette: ['#0f172a', '#3b82f6', '#ec4899'],
    tags: [
      { namespace: 'language', tags: ['chinese', 'translated'] },
      { namespace: 'artist', tags: ['kurokawa_ren'] },
      { namespace: 'misc', tags: ['full color', 'artbook', 'cyberpunk', 'scenery'] },
    ],
  },
  {
    gid: '900002',
    token: 'b2c3d4e5f6',
    title: '[Pixiv] Autumn Shrine & Lantern Festival — Watercolor Illustration Collection',
    titleJpn: '秋の神社と灯籠祭り 水彩イラスト集',
    category: 'Non-H',
    uploader: 'MomijiStudio',
    posted: '2026-11-24 18:40',
    rating: 4.8,
    ratingCount: 215,
    pages: 14,
    fileSize: '28.4 MiB',
    language: 'Japanese',
    favoritedCount: 930,
    palette: ['#451a03', '#f97316', '#fde047'],
    tags: [
      { namespace: 'language', tags: ['japanese'] },
      { namespace: 'artist', tags: ['akane_hoshino'] },
      { namespace: 'misc', tags: ['watercolor', 'traditional media', 'non-h', 'full color'] },
    ],
  },
  {
    gid: '900003',
    token: 'c3d4e5f6a7',
    title: '(COMITIA 153) Starlight Express — Short Sci-Fi Manga Anthology [Chinese]',
    titleJpn: '(コミティア153) スターライト・エクスプレス SF短編漫画集',
    category: 'Doujinshi',
    uploader: 'SoraPress',
    posted: '2026-11-24 14:22',
    rating: 4.7,
    ratingCount: 189,
    pages: 24,
    fileSize: '31.2 MiB',
    language: 'Chinese (Translated)',
    favoritedCount: 745,
    palette: ['#1e1b4b', '#818cf8', '#38bdf8'],
    tags: [
      { namespace: 'language', tags: ['chinese', 'translated'] },
      { namespace: 'group', tags: ['sora_press'] },
      { namespace: 'misc', tags: ['sci-fi', 'anthology', 'monochrome'] },
    ],
  },
  {
    gid: '900004',
    token: 'd4e5f6a7b8',
    title: 'Chrono Vanguard: Official Concept Art & Mecha Design Archive',
    titleJpn: 'クロノ・ヴァンガード 公式コンセプトアート＆メカ設定資料集',
    category: 'Game CG',
    uploader: 'MechaArchive',
    posted: '2026-11-23 23:10',
    rating: 4.6,
    ratingCount: 156,
    pages: 20,
    fileSize: '64.8 MiB',
    language: 'English',
    favoritedCount: 612,
    palette: ['#064e3b', '#10b981', '#a7f3d0'],
    tags: [
      { namespace: 'language', tags: ['english'] },
      { namespace: 'parody', tags: ['chrono_vanguard'] },
      { namespace: 'misc', tags: ['mecha', 'concept art', 'game cg', 'full color'] },
    ],
  },
  {
    gid: '900005',
    token: 'e5f6a7b8c9',
    title: 'Midnight Ramen & Rainy Alleys — Slice of Life Manga Vol. 1 [Chinese]',
    titleJpn: '真夜中のラーメンと雨の路地裏 第1巻',
    category: 'Manga',
    uploader: 'YoruScan',
    posted: '2026-11-23 19:05',
    rating: 4.9,
    ratingCount: 412,
    pages: 16,
    fileSize: '19.5 MiB',
    language: 'Chinese (Translated)',
    favoritedCount: 1520,
    palette: ['#3f1d2b', '#f43f5e', '#fbbf24'],
    tags: [
      { namespace: 'language', tags: ['chinese', 'translated'] },
      { namespace: 'artist', tags: ['takahashi_m'] },
      { namespace: 'misc', tags: ['slice of life', 'food', 'rain', 'tankoubon'] },
    ],
  },
  {
    gid: '900006',
    token: 'f6a7b8c9d0',
    title: 'Nordic Coastline & Glass Cabin — Minimalist Photography Set',
    titleJpn: '北欧の海岸線とガラスキャビン 写真集',
    category: 'Image Set',
    uploader: 'FjordLens',
    posted: '2026-11-22 11:30',
    rating: 4.5,
    ratingCount: 98,
    pages: 12,
    fileSize: '36.1 MiB',
    language: 'English',
    favoritedCount: 410,
    palette: ['#0c4a6e', '#0ea5e9', '#e0f2fe'],
    tags: [
      { namespace: 'language', tags: ['english'] },
      { namespace: 'misc', tags: ['photography', 'minimalism', 'architecture', 'non-h'] },
    ],
  },
];

export function getDemoGalleryList(query?: string, fCats?: number): GalleryListResponse {
  let list = DEMO_SEEDS;
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter((item) => {
      const flatTags = item.tags.flatMap((g) => g.tags.map((t) => `${g.namespace}:${t}`.toLowerCase()));
      return (
        item.title.toLowerCase().includes(q) ||
        item.titleJpn.toLowerCase().includes(q) ||
        item.uploader.toLowerCase().includes(q) ||
        flatTags.some((t) => t.includes(q))
      );
    });
  }

  if (typeof fCats === 'number' && fCats > 0) {
    const catBitMap: Record<EhCategory, number> = {
      Misc: 1,
      Doujinshi: 2,
      Manga: 4,
      'Artist CG': 8,
      'Game CG': 16,
      'Image Set': 32,
      Cosplay: 64,
      'Asian Porn': 128,
      'Non-H': 256,
      Western: 512,
      Pixiv: 0,
      JMComic: 0,
    };
    list = list.filter((item) => (fCats & catBitMap[item.category]) === 0);
  }

  const items: GallerySummary[] = list.map((seed) => ({
    gid: seed.gid,
    token: seed.token,
    title: seed.title,
    category: seed.category,
    thumb: `/api/demo-image/${seed.gid}/0`,
    posted: seed.posted,
    uploader: seed.uploader,
    rating: seed.rating,
    pages: seed.pages,
    tags: seed.tags.flatMap((g) => g.tags.map((t) => `${g.namespace}:${t}`)),
    language: seed.language.split(' ')[0].toLowerCase(),
  }));

  return {
    items,
    nextCursor: null,
    prevCursor: null,
    totalText: `演示模式 · 共 ${items.length} 个画廊`,
    source: 'demo',
  };
}

export function getDemoGalleryDetail(gid: string): GalleryDetail | null {
  const seed = DEMO_SEEDS.find((s) => s.gid === gid) || DEMO_SEEDS[0];
  if (!seed) return null;

  const previews = Array.from({ length: seed.pages }, (_, i) => ({
    page: i + 1,
    pageToken: `demo${seed.gid}p${i + 1}`,
    thumbUrl: `/api/demo-image/${seed.gid}/${i + 1}`,
  }));

  return {
    gid: seed.gid,
    token: seed.token,
    title: seed.title,
    titleJpn: seed.titleJpn,
    category: seed.category,
    thumb: `/api/demo-image/${seed.gid}/0`,
    uploader: seed.uploader,
    posted: seed.posted,
    visible: 'Yes',
    language: seed.language,
    fileSize: seed.fileSize,
    pages: seed.pages,
    favoritedCount: seed.favoritedCount,
    rating: seed.rating,
    ratingCount: seed.ratingCount,
    tagGroups: seed.tags,
    previews,
    previewPageCount: 1,
    currentPreviewPage: 0,
    comments: [
      {
        id: 'demo-c1',
        author: seed.uploader,
        postedAt: seed.posted,
        score: '+42',
        isUploader: true,
        html: '欢迎体验 EhWeb iOS 现代化阅读器！关闭设置中的「演示模式」即可连接真实 E-Hentai / ExHentai 站点。',
        text: '欢迎体验 EhWeb iOS 现代化阅读器！关闭设置中的「演示模式」即可连接真实 E-Hentai / ExHentai 站点。',
      },
      {
        id: 'demo-c2',
        author: 'iOSReaderFan',
        postedAt: '2026-11-24 22:05',
        score: '+18',
        isUploader: false,
        html: '竖屏条漫模式和双指/点击翻页在 iPhone Safari 全屏 PWA 下非常流畅！',
        text: '竖屏条漫模式和双指/点击翻页在 iPhone Safari 全屏 PWA 下非常流畅！',
      },
    ],
    source: 'demo',
  };
}

export function getDemoReaderPage(gid: string, page: number): ReaderImageResponse {
  const seed = DEMO_SEEDS.find((s) => s.gid === gid) || DEMO_SEEDS[0];
  const clamped = Math.max(1, Math.min(seed.pages, page));
  return {
    gid: seed.gid,
    page: clamped,
    pageToken: `demo${seed.gid}p${clamped}`,
    imageUrl: `/api/demo-image/${seed.gid}/${clamped}`,
    width: 900,
    height: 1350,
    fileName: `page_${String(clamped).padStart(3, '0')}.svg`,
    nextPageToken: clamped < seed.pages ? `demo${seed.gid}p${clamped + 1}` : undefined,
    prevPageToken: clamped > 1 ? `demo${seed.gid}p${clamped - 1}` : undefined,
    totalPages: seed.pages,
  };
}

export function renderDemoSvg(gid: string, pageNum: number): string {
  const seed = DEMO_SEEDS.find((s) => s.gid === gid) || DEMO_SEEDS[0];
  const [c1, c2, c3] = seed.palette;
  const isCover = pageNum === 0;
  const label = isCover ? 'COVER' : `PAGE ${String(pageNum).padStart(2, '0')} / ${seed.pages}`;
  const angle = (pageNum * 27) % 360;
  const cx1 = 220 + ((pageNum * 83) % 460);
  const cy1 = 300 + ((pageNum * 113) % 620);
  const cx2 = 180 + ((pageNum * 137) % 520);
  const cy2 = 500 + ((pageNum * 71) % 600);
  const escapedTitle = seed.title
    .slice(0, 48)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1350" width="900" height="1350">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="55%" stop-color="${c2}" />
      <stop offset="100%" stop-color="${c3}" />
    </linearGradient>
    <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="900" height="1350" fill="url(#bg)" />
  <circle cx="${cx1}" cy="${cy1}" r="320" fill="url(#glow1)" />
  <circle cx="${cx2}" cy="${cy2}" r="240" fill="${c3}" fill-opacity="0.22" />
  <rect x="54" y="54" width="792" height="1242" rx="36" fill="rgba(15,23,42,0.28)" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
  <rect x="96" y="108" width="240" height="52" rx="26" fill="rgba(255,255,255,0.18)" />
  <text x="216" y="142" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="24" font-weight="700" text-anchor="middle">${seed.category.toUpperCase()}</text>
  <text x="450" y="610" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="82" font-weight="800" text-anchor="middle" opacity="0.95">${label}</text>
  <text x="450" y="690" fill="rgba(255,255,255,0.88)" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="28" font-weight="500" text-anchor="middle">${escapedTitle}</text>
  <text x="450" y="1180" fill="rgba(255,255,255,0.65)" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="22" text-anchor="middle">EhWeb Demo Artwork · Swipe or Tap to Read</text>
</svg>`;
}
