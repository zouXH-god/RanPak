## 问题需求

添加文字无法点击与拖拽修改
编辑与导出图片需要支持更多格式 JPEG、PNG、GIF、BMP、TIFF、SVG、WebP、HEIC、ICO、HEIF

## 项目约束

- 代码需遵循 Clean Code 原则，对复杂逻辑进行拆分封装，对不同的模块按照功能文件夹存放，代码关键部分使用中文注释解释，每个函数需要有注释说明
- 后端采用 uv 进行管理

## 外置资源准备

Live2D 大模型包与 FFmpeg 不进入安装包：

1. 在应用设置页配置 `ffmpeg.exe` 和 `ffprobe.exe`，或把它们加入系统 PATH 后保持设置为空。
2. 将 Live2D 数据包放到任意本地目录，例如 `%APPDATA%/RanPak/assets/live2d`。
3. 在该目录准备 `model-catalog.json`，或在设置页指定 catalog 文件。catalog 中的 `paths`、`cover` 可写相对路径，例如 `models/Hiyori/Hiyori.model3.json`。
4. 打包脚本会清理 `app/web-dist/vendor/live2d-widget` 下的模型目录、封面目录和旧 catalog，只保留运行时代码。
