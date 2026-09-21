import * as https from 'https';
import * as crypto from 'crypto';

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

function httpsGetJson(path: string, cookie: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const opts: https.RequestOptions = {
      hostname: 'tieba.baidu.com',
      path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cookie': cookie,
      },
    };

    https.get(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('解析贴吧数据失败'));
        }
      });
    }).on('error', reject);
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
function parseContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item: any) => {
      if (item.type === 0) return item.text || '';
      if (item.type === 2) return `[${item.c || '表情'}]`;
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
  if (data.error_code && data.error_code !== '0') {
    return [];
  }

  return (data.post_list ?? []).map((p: any) => ({
    floor: p.floor ?? 0,
    author: p.author?.name ?? '匿名',
    content: parseContent(p.content),
  }));
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

    if (data.error_code && data.error_code !== '0') {
      throw new Error(data.error_msg || `API 错误 (${data.error_code})`);
    }

    const threadList: any[] = data.thread_list ?? [];
    if (threadList.length === 0) break; // 没有更多数据了

    for (const t of threadList) {
      const tid = String(t.id ?? t.tid ?? '0');
      if (seen.has(tid)) continue;
      seen.add(tid);

      const title = (t.title ?? '(无标题)')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      allThreads.push({
        tid,
        title,
        replyNum: t.reply_num ?? 0,
        author: t.author?.name ?? '未知',
      });

    }
  }

  return allThreads
    .sort((a, b) => b.replyNum - a.replyNum)
    .slice(0, maxCount);
}
