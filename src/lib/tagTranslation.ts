import { EH_CATEGORIES, type EhCategory } from '../../shared/types';

export const NAMESPACE_ZH: Record<string, string> = {
  language: '语言',
  parody: '原作',
  character: '角色',
  group: '社团',
  artist: '画师',
  female: '女性',
  male: '男性',
  mixed: '混合',
  other: '其他',
  cosplayer: 'Coser',
  reclass: '重分类',
  misc: '杂项',
  temp: '临时',
};

const CATEGORY_ZH_MAP: Record<string, string> = Object.fromEntries(
  EH_CATEGORIES.map((c) => [c.name.toLowerCase(), c.labelZh])
);

// Built-in high-frequency Chinese tag dictionary (works immediately offline & in demo mode)
const BUILTIN_TAG_MAP: Record<string, string> = {
  // Languages
  'language:chinese': '中文',
  'language:japanese': '日语',
  'language:english': '英语',
  'language:korean': '韩语',
  'language:spanish': '西班牙语',
  'language:french': '法语',
  'language:german': '德语',
  'language:russian': '俄语',
  'language:italian': '意大利语',
  'language:portuguese': '葡萄牙语',
  'language:translated': '已翻译',
  'language:rewrite': '改图',
  'language:speechless': '无字',
  'language:text cleaned': '已嵌字清理',

  // Common Other / Format / Style
  'other:full color': '全彩',
  'other:artbook': '画集',
  'other:anthology': '合集',
  'other:tankoubon': '单行本',
  'other:webtoon': '条漫',
  'other:multi-work series': '系列作品',
  'other:story arc': '剧情连载',
  'other:uncensored': '无修正',
  'other:mosaic censorship': '马赛克修正',
  'other:decensored': '去码',
  'other:watermarked': '带水印',
  'other:sample': '试阅',
  'other:incomplete': '未完结',
  'other:non-h': '全年龄',
  'other:non-h imageset': '全年龄图集',
  'other:watercolor': '水彩',
  'other:traditional media': '手绘',
  'other:pixel art': '像素画',
  'other:3d': '3D',
  'other:cg': 'CG',
  'other:concept art': '概念设定',
  'other:photography': '摄影',
  'other:minimalism': '极简主义',
  'other:architecture': '建筑',
  'other:cyberpunk': '赛博朋克',
  'other:scenery': '风景',
  'other:sci-fi': '科幻',
  'other:monochrome': '黑白',
  'other:mecha': '机甲',
  'other:game cg': '游戏CG',
  'other:slice of life': '日常',
  'other:food': '美食',
  'other:rain': '雨景',
  'other:ai generated': 'AI生成',
  'other:out of order': '乱序',
  'other:missing cover': '缺少封面',
  'other:rough grammar': '机翻/语法粗糙',
  'other:machine translated': '机器翻译',
  'other:digital': '电子版',
  'other:variant set': '差分集',
  'other:compilation': '精选集',
  'other:doujinshi': '同人志',

  // Misc aliases (some galleries put these under misc)
  'misc:full color': '全彩',
  'misc:artbook': '画集',
  'misc:anthology': '合集',
  'misc:tankoubon': '单行本',
  'misc:non-h': '全年龄',
  'misc:watercolor': '水彩',
  'misc:traditional media': '手绘',
  'misc:cyberpunk': '赛博朋克',
  'misc:scenery': '风景',
  'misc:sci-fi': '科幻',
  'misc:monochrome': '黑白',
  'misc:mecha': '机甲',
  'misc:concept art': '概念设定',
  'misc:game cg': '游戏CG',
  'misc:slice of life': '日常',
  'misc:food': '美食',
  'misc:rain': '雨景',
  'misc:photography': '摄影',
  'misc:minimalism': '极简主义',
  'misc:architecture': '建筑',

  // Common Parodies
  'parody:original': '原创',
  'parody:touhou project': '东方Project',
  'parody:fate grand order': 'Fate/Grand Order',
  'parody:blue archive': '碧蓝档案',
  'parody:genshin impact': '原神',
  'parody:azur lane': '碧蓝航线',
  'parody:honkai star rail': '崩坏：星穹铁道',
  'parody:arknights': '明日方舟',
  'parody:kantai collection': '舰队Collection',
  'parody:hololive': 'Hololive',
  'parody:idolmaster cinderella girls': '偶像大师 灰姑娘女孩',
  'parody:pokemon': '宝可梦',
  'parody:neon genesis evangelion': '新世纪福音战士',
  'parody:princess connect': '公主连结',
  'parody:granblue fantasy': '碧蓝幻想',
  'parody:zenless zone zero': '绝区零',
  'parody:nikke': '胜利女神：妮姬',
  'parody:spy x family': '间谍过家家',
  'parody:chainsaw man': '电锯人',
  'parody:bocchi the rock': '孤独摇滚！',
  'parody:sousou no frieren': '葬送的芙莉莲',

  // Common Character / Role / Appearance tags
  'female:sole female': '单女主',
  'male:sole male': '单男主',
  'female:schoolgirl uniform': '水手服/校服',
  'female:kimono': '和服',
  'female:maid': '女仆',
  'female:glasses': '眼镜',
  'female:twintails': '双马尾',
  'female:ponytail': '马尾辫',
  'female:catgirl': '猫娘',
  'female:fox girl': '狐娘',
  'female:elf': '精灵',
  'female:stockings': '长筒袜',
  'female:pantyhose': '连裤袜',
  'female:swimsuit': '泳装',
  'female:bikini': '比基尼',
  'female:lingerie': '内衣',
  'female:bride': '新娘',
  'female:witch': '魔女',
  'female:nun': '修女',
  'female:nurse': '护士',
  'female:teacher': '老师',
  'female:chinese dress': '旗袍',
  'female:bunny girl': '兔女郎',
  'female:angel': '天使',
  'female:demon girl': '魅魔/恶魔娘',
  'female:vampire': '吸血鬼',
  'female:yuri': '百合',
  'mixed:ffm threesome': '双女一男',
  'mixed:mmf threesome': '双男一女',
  'mixed:group': '多人',
};

// Runtime merged dictionary (synced EhTagTranslation DB overrides/extends built-in)
let syncedMap: Record<string, string> = {};
let syncedMeta: { version: string; count: number; fetchedAt: number } | null = null;
const listeners = new Set<() => void>();

const IDB_NAME = 'ehweb_tag_db';
const IDB_STORE = 'kv';
const IDB_KEY = 'ehtag_zh_v1';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function initTagTranslationCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(IDB_KEY);
    req.onsuccess = () => {
      const val = req.result as
        | { version: string; count: number; fetchedAt: number; map: Record<string, string> }
        | undefined;
      if (val?.map) {
        syncedMap = val.map;
        syncedMeta = { version: val.version, count: val.count, fetchedAt: val.fetchedAt };
        listeners.forEach((fn) => fn());
      }
      resolve();
    };
    req.onerror = () => resolve();
  });
}

export async function saveTagTranslationCache(payload: {
  version: string;
  count: number;
  fetchedAt: number;
  map: Record<string, string>;
}): Promise<void> {
  syncedMap = payload.map;
  syncedMeta = {
    version: payload.version,
    count: payload.count,
    fetchedAt: payload.fetchedAt,
  };
  listeners.forEach((fn) => fn());

  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(payload, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export function getTagDbMeta() {
  return {
    builtinCount: Object.keys(BUILTIN_TAG_MAP).length,
    synced: syncedMeta,
  };
}

export function subscribeTagDb(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function translateCategory(category: EhCategory | string, enabled: boolean): string {
  if (!enabled) return category;
  return CATEGORY_ZH_MAP[category.toLowerCase()] || category;
}

export function translateNamespace(ns: string, enabled: boolean): string {
  if (!enabled) return ns;
  return NAMESPACE_ZH[ns.toLowerCase()] || ns;
}

export function translateTag(namespace: string, tag: string, enabled: boolean): string {
  if (!enabled) return tag;
  const ns = namespace.toLowerCase().trim();
  const key = `${ns}:${tag.toLowerCase().trim()}`;
  return (
    syncedMap[key] ||
    BUILTIN_TAG_MAP[key] ||
    syncedMap[`other:${tag.toLowerCase().trim()}`] ||
    BUILTIN_TAG_MAP[`other:${tag.toLowerCase().trim()}`] ||
    tag
  );
}

export function translateFullTag(rawTag: string, enabled: boolean): string {
  const idx = rawTag.indexOf(':');
  if (idx === -1) {
    return translateTag('other', rawTag, enabled);
  }
  const ns = rawTag.slice(0, idx);
  const tag = rawTag.slice(idx + 1);
  return translateTag(ns, tag, enabled);
}

export function translateLanguageLabel(lang: string | undefined, enabled: boolean): string | undefined {
  if (!lang || !enabled) return lang;
  const lower = lang.toLowerCase().trim();
  if (lower.startsWith('chinese')) return lang.includes('Translated') ? '中文（已翻译）' : '中文';
  if (lower.startsWith('japanese')) return '日语';
  if (lower.startsWith('english')) return lang.includes('Translated') ? '英语（已翻译）' : '英语';
  if (lower.startsWith('korean')) return '韩语';
  return translateTag('language', lower, true);
}
