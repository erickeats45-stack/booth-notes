# 展遇 · 展会访客记录

用手机拍名片，核对识别结果之后记录产品兴趣和现场备注。首页的「试识别演示名片」使用虚构名片，可以体验整个流程。

名片识别和访客记录都在设备上处理。客户资料、照片与产品标签保存在当前浏览器中，可通过页面里的 JSON 完整备份转移到另一台设备。这里发布的文件包括网页程序、英文 OCR 模型和虚构名片。

## 发布到 GitHub Pages

把解压后 `booth-notes` 目录里的文件放到仓库的 `main` 分支根目录（包括 `.nojekyll`），然后到 **Settings → Pages**，选择 **Deploy from a branch → main → /(root)** 并保存。构建完成后，以 Pages 设置中显示的网址为准。

## 识别组件

本版使用 Tesseract.js 5.1.1、Tesseract.js Core 5.1.1 和 Tesseract 英文语言数据。对应许可证见本目录的 `LICENSE-*.txt` 文件。
