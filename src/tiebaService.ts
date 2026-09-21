import * as https from 'https';
import * as crypto from 'crypto';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;

export interface TiebaThread {
  tid: string;
  title: string;
  replyNum: number;
  author: string;
}

/**
 * 生成 Tieba 客户端 API 签名（MD5）
 */
function makeSign(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  const str = keys.map(k => `${k}=${params[k]}`).join('') + 'tiebaclient!!!';
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getApiError(data: unknown): string | undefined {
  if (!isRecord(data) || data.error_code === undefined || String(data.error_code) === '0') {
    return undefined;
  }

  return getString(data.error_msg, `API 错误 (${String(data.error_code)})`);
}

function normalizeCookieHeader(cookie: string): string {
  const value = cookie.trim();
  if (!value || value.includes('=')) return value;
  return `BDUSS=${value}`;
}

function httpsGetJson(path: string, cookie: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const opts: https.RequestOptions = {
      hostname: 'tieba.baidu.com',
      path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cookie': normalizeCookieHeader(cookie),
      },
    };

    let settled = false;
    const finish = (callback: () => void) => {
      if (!settled) {
        settled = true;
        callback();
      }
    };

    const request = https.get(opts, (res) => {
      const statusCode = res.statusCode ?? 0;
      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        finish(() => reject(new Error(`贴吧请求失败（HTTP ${statusCode}）`)));
        return;
      }

      let data = '';
      let responseBytes = 0;
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        responseBytes += Buffer.byteLength(chunk, 'utf8');
        if (responseBytes > MAX_RESPONSE_BYTES) {
          res.destroy(new Error('贴吧响应过大'));
          return;
        }
        data += chunk;
      });
      res.on('error', (error) => finish(() => reject(error)));
      res.on('end', () => {
        try {
          finish(() => resolve(JSON.parse(data) as unknown));
        } catch {
          finish(() => reject(new Error('解析贴吧数据失败')));
        }
      });
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('贴吧请求超时'));
    });
    request.on('error', (error) => finish(() => reject(error)));
  });
}

export interface TiebaPost {
  floor: number;
  author: string;
  content: string;
}

/**
 * 提取帖子内容文本（去除表情等）
 */
function parseContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (!isRecord(item)) return '';
      if (item.type === 0) return getString(item.text);
      if (item.type === 2) return `[${getString(item.c, '表情')}]`;
      if (item.type === 3) return `[图片]`;
      return '';
    }).join(' ').trim();
  }
  return '';
}

/**
 * 获取帖子正文内容（楼层回复）
 */
export async function fetchThreadContent(tid: string, cookie: string, maxReplies: number = 15): Promise<TiebaPost[]> {
  if (!cookie) return [];

  const params: Record<string, string> = {
    kz: tid,
    pn: '1',
    rn: String(maxReplies),
  };
  const sign = makeSign(params);
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const path = `/c/f/pb/page?${query}&sign=${sign}`;

  const data = await httpsGetJson(path, cookie);
  if (getApiError(data)) {
    return [];
  }

  const postList = isRecord(data) && Array.isArray(data.post_list) ? data.post_list : [];
  return postList.map((post) => {
    const item = isRecord(post) ? post : {};
    const author = isRecord(item.author) ? item.author : {};
    return {
      floor: getNumber(item.floor),
      author: getString(author.name, '匿名'),
      content: parseContent(item.content),
    };
  });
}

export async function fetchThreads(barName: string, cookie: string, maxCount: number = 25, maxPages: number = 1): Promise<TiebaThread[]> {
  if (!cookie) {
    throw new Error('请先设置 Cookie（Ctrl+Shift+P → 设置 BDUSS）');
  }

  const seen = new Set<string>();
  const allThreads: TiebaThread[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const params: Record<string, string> = {
      kw: barName,
      pn: String(page),
      rn: '15',
    };
    const sign = makeSign(params);
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const path = `/c/f/frs/page?${query}&sign=${sign}`;

    const data = await httpsGetJson(path, cookie);

    const apiError = getApiError(data);
    if (apiError) {
      throw new Error(apiError);
    }

    const threadList = isRecord(data) && Array.isArray(data.thread_list) ? data.thread_list : [];
    if (threadList.length === 0) break; // 没有更多数据了

    for (const thread of threadList) {
      const item = isRecord(thread) ? thread : {};
      const tid = String(item.id ?? item.tid ?? '0');
      if (seen.has(tid)) continue;
      seen.add(tid);

      const title = getString(item.title, '(无标题)')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const author = isRecord(item.author) ? item.author : {};
      allThreads.push({
        tid,
        title,
        replyNum: getNumber(item.reply_num),
        author: getString(author.name, '未知'),
      });
    }
  }

  return allThreads
    .sort((a, b) => b.replyNum - a.replyNum)
    .slice(0, maxCount);
}
