# 开始运行前先得添加Node.js和Git到PATH（每次打开新终端都需要运行）
$env:Path += ";C:\Program Files\nodejs;C:\Program Files\Git\cmd"

# 只启动前端
npm start

# 只启动后端  
npm run start:server

# 前端+后端 -- 完整项目运行
npm run dev