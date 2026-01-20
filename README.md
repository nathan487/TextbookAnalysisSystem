# 开始运行前先得添加Node.js到PATH
$env:Path = "D:\Program Files\nodejs;" + $env:Path

# 只启动前端
npm start

# 只启动后端  
npm run start:server

# 前端+后端 -- 完整项目运行
npm run dev


