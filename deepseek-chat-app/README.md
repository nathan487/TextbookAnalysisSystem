# 快速启动（推荐）

## Windows PowerShell
.\run.ps1
# 或者
npm run dev

## WSL/Linux
./run.sh
# 或者
npm run dev

---

# 音频转文字功能

项目支持通过 Whisper 将音频转换为文字。

## 启动 Whisper 服务

### Windows
```powershell
cd whisper-service
.\setup.ps1          # 首次运行，安装依赖
.\start-whisper.ps1  # 启动服务
```

### WSL/Linux
```bash
cd whisper-service
chmod +x setup.sh start-whisper.sh
./setup.sh           # 首次运行，安装依赖
./start-whisper.sh   # 启动服务
```

## 使用方法

1. 确保 Whisper 服务运行在 `http://localhost:5000`
2. 在聊天界面点击 🎤 按钮
3. 选择音频文件（支持 MP3, WAV, MP4, M4A, OGG, WebM）
4. 等待转录完成，文本会自动填入输入框

详细说明见 [whisper-service/README.md](whisper-service/README.md)

---

# 手动启动

## Windows - 需要先添加环境变量
$env:Path += ";C:\Program Files\nodejs;C:\Program Files\Git\cmd"

## 然后运行以下命令：

# 只启动前端
npm start

# 只启动后端  
npm run start:server

# 前端+后端 -- 完整项目运行
npm run dev

---

# WSL 使用说明

1. 确保在 WSL 中进入项目目录：
   ```bash
   cd /mnt/c/Users/Admin/Desktop/TextbookAnalysisSystem/TextbookAnalysisSystem/deepseek-chat-app
   ```

2. 直接运行（推荐）：
   ```bash
   npm run dev
   ```

3. 或使用启动脚本：
   ```bash
   chmod +x run.sh  # 首次需要添加执行权限
   ./run.sh
   ```

## 说明
- `npm run dev` 现在在 Windows 和 WSL 中都能正常工作
- 后端直接使用 `node server/index.js` 启动，无需 PowerShell
- Windows 用户也可以继续使用 `.\run.ps1` 脚本