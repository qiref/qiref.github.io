---
title: About Hugo Zen
toc: true
---

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/qiref/hugo-zen/blob/master/LICENSE.md)
[![Hugo](https://img.shields.io/badge/Hugo-%E2%89%A50.100.0-ff4088.svg)](https://gohugo.io)

**Hugo Zen** is a fast, clean, and minimalist Hugo theme designed for technical blogs, architecture essays, and personal notes. Inspired by [hugo-xmin](https://github.com/yihui/hugo-xmin) and GitHub Primer Light, it delivers modern reading ergonomics—instant `⌘K` search, a floating scroll-spy table of contents, a 5-year post contribution heatmap, and zero-JS compile-time syntax highlighting—without heavy frontend frameworks.

---

## ✨ Features

- **Minimalist Typography & Reading Layout**: Focused single-column layout (`max-width: 800px`) with GitHub Primer-inspired typography, clean tables, and subtle dividers.
- **Instant `⌘K` / `/` Full-Text Search**: Built-in client-side search modal with glassmorphism backdrop, keyword highlighting, snippet extraction, and full keyboard navigation (`↑` `↓` `↵` `ESC`).
- **Floating Minimal TOC Sidebar**: Unobtrusive line-indicator on the right margin that expands into a frosted-glass Table of Contents card on hover, complete with active heading scroll-spy and smooth scrolling.
- **5-Year Contribution Heatmap**: GitHub-style post activity heatmap automatically rendered on the homepage.
- **Tag Cloud Pill Matrix**: Clean taxonomy pill badges with post counts.
- **Atom One Light Syntax Highlighting**: Zero-JS, compile-time syntax highlighting powered by Hugo's native Chroma lexer.
- **Dual Content Sections (`post` & `note`)**: Separate long-form technical articles (`post`) from lightweight daily notes (`note`).
- **Zero Hardcoding & Extensible**: Native configuration for Google Analytics (`gtag.js`), Utterances comments, MathJax/KaTeX passthrough, and custom head/footer partial hooks.

---

## 🚀 Installation

### Option 1: Git Submodule (Recommended)

From the root of your Hugo site:

```bash
git submodule add https://github.com/qiref/hugo-zen.git themes/hugo-zen
```

Then set `theme: "hugo-zen"` in your `config.yaml` (or `hugo.yaml`).

To update the theme later:

```bash
git submodule update --remote --merge themes/hugo-zen
```

### Option 2: Clone Directly

```bash
git clone https://github.com/qiref/hugo-zen.git themes/hugo-zen
```

### Running the Built-in Demo (`exampleSite`)

You can preview the theme immediately using the bundled `exampleSite`:

```bash
git clone https://github.com/qiref/hugo-zen.git
cd hugo-zen
hugo server -s exampleSite --themesDir ../..
```

---

## ⚙️ Configuration

Below is a complete `config.yaml` reference:

```yaml
baseurl: "https://example.com/"
languageCode: "en-us" # or "cn-zh"
defaultContentLanguage: "zh"
title: "My Blog"
theme: "hugo-zen"

# Optional: Google Analytics 4 Measurement ID
googleAnalytics: ""

enableEmoji: true
footnotereturnlinkcontents: "↩"

permalinks:
  note: "/note/:year/:month/:day/:slug/"
  post: "/post/:year/:month/:day/:slug/"

# Required for Cmd+K instant search (/index.json)
outputs:
  home: ["HTML", "RSS", "JSON"]

menu:
  main:
    - name: Home
      url: "/"
      weight: 1
    - name: Posts
      url: "post/"
      weight: 2
    - name: Tags
      url: "tags/"
      weight: 3
    - name: Note
      url: "note/"
      weight: 4
    - name: About
      url: "about/"
      weight: 5
    - name: Subscribe
      url: "index.xml"
      weight: 6

params:
  description: "Personal blog powered by Hugo and hugo-zen."
  footer: "&copy; powered by [Hugo](https://gohugo.io/) & [Hugo Zen](https://github.com/qiref/hugo-zen) 2017 -- {Year}"
  homePostLimit: 25       # Number of recent posts displayed on the homepage
  enableHeatmap: true     # Show 5-year post contribution heatmap on the homepage
  enableSearch: true      # Enable Cmd+K / Ctrl+K search trigger and modal
  utterances:
    repo: ""              # e.g. "username/repo" (leave empty to disable comments)
    issueTerm: "pathname"
    label: "Comment"
    theme: "github-light"

markup:
  tableOfContents:
    startLevel: 2
    endLevel: 4
    ordered: false
  highlight:
    codeFences: true
    noClasses: false      # Required: use semantic Chroma CSS classes
    guessSyntax: false
    tabWidth: 4
  goldmark:
    renderer:
      unsafe: true
    extensions:
      passthrough:
        enable: true
        delimiters:
          block:
            - - \[
              - \]
            - - $$
              - $$
          inline:
            - - \(
              - \)
```

---

## 📝 Front Matter Parameters

You can customize individual posts via YAML front matter:

```yaml
---
title: "Understanding Distributed Consensus"
date: 2026-01-15
author: "Your Name"
tags: ["Distributed Systems", "Go"]
categories: ["Architecture"]
toc: true # Set to false to hide the floating TOC sidebar on a specific post
---
```

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | Required | Article title |
| `date` | `date` | Required | Publication date (`YYYY-MM-DD`) |
| `author` | `string` | Optional | Author name displayed in article metadata |
| `tags` | `string[]` | `[]` | Tags rendered as pills in metadata and `/tags/` |
| `categories` | `string[]` | `[]` | Categories rendered in metadata |
| `toc` | `boolean` | `true` | Toggle the right-hand floating TOC sidebar |

---

## 🔌 Customization Hooks

**Hugo Zen** provides two clean partial hooks so you can inject custom CSS, fonts, or scripts without overriding core templates:

- `layouts/partials/head_custom.html`: Injected right before `</head>`.
- `layouts/partials/foot_custom.html`: Injected inside `<footer>` before `</body>`.

---

## 📄 License & Credits

Released under the [MIT License](https://github.com/qiref/hugo-zen/blob/master/LICENSE.md).
Originally inspired by [Yihui Xie's hugo-xmin](https://github.com/yihui/hugo-xmin).
