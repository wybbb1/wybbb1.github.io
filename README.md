# wybbb1.github.io

个人主页 & 技术博客

## 项目结构

```
├── index.html          # 首页
├── blog.html           # 博客列表
├── post.html           # 文章详情（动态加载 Markdown）
├── projects.html       # GitHub 项目展示
├── posts.json          # 文章索引
├── posts/              # Markdown 文章（带 frontmatter）
│   ├── JVM类加载机制.md
│   ├── Redis分布式锁.md
│   ├── rag.md
│   └── ...
├── css/style.css       # 全局样式（含暗黑模式）
├── js/main.js          # 全局逻辑
└── .nojekyll           # 确保 GitHub Pages 原样输出 .md 文件
```

## 写文章

1. 在 `posts/` 下新建 Markdown 文件，开头添加 frontmatter：

```markdown
---
title: 文章标题
date: 2026-01-01
categories:
  - 分类名
---

正文内容...
```

2. 在 `posts.json` 中追加一条记录：

```json
{
  "title": "文章标题",
  "date": "2026-01-01",
  "category": "分类名",
  "file": "文件名.md"
}
```

3. 提交并推送到 `main` 分支，GitHub Pages 自动部署。

## 本地预览

```bash
# 任意静态服务器即可
npx serve .
# 或
python -m http.server 8000
```

## License

MIT
