#!/bin/bash
# WSL/Linux 后端启动脚本

cd "$(dirname "$0")/server"
node index.js
