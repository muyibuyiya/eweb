export type EhSite = 'e-hentai' | 'exhentai' | 'pixiv' | 'jmcomic';

export type EhCategory =
  | 'Doujinshi'
  | 'Manga'
  | 'Artist CG'
  | 'Game CG'
  | 'Western'
  | 'Non-H'
  | 'Image Set'
  | 'Cosplay'
  | 'Asian Porn'
  | 'Misc'
  | 'Pixiv'
  | 'JMComic';

export interface CategoryInfo {
  name: EhCategory;
  labelZh: string;
  bit: number;
  color: string;
  bgClass: string;
}

export const EH_CATEGORIES: CategoryInfo[] = [
  { name: 'Doujinshi', labelZh: '同人志', bit: 2, color: '#F44336', bgClass: 'bg-red-500' },
  { name: 'Manga', labelZh: '漫画', bit: 4, color: '#FF9800', bgClass: 'bg-orange-500' },
  { name: 'Artist CG', labelZh: '画师CG', bit: 8, color: '#FBC02D', bgClass: 'bg-yellow-500' },
  { name: 'Game CG', labelZh: '游戏CG', bit: 16, color: '#4CAF50', bgClass: 'bg-green-500' },
  { name: 'Western', labelZh: '西方', bit: 512, color: '#8BC34A', bgClass: 'bg-lime-500' },
  { name: 'Non-H', labelZh: '非H', bit: 256, color: '#2196F3', bgClass: 'bg-blue-500' },
  { name: 'Image Set', labelZh: '图集', bit: 32, color: '#3F51B5', bgClass: 'bg-indigo-500' },
  { name: 'Cosplay', labelZh: 'Cosplay', bit: 64, color: '#9C27B0', bgClass: 'bg-purple-500' },
  { name: 'Asian Porn', labelZh: '亚洲', bit: 128, color: '#E91E63', bgClass: 'bg-pink-500' },
  { name: 'Misc', labelZh: '杂项', bit: 1, color: '#9E9E9E', bgClass: 'bg-neutral-500' },
];

export const CATEGORY_COLOR_MAP: Record<string, string> = {
  ...Object.fromEntries(EH_CATEGORIES.map((c) => [c.name.toLowerCase(), c.color])),
  pixiv: '#0096FA',
  jmcomic: '#FF6B35',
};

export interface GallerySummary {
  gid: string;
  token: string;
  title: string;
  category: EhCategory;
  thumb: string;
  posted: string;
  uploader: string;
  rating: number;
  pages: number;
  tags: string[];
  language?: string;
  site?: EhSite;
}

export interface GalleryListResponse {
  items: GallerySummary[];
  nextCursor: string | null;
  prevCursor: string | null;
  totalText?: string;
  source: EhSite | 'demo';
}

export interface TagGroup {
  namespace: string;
  tags: string[];
}

export interface GalleryPreviewPage {
  page: number;
  pageToken: string;
  thumbUrl: string;
  /** Direct full-size image URL (used by Pixiv & JMComic to skip extra page-resolve hops) */
  directImageUrl?: string;
  /** When set, reader unscrambles the JMComic image using Canvas */
  scrambleAid?: number;
  scramblePageName?: string;
  /** CSS sprite metadata when E-Hentai returns sprite sheets */
  sprite?: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface GalleryChapter {
  id: string;
  title: string;
  order: string;
}

export interface GalleryComment {
  id: string;
  author: string;
  postedAt: string;
  score: string;
  isUploader: boolean;
  html: string;
  text: string;
}

export interface GalleryDetail {
  gid: string;
  token: string;
  title: string;
  titleJpn: string;
  category: EhCategory;
  thumb: string;
  uploader: string;
  posted: string;
  parent?: string;
  visible: string;
  language: string;
  fileSize: string;
  pages: number;
  favoritedCount: number;
  rating: number;
  ratingCount: number;
  tagGroups: TagGroup[];
  previews: GalleryPreviewPage[];
  previewPageCount: number;
  currentPreviewPage: number;
  comments: GalleryComment[];
  chapters?: GalleryChapter[];
  description?: string;
  source: EhSite | 'demo';
}

export interface ReaderImageResponse {
  gid: string;
  page: number;
  pageToken: string;
  imageUrl: string;
  width?: number;
  height?: number;
  fileName?: string;
  reloadKey?: string;
  nextPageToken?: string;
  prevPageToken?: string;
  totalPages?: number;
  scrambleAid?: number;
  scramblePageName?: string;
}

export type ReadingMode = 'vertical' | 'ltr' | 'rtl';
export type ThemeMode = 'system' | 'light' | 'dark' | 'oled';
export type ViewLayout = 'grid' | 'list';

export interface AppSettings {
  site: EhSite;
  cookie: string;
  pixivCookie: string;
  jmCookie: string;
  jmDomain: string;
  proxyUrl: string;
  apiBaseUrl: string;
  demoMode: boolean;
  translateTags: boolean;
  theme: ThemeMode;
  readingMode: ReadingMode;
  viewLayout: ViewLayout;
  preloadCount: number;
  /** Custom long-press duration in ms (0 = disabled, use native Safari long-press only) */
  longPressMs: number;
  /** Automatically trigger server-side background preloading when opening E-Hentai reader */
  autoBgPreload: boolean;
}

export interface ReadingHistoryItem {
  gallery: GallerySummary;
  lastPage: number;
  totalPages: number;
  updatedAt: number;
}
