const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = 3001;

// 中间件
app.use(cors());
app.use(express.json());

// DeepSeek API配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = process.env.DEEPSEEK_API_KEY;

if (!API_KEY) {
  console.error('❌ 错误：请在 .env 文件中设置 DEEPSEEK_API_KEY');
  console.error('示例：DEEPSEEK_API_KEY=sk-your-api-key-here');
  process.exit(1);
}

// LaTeX格式的系统提示
const SYSTEM_PROMPT = `你是一个AI助手，知识储备雄厚。
当回答中包含数学公式时，请严格使用美元格式的LaTeX写法进行编写。
请严格按照用户指令回答。`;

// 流式聊天接口
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, model = 'deepseek-chat', max_tokens = 2000 } = req.body;

    console.log('📨 收到消息:', message.substring(0, 50) + '...');

    // 设置响应头，支持SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no');

    // 构建请求数据
    const requestData = {
      model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens,
      stream: true,
      temperature: 0.7
    };

    console.log('🚀 发送请求到DeepSeek API...');

    // 发送请求到DeepSeek API
    const response = await axios({
      method: 'post',
      url: DEEPSEEK_API_URL,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      data: requestData,
      responseType: 'stream',
      timeout: 30000
    });

    // 将DeepSeek的流式响应转发给客户端
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            console.log('✅ 流式传输完成');
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            
            if (content) {
              res.write(`data: ${JSON.stringify({ 
                type: 'chunk', 
                content: content
              })}\n\n`);
            }
          } catch (e) {
            console.warn('解析JSON失败:', e.message);
          }
        }
      }
    });

    response.data.on('end', () => {
      console.log('🔚 流式响应结束');
      res.end();
    });

    response.data.on('error', (error) => {
      console.error('❌ 流式传输错误:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: '流式传输错误: ' + error.message
      })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('❌ API调用失败:', error.message);
    
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
    
    res.status(500).json({
      error: '调用AI服务失败',
      details: error.message
    });
  }
});

// 普通聊天接口（非流式，备用）
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'deepseek-chat' } = req.body;

    console.log('📨 收到消息（非流式）:', message);

    const response = await axios.post(DEEPSEEK_API_URL, {
      model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000
    });

    console.log('✅ 收到非流式响应');
    
    res.json({
      reply: response.data.choices[0].message.content,
      usage: response.data.usage
    });
  } catch (error) {
    console.error('❌ 非流式API错误:', error.message);
    
    res.status(500).json({ 
      error: '调用AI服务失败',
      details: error.message
    });
  }
});

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'DeepSeek Chat API Proxy'
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`🚀 后端服务器运行在 http://localhost:${port}`);
  console.log(`📡 可用端点:`);
  console.log(`   - 健康检查: GET http://localhost:${port}/api/health`);
  console.log(`   - 流式聊天: POST http://localhost:${port}/api/chat/stream`);
  console.log(`   - 普通聊天: POST http://localhost:${port}/api/chat`);
  console.log(`🔑 API密钥状态: ${API_KEY ? '已设置' : '未设置'}`);
});