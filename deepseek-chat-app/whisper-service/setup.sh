#!/bin/bash
# Whisper 音频转文字服务安装脚本
# WSL/Linux 版本

echo "🚀 开始安装 Whisper 服务..."

# 创建 conda 虚拟环境
echo "📦 创建 conda 虚拟环境: whisper-env"
conda create -n whisper-env python=3.10 -y

# 激活虚拟环境并安装依赖
echo "📥 安装依赖包..."
source $(conda info --base)/etc/profile.d/conda.sh
conda activate whisper-env
pip install -r requirements.txt

echo "✅ 安装完成！"
echo ""
echo "启动服务请运行: ./start-whisper.sh"
