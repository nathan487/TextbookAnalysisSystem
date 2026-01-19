# Whisper 音频转文字服务

这是一个基于 OpenAI Whisper 的音频转文字服务，支持多种音频格式。

## 快速开始

### Windows

1. **安装依赖**（首次运行）：
   ```powershell
   cd whisper-service
   .\setup.ps1
   ```

2. **启动服务**：
   ```powershell
   .\start-whisper.ps1
   ```

### WSL/Linux

1. **安装依赖**（首次运行）：
   ```bash
   cd whisper-service
   chmod +x setup.sh start-whisper.sh
   ./setup.sh
   ```

2. **启动服务**：
   ```bash
   ./start-whisper.sh
   ```

## API 接口

### 1. 健康检查
```bash
GET http://localhost:5000/api/health
```

### 2. 音频转文字
```bash
POST http://localhost:5000/api/transcribe
Content-Type: multipart/form-data

参数:
- audio: 音频文件 (必需)
- language: 语言代码，如 'zh' (中文), 'en' (英文), 'auto' (自动检测) (可选，默认 'zh')
```

**示例请求** (使用 curl)：
```bash
curl -X POST http://localhost:5000/api/transcribe \
  -F "audio=@your-audio.mp3" \
  -F "language=zh"
```

**响应示例**：
```json
{
  "success": true,
  "text": "完整的转录文本",
  "language": "zh",
  "segments": [
    {
      "start": 0.0,
      "end": 5.2,
      "text": "第一段文字"
    }
  ]
}
```

## 支持的音频格式

- MP3 (.mp3)
- WAV (.wav)
- MP4 (.mp4)
- M4A (.m4a)
- OGG (.ogg)
- WebM (.webm)

## 模型说明

当前使用 `base` 模型，可在 `app.py` 中修改：

- `tiny`: 最快，准确度较低 (~1GB)
- `base`: 平衡选择 (~1GB) ✓ 当前
- `small`: 更准确 (~2GB)
- `medium`: 高准确度 (~5GB)
- `large`: 最高准确度 (~10GB)

## 注意事项

1. 首次运行会自动下载 Whisper 模型，需要一些时间
2. 模型文件会缓存在 `~/.cache/whisper/` 目录
3. 建议使用 GPU 加速（需要 CUDA）以获得更快速度
4. CPU 模式下转录速度较慢，但可以正常工作

## 与主应用集成

服务运行后，可以在主应用中调用音频转文字功能：

```javascript
// 前端示例
const formData = new FormData();
formData.append('audio', audioFile);
formData.append('language', 'zh');

const response = await fetch('http://localhost:5000/api/transcribe', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('转录结果:', result.text);
```
