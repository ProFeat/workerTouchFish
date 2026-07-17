# WORKERMOYU 🐟

**I LIKE TOUCH FISHN** — 上班摸鱼必备 VS Code 插件

在侧边栏浏览贴吧帖子，摸鱼于无形之中！

## 功能

- 🐟 侧边栏显示贴吧帖子列表（标题 + 回复数）
- 📖 点击 ▶ 展开查看帖子楼层回复内容
- 🔄 一键刷新帖子列表
- 🔗 点击帖子标题在浏览器中打开原帖
- 🏷️ 支持切换任意贴吧

## 使用方法

### 第一步：设置 Cookie

1. 浏览器登录[百度贴吧](https://tieba.baidu.com)
2. 按 **F12** → **Application** → **Cookies** → 点击任意 cookie → **Ctrl+A** 全选 → **Ctrl+C** 复制
3. 回到 VS Code，按 **`Ctrl+Shift+P`**
4. 搜索并选择 **`WORKERMOYU: 设置 BDUSS（百度登录）`**
5. 粘贴复制的 Cookie 内容，回车
6. 侧边栏自动加载帖子

### 第二步：切换贴吧（可选）

- 按 **`Ctrl+Shift+P`** → 搜索 **`WORKERMOYU: 切换贴吧`**
- 输入想要的贴吧名称（如 `抗压背锅吧`）

### 快捷操作

| 操作 | 方式 |
|------|------|
| 刷新帖子 | 点击侧边栏标题旁的 🔄 图标 |
| 打开帖子 | 点击帖子标题 |
| 查看回复 | 点击帖子前的 ▶ 展开 |

## 配置项

在 VS Code 设置中搜索 `workermoyu` 可自定义：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `workermoyu.barName` | 默认贴吧名 | 抗压背锅吧 |
| `workermoyu.bduss` | 百度登录凭证 | (空) |
| `workermoyu.maxPosts` | 帖子显示数量 | 20 |

## 注意事项

- BDUSS Cookie 仅保存在本地 VS Code 设置中，不会上传
- Cookie 过期后需要重新设置

---

**摸鱼愉快！** 🐟
