---
title: "Wezterm helix config"
date: 2024-02-20T11:46:28+08:00

---

## wezterm config

文件名称: `~/.config/wezterm/wezterm.lua`

```lua
-- Pull in the wezterm API
local wezterm = require 'wezterm'

-- This table will hold the configuration.
-- local config = {}

-- In newer versions of wezterm, use the config_builder which will
-- help provide clearer error messages
if wezterm.config_builder then
  config = wezterm.config_builder()
end

-- This is where you actually apply your config choices

-- For example, changing the color scheme:
-- config.color_scheme = 'Nancy (terminal.sexy)'
-- and finally, return the configuration to wezterm

-- Title
function basename(s)
  return string.gsub(s, '(.*[/\\])(.*)', '%2')
end

wezterm.on('format-tab-title', function(tab, tabs, panes, config, hover, max_width)
  local pane = tab.active_pane

  local index = ""
  if #tabs > 1 then
    index = string.format("⌘+%d:", tab.tab_index + 1)
  end

  local process = basename(pane.foreground_process_name)

  return { {
    Text = ' ' .. index .. process .. ' '
  } }
end)

-- Startup
wezterm.on('gui-startup', function(cmd)
  local tab, pane, window = wezterm.mux.spawn_window(cmd or {})
  window:gui_window():maximize()
end)

local config = {
  -- Basic
  enable_scroll_bar = true,

  -- Window
  native_macos_fullscreen_mode = true,
  adjust_window_size_when_changing_font_size = true,
  -- window_background_opacity = 0.9,
  -- window_padding = {
  -- left = 30,
  -- right = 30,
  -- top = 5,
  -- bottom = 5
  -- },

  -- Font
  font = wezterm.font('JetBrains Mono', { weight = 'DemiBold' }),
  font_size = 14,
  line_height = 1.1,

  -- Tab bar
  enable_tab_bar = true,
  hide_tab_bar_if_only_one_tab = false,
  show_tab_index_in_tab_bar = false,
  tab_bar_at_bottom = true,
  tab_max_width = 50,
  use_fancy_tab_bar = false,


  -- Keys
  disable_default_key_bindings = false,
  keys = {
    {
      key = 'p',
      mods = 'CMD',
      action = wezterm.action.SplitPane {
        direction = 'Down',
        size = { Percent = 50 },
      }
    },
    {
      key = 'w',
      mods = 'CMD',
      action = wezterm.action.CloseCurrentPane { confirm = false },
    },
  },

  color_scheme = 'Horizon Dark (base16)',
}

return config
 
```

## helix config

文件名称 `~/.config/helix/config.toml`

```toml
theme = "sonokai"

[editor]
cursorline = true # 高亮当前行 
true-color = true # 需要加这个配置，theme 才能生效 
bufferline = "always" # 是否显示顶部 buffer 
completion-replace = true # 补全自动替换

[editor.cursor-shape] # 各种模式下光标样式
insert = "bar"
normal = "block"
select = "underline"


[editor.file-picker]
hidden = false # 是否忽略隐藏文件 

[editor.lsp]
display-messages = true # 状态栏展示 LSP 信息
display-inlay-hints = true

[editor.statusline]
right = ["diagnostics", "selections", "position", "file-encoding", "file-line-ending", "file-type","version-control"]
 
```
