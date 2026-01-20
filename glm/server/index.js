const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const app = express();
const port = 3001;

// 中间件
app.use(cors());
app.use(express.json());

// GLM API配置
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const API_KEY = process.env.GLM_API_KEY;

if (!API_KEY) {
  console.error('❌ 错误：请在 .env 文件中设置 GLM_API_KEY');
  console.error('示例：GLM_API_KEY=your-api-key-here');
  process.exit(1);
}

// LaTeX格式的系统提示
const SYSTEM_PROMPT = `你是一个AI助手，知识储备雄厚。
当回答中包含数学公式时，请严格使用美元格式的LaTeX写法进行编写。
请严格按照用户指令回答。`;

// 流式聊天接口
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, files = [], model = 'glm-4.6v', max_tokens = 2000 } = req.body;

    console.log('📨 收到消息:', typeof message === 'string' ? message.substring(0, 50) + '...' : '[多模态消息]');
    console.log('📎 附件数量:', files.length);

    // 设置响应头，支持SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no');

    // 构建用户消息内容（支持多模态）
    // 对文档（如 docx）我们尝试先解析为纯文本再发送给模型
    let userContent;
    if (files.length > 0) {
      // 多模态消息格式，先放入文本提示
      const contentArray = [
        { type: 'text', text: message || '请分析这些文件' }
      ];

      // 收集解析文档的异步任务
      const docPromises = [];

      files.forEach(file => {
        if (file.type === 'image') {
          contentArray.push({
            type: 'image_url',
            image_url: { url: file.data }
          });
        } else if (file.type === 'document') {
          // 期望前端传来的 file.data 为 data URL 或纯 base64
          const parsePromise = (async () => {
            try {
              let base64 = file.data;
              // 如果是 data:*;base64,... 格式，取逗号后面的部分
              if (typeof base64 === 'string' && base64.includes(',')) {
                base64 = base64.split(',')[1];
              }
              const buffer = Buffer.from(base64, 'base64');

              // 根据文件扩展名选择解析器（支持 docx 和 pdf）
              const lowerName = (file.name || '').toLowerCase();
              if (lowerName.endsWith('.pdf')) {
                try {
                  const data = await pdfParse(buffer);
                  const text = (data && data.text) ? data.text.trim() : '';
                  if (text) {
                    contentArray.push({ type: 'text', text: `文档（PDF）：${file.name}\n${text}` });
                  } else {
                    contentArray.push({ type: 'text', text: `（无法解析PDF文档 ${file.name} 的内容）` });
                  }
                } catch (e) {
                  console.warn('PDF 解析失败:', e && e.message ? e.message : e);
                  contentArray.push({ type: 'text', text: `（解析PDF文档 ${file.name} 时出错）` });
                }
              } else {
                // 默认使用 mammoth 处理 docx
                const result = await mammoth.extractRawText({ buffer });
                const text = result && result.value ? result.value.trim() : '';

                if (text) {
                  contentArray.push({ type: 'text', text: `文档：${file.name}\n${text}` });
                } else {
                  contentArray.push({ type: 'text', text: `（无法解析文档 ${file.name} 的内容）` });
                }
              }
            } catch (err) {
              console.warn('文档解析失败:', err && err.message ? err.message : err);
              contentArray.push({ type: 'text', text: `（解析文档 ${file.name} 时出错）` });
            }
          })();
          docPromises.push(parsePromise);
        } else {
          // 未识别的类型，作为通用文本记录其名称
          contentArray.push({ type: 'text', text: `收到未识别文件：${file.name}` });
        }
      });

      // 等待所有文档解析完成
      if (docPromises.length > 0) {
        await Promise.all(docPromises);
      }

      userContent = contentArray;
    } else {
      // 纯文本消息
      userContent = message;
    }

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
          content: userContent
        }
      ],
      max_tokens,
      stream: true,
      temperature: 0.7
    };

    console.log('🚀 发送请求到GLM API...');

    // 发送请求到GLM API（增加超时时间到120秒，适配文档处理）
    const response = await axios({
      method: 'post',
      url: GLM_API_URL,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      data: requestData,
      responseType: 'stream',
      timeout: 120000  // 120秒超时，给模型更多时间处理文档
    });

    // 更稳健的 SSE 解析：基于双换行分割事件，处理分片与多事件合并
    let textBuffer = '';
    response.data.on('data', (chunk) => {
      textBuffer += chunk.toString();

      // 完整事件按双换行分割，最后一段可能是残缺的，保留到下次
      const parts = textBuffer.split('\n\n');
      textBuffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.trim()) continue;

        // 收集所有以 'data: ' 开头的行
        const lines = part.split('\n');
        const dataLines = lines.filter(l => l.startsWith('data: ')).map(l => l.slice(6));
        if (dataLines.length === 0) continue;

        const data = dataLines.join('\n');

        if (data === '[DONE]') {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          console.log('✅ 流式传输完成');
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
          }
        } catch (e) {
          // 不是 JSON，则当作文本片段直接透传，避免日志噪声
          const trimmed = data.trim();
          if (trimmed) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: trimmed })}\n\n`);
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
      console.error('响应头:', error.response.headers);
      console.error('完整响应数据:', JSON.stringify(error.response.data, null, 2));
      
      // 尝试获取更详细的错误信息
      if (error.response.data) {
        console.error('错误详情:', error.response.data.error || error.response.data);
      }
    }
    
    res.status(500).json({
      error: '调用AI服务失败',
      details: error.message,
      apiError: error.response?.data || null
    });
  }
});

// 普通聊天接口（非流式，备用）
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'glm-4.6v' } = req.body;

    console.log('📨 收到消息（非流式）:', message);

    const response = await axios.post(GLM_API_URL, {
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
      timeout: 120000  // 120秒超时
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
    service: 'GLM-4V Chat API Proxy'
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