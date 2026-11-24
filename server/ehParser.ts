import * as cheerio from 'cheerio';
import type {
  EhCategory,
  EhSite,
  GalleryComment,
  GalleryDetail,
  GalleryListResponse,
  GalleryPreviewPage,
  GallerySummary,
  ReaderImageResponse,
  TagGroup,
} from '../shared/types.js';

const VALID_CATEGORIES = new Set<EhCategory>([
  'Doujinshi',
  'Manga',
  'Artist CG',
  'Game CG',
  'Western',
  'Non-H',
  'Image Set',
  'Cosplay',
  'Asian Porn',
  'Misc',
]);

function normalizeCategory(raw: string): EhCategory {
  const cleaned = raw.trim();
  for (const cat of VALID_CATEGORIES) {
    if (cat.toLowerCase() === cleaned.toLowerCase()) return cat;
  }
  return 'Misc';
}

function parseRatingFromStyle(style?: string): number {
  if (!style) return 0;
  // E-Hentai rating sprite: background-position: -Xpx -Ypx
  // X is 0, -16, -32, -48, -64, -80 (each -16px subtracts 1 star from 5)
  // Y is -1px (full) or -21px (half star, subtracts 0.5)
  const match = style.match(/background-position:\s*(-?\d+)px\s+(-?\d+)px/i);
  if (!match) return 0;
  const x = parseInt(match[1], 10);
  const y = parseInt(match[2], 10);
  let rating = 5 + x / 16;
  if (y <= -20) {
    rating -= 0.5;
  }
  return Math.max(0, Math.min(5, Math.round(rating * 10) / 10));
}

function parseGalleryUrl(href?: string): { gid: string; token: string } | null {
  if (!href) return null;
  const match = href.match(/\/g\/(\d+)\/([a-f0-9]+)\/?/i);
  if (!match) return null;
  return { gid: match[1], token: match[2] };
}

function extractLanguageFromTags(tags: string[]): string | undefined {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('language:') && lower !== 'language:translated' && lower !== 'language:rewrite') {
      return tag.slice('language:'.length);
    }
  }
  return undefined;
}

export function parseGalleryListHtml(html: string, site: EhSite): GalleryListResponse {
  const $ = cheerio.load(html);
  const items: GallerySummary[] = [];

  // Compact / Minimal / Extended table rows (.itg.gltc tr, .itg.gltm tr, .itg.glte tr)
  const tableRows = $('table.itg tr').toArray();
  for (const row of tableRows) {
    const $row = $(row);
    const linkHref =
      $row.find('.glname a').attr('href') ||
      $row.find('.gl3c a').attr('href') ||
      $row.find('.gl3m a').attr('href') ||
      $row.find('.gl1e a').attr('href');
    const parsed = parseGalleryUrl(linkHref);
    if (!parsed) continue;

    const title =
      $row.find('.glink').first().text().trim() ||
      $row.find('.glname a').first().text().trim() ||
      'Untitled Gallery';

    const categoryRaw =
      $row.find('.cn').first().text().trim() ||
      $row.find('.cs').first().text().trim() ||
      'Misc';

    const $img = $row.find('.glthumb img, .gl1e img').first();
    const thumb = $img.attr('data-src') || $img.attr('src') || '';

    const posted =
      $row.find('[id^="posted_"]').first().text().trim() ||
      $row.find('.gl2c > div:nth-child(3) > div:first-child').text().trim() ||
      '';

    const ratingStyle = $row.find('.ir').first().attr('style');
    const rating = parseRatingFromStyle(ratingStyle);

    const uploader =
      $row.find('.gl4c a').first().text().trim() ||
      $row.find('.gl4m a').first().text().trim() ||
      $row.find('.gl3e a').first().text().trim() ||
      'Anonymous';

    const pagesText =
      $row.find('.gl4c > div:last-child').text().trim() ||
      $row.find('.gl3e > div:nth-child(5)').text().trim() ||
      $row.text();
    const pagesMatch = pagesText.match(/(\d+)\s*pages?/i);
    const pages = pagesMatch ? parseInt(pagesMatch[1], 10) : 0;

    const tags: string[] = [];
    $row.find('.gt, .gtl').each((_, el) => {
      const t = $(el).attr('title') || $(el).text().trim();
      if (t) tags.push(t);
    });

    items.push({
      gid: parsed.gid,
      token: parsed.token,
      title,
      category: normalizeCategory(categoryRaw),
      thumb,
      posted,
      uploader,
      rating,
      pages,
      tags,
      language: extractLanguageFromTags(tags),
    });
  }

  // Fallback for Thumbnail view (.itg.gld .gl1t)
  if (items.length === 0) {
    $('.itg.gld .gl1t').each((_, el) => {
      const $card = $(el);
      const href = $card.find('a').first().attr('href');
      const parsed = parseGalleryUrl(href);
      if (!parsed) return;

      const title = $card.find('.glink').first().text().trim() || 'Untitled Gallery';
      const categoryRaw = $card.find('.cs').first().text().trim() || 'Misc';
      const $img = $card.find('.gl3t img').first();
      const thumb = $img.attr('data-src') || $img.attr('src') || '';
      const posted = $card.find('[id^="posted_"]').first().text().trim();
      const rating = parseRatingFromStyle($card.find('.ir').first().attr('style'));
      const pagesText = $card.find('.gl5t').text();
      const pagesMatch = pagesText.match(/(\d+)\s*pages?/i);
      const pages = pagesMatch ? parseInt(pagesMatch[1], 10) : 0;

      const tags: string[] = [];
      $card.find('.gt, .gtl').each((__, tagEl) => {
        const t = $(tagEl).attr('title') || $(tagEl).text().trim();
        if (t) tags.push(t);
      });

      items.push({
        gid: parsed.gid,
        token: parsed.token,
        title,
        category: normalizeCategory(categoryRaw),
        thumb,
        posted,
        uploader: 'Unknown',
        rating,
        pages,
        tags,
        language: extractLanguageFromTags(tags),
      });
    });
  }

  const nextHref = $('#dnext').attr('href') || $('#unext').attr('href') || '';
  const prevHref = $('#dprev').attr('href') || $('#uprev').attr('href') || '';
  const nextMatch = nextHref.match(/[?&]next=([^&]+)/);
  const prevMatch = prevHref.match(/[?&]prev=([^&]+)/);
  const totalText = $('.searchtext p').first().text().trim() || undefined;

  return {
    items,
    nextCursor: nextMatch ? decodeURIComponent(nextMatch[1]) : null,
    prevCursor: prevMatch ? decodeURIComponent(prevMatch[1]) : null,
    totalText,
    source: site,
  };
}

export function parseGalleryDetailHtml(
  html: string,
  gid: string,
  token: string,
  currentPreviewPage: number,
  site: EhSite
): GalleryDetail {
  const $ = cheerio.load(html);

  const title = $('#gn').text().trim() || 'Untitled Gallery';
  const titleJpn = $('#gj').text().trim() || '';
  const categoryRaw = $('#gdc .cs').text().trim() || $('#gdc').text().trim() || 'Misc';

  // Cover thumbnail from #gd1 > div style="... url(...) ..."
  let thumb = '';
  const gd1Style = $('#gd1 > div').attr('style') || '';
  const thumbMatch = gd1Style.match(/url\((['"]?)(.*?)\1\)/i);
  if (thumbMatch) {
    thumb = thumbMatch[2];
  } else {
    thumb = $('#gd1 img').attr('src') || '';
  }

  const uploader = $('#gdn a').first().text().trim() || $('#gdn').text().trim() || 'Anonymous';

  const metaMap = new Map<string, string>();
  $('#gdd tr').each((_, tr) => {
    const key = $(tr).find('.gdt1').text().replace(':', '').trim().toLowerCase();
    const val = $(tr).find('.gdt2').text().trim();
    if (key) metaMap.set(key, val);
  });

  const posted = metaMap.get('posted') || '';
  const parent = metaMap.get('parent') !== 'None' ? metaMap.get('parent') : undefined;
  const visible = metaMap.get('visible') || 'Yes';
  const language = (metaMap.get('language') || 'Unknown').replace(/\s+TR$/i, ' (Translated)');
  const fileSize = metaMap.get('file size') || '';
  const lengthRaw = metaMap.get('length') || '0';
  const pagesMatch = lengthRaw.match(/(\d+)/);
  const pages = pagesMatch ? parseInt(pagesMatch[1], 10) : 0;

  const favRaw = metaMap.get('favorited') || '0';
  const favMatch = favRaw.match(/(\d+)/);
  const favoritedCount = favMatch ? parseInt(favMatch[1], 10) : 0;

  const ratingText = $('#rating_label').text().trim();
  const ratingMatch = ratingText.match(/([\d.]+)/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
  const ratingCount = parseInt($('#rating_count').text().trim() || '0', 10) || 0;

  // Tags grouped by namespace
  const tagGroups: TagGroup[] = [];
  $('#taglist tr').each((_, tr) => {
    const ns = $(tr).find('td.tc').text().replace(':', '').trim() || 'misc';
    const tags: string[] = [];
    $(tr)
      .find('td:nth-child(2) a')
      .each((__, a) => {
        const t = $(a).text().trim();
        if (t) tags.push(t);
      });
    if (tags.length > 0) {
      tagGroups.push({ namespace: ns, tags });
    }
  });

  // Preview thumbnails (#gdt)
  const previews: GalleryPreviewPage[] = [];
  $('#gdt a').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const pageMatch = href.match(/\/s\/([a-f0-9]+)\/\d+-(\d+)/i);
    if (!pageMatch) return;
    const pageToken = pageMatch[1];
    const page = parseInt(pageMatch[2], 10);

    // Case 1: direct <img> inside
    const $img = $a.find('img').first();
    if ($img.length > 0 && $img.attr('src') && !$img.attr('src')?.includes('blank.gif')) {
      previews.push({
        page,
        pageToken,
        thumbUrl: $img.attr('src') || '',
      });
      return;
    }

    // Case 2: CSS sprite div (new E-Hentai normal/large thumbnails)
    const styledDiv = $a.find('div[style*="background"]').first();
    const style = styledDiv.attr('style') || $a.parent().attr('style') || '';
    const bgMatch = style.match(/url\((['"]?)(.*?)\1\)/i);
    const widthMatch = style.match(/width:\s*(\d+)px/i);
    const heightMatch = style.match(/height:\s*(\d+)px/i);
    const posMatch = style.match(/url\([^)]+\)\s*(-?\d+)px\s+(-?\d+)px/i);

    previews.push({
      page,
      pageToken,
      thumbUrl: bgMatch ? bgMatch[2] : '',
      sprite:
        bgMatch && widthMatch && heightMatch
          ? {
              width: parseInt(widthMatch[1], 10),
              height: parseInt(heightMatch[1], 10),
              offsetX: posMatch ? parseInt(posMatch[1], 10) : 0,
              offsetY: posMatch ? parseInt(posMatch[2], 10) : 0,
            }
          : undefined,
    });
  });

  // Preview page count from .ptt pagination table
  let previewPageCount = 1;
  $('.ptt td a').each((_, a) => {
    const num = parseInt($(a).text().trim(), 10);
    if (!Number.isNaN(num) && num > previewPageCount) {
      previewPageCount = num;
    }
  });

  // Comments (#cdiv .c1)
  const comments: GalleryComment[] = [];
  $('#cdiv .c1').each((idx, el) => {
    const $c = $(el);
    const author = $c.find('.c3 a').first().text().trim() || 'Anonymous';
    const postedRaw = $c.find('.c3').text().trim();
    const postedMatch = postedRaw.match(/Posted on\s+(.+?)\s+by:/i);
    const postedAt = postedMatch ? postedMatch[1].trim() : postedRaw;
    const score = $c.find('.c5 span').first().text().trim() || '0';
    const isUploader = $c.find('.c4').text().includes('Uploader Comment');
    const $body = $c.find('.c6').first();
    const htmlContent = $body.html() || '';
    const textContent = $body.text().trim();
    const id = $c.find('a[name]').attr('name') || `c-${idx}`;

    comments.push({
      id,
      author,
      postedAt,
      score,
      isUploader,
      html: htmlContent,
      text: textContent,
    });
  });

  return {
    gid,
    token,
    title,
    titleJpn,
    category: normalizeCategory(categoryRaw),
    thumb,
    uploader,
    posted,
    parent,
    visible,
    language,
    fileSize,
    pages,
    favoritedCount,
    rating,
    ratingCount,
    tagGroups,
    previews,
    previewPageCount,
    currentPreviewPage,
    comments,
    source: site,
  };
}

export function parseReaderPageHtml(
  html: string,
  gid: string,
  pageToken: string,
  page: number
): ReaderImageResponse {
  const $ = cheerio.load(html);
  const imageUrl = $('#img').attr('src') || '';

  const infoText = $('#i2 > div:nth-child(2)').text().trim() || '';
  // Example: "001.jpg :: 1280 x 1800 :: 420.5 KiB"
  const parts = infoText.split('::').map((s) => s.trim());
  const fileName = parts[0] || undefined;
  let width: number | undefined;
  let height: number | undefined;
  if (parts[1]) {
    const dimMatch = parts[1].match(/(\d+)\s*x\s*(\d+)/i);
    if (dimMatch) {
      width = parseInt(dimMatch[1], 10);
      height = parseInt(dimMatch[2], 10);
    }
  }

  const loadFailOnclick = $('#loadfail').attr('onclick') || '';
  const nlMatch = loadFailOnclick.match(/nl\(['"]([^'"]+)['"]\)/);
  const reloadKey = nlMatch ? nlMatch[1] : undefined;

  const nextHref = $('#next').attr('href') || '';
  const prevHref = $('#prev').attr('href') || '';
  const nextMatch = nextHref.match(/\/s\/([a-f0-9]+)\/\d+-(\d+)/i);
  const prevMatch = prevHref.match(/\/s\/([a-f0-9]+)\/\d+-(\d+)/i);

  const pageCounterText = $('#i2 .sn div').text().trim();
  const totalMatch = pageCounterText.match(/\/\s*(\d+)/);
  const totalPages = totalMatch ? parseInt(totalMatch[1], 10) : undefined;

  return {
    gid,
    page,
    pageToken,
    imageUrl,
    width,
    height,
    fileName,
    reloadKey,
    nextPageToken: nextMatch && parseInt(nextMatch[2], 10) !== page ? nextMatch[1] : undefined,
    prevPageToken: prevMatch && parseInt(prevMatch[2], 10) !== page ? prevMatch[1] : undefined,
    totalPages,
  };
}
