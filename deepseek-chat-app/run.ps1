# Windows PowerShell 环境启动脚本

# 添加环境变量
$env:Path += ";C:\Program Files\nodejs;C:\Program Files\Git\cmd"

# 切换到脚本所在目录
Set-Location $PSScriptRoot

# 运行项目
npm run dev
