# Windows PowerShell 后端启动脚本
# 添加 Node.js 到 PATH（如果需要）
$env:Path += ";C:\Program Files\nodejs"

cd server
node index.js
