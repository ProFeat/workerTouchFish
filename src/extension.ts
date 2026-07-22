import * as vscode from 'vscode';
import { fetchThreads, fetchThreadContent, TiebaThread, TiebaPost } from './tiebaService';

class MoyuItem extends vscode.TreeItem {
  public posts?: TiebaPost[];

  constructor(
    public readonly label: string,
    public readonly description?: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    public readonly tooltip?: string,
    public readonly thread?: TiebaThread
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip || label;
  }
}

class MoyuTreeProvider implements vscode.TreeDataProvider<MoyuItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MoyuItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private threads: TiebaThread[] = [];
  private loading = false;
  private cookie = '';

  // 伪装模式相关
  private disguised = false;

  isDisguised() { return this.disguised; }

  setDisguised(value: boolean) {
    if (this.disguised === value) return;
    this.disguised = value;
    this._onDidChangeTreeData.fire(undefined);
  }

  private generateFakeFiles(): MoyuItem[] {
    const now = new Date();
    const files = [
      { name: '📁 src', desc: '', icon: '📁' },
      { name: '  📄 main.ts', desc: '2,431 B 修改于 ' + this.formatTime(now), icon: '📄' },
      { name: '  📄 App.tsx', desc: '8,217 B 修改于 ' + this.formatTime(new Date(now.getTime() - 60000)), icon: '📄' },
      { name: '  📄 styles.css', desc: '1,024 B • 未暂存', icon: '📄' },
      { name: '  📁 components', desc: '', icon: '📁' },
      { name: '    📄 Header.tsx', desc: '3,145 B 修改于 ' + this.formatTime(new Date(now.getTime() - 120000)), icon: '📄' },
      { name: '    📄 Sidebar.tsx', desc: '5,672 B • 已修改', icon: '📄' },
      { name: '    📄 Footer.tsx', desc: '892 B 修改于 ' + this.formatTime(new Date(now.getTime() - 300000)), icon: '📄' },
      { name: '  📁 utils', desc: '', icon: '📁' },
      { name: '    📄 api.ts', desc: '4,210 B 修改于 ' + this.formatTime(new Date(now.getTime() - 180000)), icon: '📄' },
      { name: '    📄 helpers.ts', desc: '1,563 B • 未暂存', icon: '📄' },
      { name: '  📄 index.ts', desc: '321 B 修改于 ' + this.formatTime(new Date(now.getTime() - 3600000)), icon: '📄' },
      { name: '📁 tests', desc: '', icon: '📁' },
      { name: '  📄 main.spec.ts', desc: '1,892 B 修改于 ' + this.formatTime(new Date(now.getTime() - 86400000)), icon: '📄' },
      { name: '  📄 utils.test.ts', desc: '2,104 B 修改于 ' + this.formatTime(new Date(now.getTime() - 86400000)), icon: '📄' },
      { name: '📄 package.json', desc: '892 B 修改于 ' + this.formatTime(new Date(now.getTime() - 7200000)), icon: '📄' },
      { name: '📄 tsconfig.json', desc: '456 B 修改于 ' + this.formatTime(new Date(now.getTime() - 7200000)), icon: '📄' },
      { name: '📄 README.md', desc: '2,048 B 修改于 ' + this.formatTime(new Date(now.getTime() - 86400000 * 2)), icon: '📄' },
      { name: '📄 .eslintrc.json', desc: '312 B 修改于 ' + this.formatTime(new Date(now.getTime() - 86400000 * 7)), icon: '📄' },
    ];
    return files.map(f => new MoyuItem(f.name, f.desc));
  }

  private formatTime(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  getTreeItem(element: MoyuItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MoyuItem): Thenable<MoyuItem[]> {
    // 伪装模式：显示假文件列表
    if (!element && this.disguised) {
      return Promise.resolve(this.generateFakeFiles());
    }
    // 展开帖子：显示楼层回复内容
    if (element) {
      if (element.thread) {
        return this.getPosts(element);
      }
      return Promise.resolve([]);
    }
    if (this.loading) {
      return Promise.resolve([new MoyuItem('⏳ 正在摸鱼...', undefined, undefined, '加载中')]);
    }
    if (this.threads.length === 0) {
      return Promise.resolve([
        new MoyuItem('Workspace Files'),
      ]);
    }

    const items: MoyuItem[] = [
      new MoyuItem('Workspace Files', `📌 ${this.threads.length}条帖子`),
      new MoyuItem('─'.repeat(30), undefined, undefined, '帖子列表'),
    ];

    for (const t of this.threads) {
      const item = new MoyuItem(
        `${this.escapeHtml(t.title)}`,
        `💬 ${t.replyNum}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        `作者: ${t.author}  |  回复: ${t.replyNum}`,
        t
      );
      item.command = {
        command: 'workermoyu.openThread',
        title: '打开帖子',
        arguments: [t],
      };
      items.push(item);
    }

    return Promise.resolve(items);
  }

  private async getPosts(threadItem: MoyuItem): Promise<MoyuItem[]> {
    if (!threadItem.thread) return [];

    // 已缓存，直接返回
    if (threadItem.posts) {
      return threadItem.posts.map(p => this.postToItem(p));
    }

    try {
      const posts = await fetchThreadContent(threadItem.thread.tid, this.cookie, 15);
      threadItem.posts = posts;
      return posts.map(p => this.postToItem(p));
    } catch {
      return [new MoyuItem('⚠️ 加载失败', undefined, undefined, '无法加载回复')];
    }
  }

  private postToItem(post: TiebaPost): MoyuItem {
    const label = post.content.length > 60
      ? post.content.substring(0, 60) + '...'
      : post.content;
    return new MoyuItem(
      `#${post.floor}`,
      label,
      undefined,
      post.content
    );
  }

  private escapeHtml(text: string): string {
    return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
  }

  async refresh(cookieFromSecrets?: string) {
    this.loading = true;
    this._onDidChangeTreeData.fire(undefined);

    this.cookie = cookieFromSecrets || vscode.workspace.getConfiguration('workermoyu').get('bduss', '');
    const barName = vscode.workspace.getConfiguration('workermoyu').get('barName', '抗压背锅吧');
    const maxPosts = vscode.workspace.getConfiguration('workermoyu').get('maxPosts', 20);
    const maxPages = vscode.workspace.getConfiguration('workermoyu').get('maxPages', 3);

    try {
      this.threads = await fetchThreads(barName, this.cookie, maxPosts, maxPages);
    } catch (err: any) {
      this.threads = [];
      vscode.window.showErrorMessage(`摸鱼失败: ${err.message}`);
    } finally {
      this.loading = false;
      this._onDidChangeTreeData.fire(undefined);
    }
  }
}

function getCookie(): string {
  const cfg = vscode.workspace.getConfiguration('workermoyu').get('bduss', '');
  return cfg || '';
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new MoyuTreeProvider();

  // 启动时自动加载帖子
  provider.refresh(getCookie());

  const treeView = vscode.window.createTreeView('workermoyu.sidebar', { treeDataProvider: provider });
  context.subscriptions.push(treeView);

  // 打开或点击侧边栏时显示帖子。
  context.subscriptions.push(
    treeView.onDidChangeSelection(() => provider.setDisguised(false)),
    treeView.onDidChangeVisibility(event => {
      if (event.visible) {
        provider.setDisguised(false);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('workermoyu.refresh', async () => {
      provider.refresh(getCookie());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('workermoyu.openThread', (thread: TiebaThread) => {
      vscode.env.openExternal(vscode.Uri.parse(`https://tieba.baidu.com/p/${thread.tid}`));
    })
  );

  // 伪装模式：手动切换
  context.subscriptions.push(
    vscode.commands.registerCommand('workermoyu.toggleDisguise', () => {
      provider.setDisguised(!provider.isDisguised());
      vscode.window.showInformationMessage(
        provider.isDisguised() ? '🕵️ 伪装已开启' : '🐟 伪装已关闭，继续摸鱼'
      );
    })
  );

  // 切出 VS Code 时立即伪装；切回后点击侧边栏再恢复。
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(state => {
      if (!state.focused) {
        provider.setDisguised(true);
      }
    })
  );

  // 点击、编辑或切换代码文件时伪装侧边栏内容。
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => provider.setDisguised(true))
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => provider.setDisguised(true))
  );

  // 设置 Cookie 命令：弹出输入框
  context.subscriptions.push(
    vscode.commands.registerCommand('workermoyu.setBDUSS', async () => {
      const value = await vscode.window.showInputBox({
        prompt: '请登录百度贴吧，按 F12 → Application → Cookies → 任意 cookie 点一下按 Ctrl+A 全选复制',
        password: true,
        placeHolder: '直接粘贴全部 Cookie',
        ignoreFocusOut: true,
      });
      if (value !== undefined) {
        // 从完整 cookie 里提取 BDUSS 值
        const match = value.match(/BDUSS=([^;]+)/);
        const bduss = match ? match[1] : value;
        await vscode.workspace.getConfiguration('workermoyu').update('bduss', bduss, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('✅ Cookie 已保存！正在加载帖子...');
        provider.refresh(bduss);
      }
    })
  );

  // 设置贴吧名称命令
  context.subscriptions.push(
    vscode.commands.registerCommand('workermoyu.setBarName', async () => {
      const current = vscode.workspace.getConfiguration('workermoyu').get('barName', 'asoul');
      const value = await vscode.window.showInputBox({
        prompt: '想摸哪个吧？输入贴吧名称',
        value: current,
        placeHolder: '如 抗压背锅吧',
        ignoreFocusOut: true,
      });
      if (value !== undefined && value.trim()) {
        await vscode.workspace.getConfiguration('workermoyu').update('barName', value.trim(), vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`✅ 已切换到「${value.trim()}」吧！`);
        provider.refresh(getCookie());
      }
    })
  );

  // 配置变更时自动刷新
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('workermoyu')) {
        provider.refresh(getCookie());
      }
    })
  );
}

export function deactivate() {}
