#!/bin/bash
# 启动 Whisper 服务
# WSL/Linux 版本

echo "🚀 启动 Whisper 音频转文字服务..."

# 切换到脚本所在目录
cd "$(dirname "$0")"

# 激活 conda 环境并启动服务
source $(conda info --base)/etc/profile.d/conda.sh
conda activate whisper-env
python app.py
