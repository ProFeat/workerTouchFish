import * as vscode from 'vscode';

class MoyuItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description?: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    public readonly tooltip?: string
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip || label;
  }
}

class MoyuTreeProvider implements vscode.TreeDataProvider<MoyuItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MoyuItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: MoyuItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MoyuItem): Thenable<MoyuItem[]> {
    if (element) {
      return Promise.resolve([]);
    }
    const tfItem = new MoyuItem(
      '🐱 关注塔菲喵！！！',
      '🔗 space.bilibili.com/1265680561',
      vscode.TreeItemCollapsibleState.None,
      '点击打开塔菲喵的B站主页'
    );
    tfItem.command = {
      command: 'workermoyu.openBilibili',
      title: '打开B站',
      arguments: ['https://space.bilibili.com/1265680561']
    };

    return Promise.resolve([
      new MoyuItem(
        '🐟  I LIKE TOUCH FISHN  🐟',
        undefined,
        vscode.TreeItemCollapsibleState.None,
        '摸鱼才是正经事！'
      ),
      tfItem,
    ]);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new MoyuTreeProvider();
  context.subscriptions.push(
    vscode.window.createTreeView('workermoyu.sidebar', { treeDataProvider: provider })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('workermoyu.openBilibili', (url: string) => {
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );
}

export function deactivate() {}
