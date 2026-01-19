# Whisper 音频转文字服务安装和启动脚本
# Windows PowerShell 版本

Write-Host "🚀 开始安装 Whisper 服务..." -ForegroundColor Green

# 创建 conda 虚拟环境
Write-Host "📦 创建 conda 虚拟环境: whisper-env" -ForegroundColor Cyan
conda create -n whisper-env python=3.10 -y

# 激活虚拟环境并安装依赖
Write-Host "📥 安装依赖包..." -ForegroundColor Cyan
conda activate whisper-env
pip install -r requirements.txt

Write-Host "✅ 安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "启动服务请运行: .\start-whisper.ps1" -ForegroundColor Yellow
