const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const { processDocumentFile, summarizeDocument, SUPPORTED_DOC_TYPES } = require('./utils/fileProcessor');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 配置上传目录
const UPLOAD_BASE_DIR = path.join(__dirname, 'uploads');
const UPLOAD_DIRS = {
  images: path.join(UPLOAD_BASE_DIR, 'images'),
  pdfs: path.join(UPLOAD_BASE_DIR, 'pdfs'),
  audio: path.join(UPLOAD_BASE_DIR, 'audio'),
  others: path.join(UPLOAD_BASE_DIR, 'others')
};

// 创建上传目录
Object.values(UPLOAD_DIRS).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 允许访问上传的文件
app.use('/uploads', express.static(UPLOAD_BASE_DIR));

// SiliconFlow API配置
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1';
const API_KEY = process.env.SILICONFLOW_API_KEY;

if (!API_KEY) {
  console.error('❌ 错误：请在 .env 文件中设置 SILICONFLOW_API_KEY');
  console.error('示例：SILICONFLOW_API_KEY=sk-your-api-key-here');
  process.exit(1);
}

// 你是一个强大的多模态AI助手，基于Qwen-VL模型。
// 你可以理解和分析用户上传的图片、PDF等文件内容。
// 请根据用户上传的文件内容，提供准确的分析和回答。
// 当回答中包含数学公式时，请使用美元格式的LaTeX写法。
// 注意！！！禁止使用[]格式的latex格式。

// 系统提示
const SYSTEM_PROMPT = `
你是一个教材分析与学习辅助系统。
你的回答必须严格遵守以下规则：
1. 只能基于我提供的【教材内容】进行回答
2. 不得引入教材之外的知识、背景或常识
3. 如果教材内容不足以回答问题，必须明确说明“教材中未提及”
4. 回答应以教学清晰、逻辑严谨为目标
5. 不要编造定义、例子或结论
详细地将这本书的知识点进行总结，只能根据书中的内容做总结，生成知识图谱或者思维导图，每一个
书中涉及到的知识点都要讲到`;

// 支持的文件类型 - 使用对象来映射MIME类型到目录
const FILE_TYPE_MAP = {
  // 图像
  'image/jpeg': 'images',
  'image/jpg': 'images',
  'image/png': 'images',
  'image/gif': 'images',
  'image/webp': 'images',
  // PDF
  'application/pdf': 'pdfs',
  // Word文档 - 添加多种可能的MIME类型
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'others', // .docx
  'application/msword': 'others', // .doc
  'application/vnd.ms-word': 'others', // 备用 .doc
  'application/word': 'others', // 备用 .doc
  // 文本
  'text/plain': 'others',
  'text/markdown': 'others',
  'text/html': 'others',
  // 音频
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  // 其他可能类型
  'application/octet-stream': 'others'
};

const fixMimeType = (fileName, currentMimeType) => {
  const extension = path.extname(fileName).toLowerCase();
  
  const extensionToMimeType = {
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  
  if (currentMimeType === 'application/octet-stream' || 
      !FILE_TYPE_MAP[currentMimeType] || 
      currentMimeType === 'application/msword') {
    
    const correctMimeType = extensionToMimeType[extension];
    if (correctMimeType) {
      console.log(`🔄 修复MIME类型: ${fileName} (${currentMimeType} -> ${correctMimeType})`);
      return correctMimeType;
    }
  }
  
  return currentMimeType;
};

// 支持视觉分析的文件类型
const SUPPORTED_VISION_TYPES = {
  'image/jpeg': true,
  'image/jpg': true,
  'image/png': true,
  'image/gif': true,
  'image/webp': true
};

// 支持文档分析的文件类型
const SUPPORTED_DOCUMENT_TYPES = {
  'application/pdf': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true, // .docx
  'application/msword': true, // .doc
  'text/plain': true,
  'text/markdown': true,
  'text/html': true
};

// 生成安全的文件名
const generateFileName = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName || 'file');
  return `${timestamp}-${randomString}${ext}`;
};

// 文件名编码处理
const decodeFileName = (fileName) => {
  if (!fileName) return '未命名文件';
  
  try {
    if (Buffer.isBuffer(fileName)) {
      return fileName.toString('utf8');
    }
    
    if (typeof fileName === 'string') {
      const buffer = Buffer.from(fileName, 'binary');
      const encodings = ['utf8', 'latin1', 'gbk', 'gb2312'];
      for (const encoding of encodings) {
        try {
          const decoded = iconv.decode(buffer, encoding);
          if (/[\u4e00-\u9fa5]/.test(decoded) && decoded !== fileName) {
            return decoded;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return String(fileName);
  } catch (error) {
    return String(fileName || '未命名文件');
  }
};

// 然后修改 multer 的 storage 配置：
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 先修复MIME类型
    file.mimetype = fixMimeType(file.originalname, file.mimetype);
    const mimeType = file.mimetype;
    const fileType = FILE_TYPE_MAP[mimeType] || 'others';
    const destination = UPLOAD_DIRS[fileType] || UPLOAD_DIRS.others;
    cb(null, destination);
  },
  filename: (req, file, cb) => {
    const originalName = decodeFileName(file.originalname);
    const safeName = generateFileName(originalName);
    req.decodedFileName = originalName;
    cb(null, safeName);
  }
});

// 改进的 fileFilter 函数
const fileFilter = (req, file, cb) => {
  const mimeType = file.mimetype || '';
  const originalName = file.originalname || '';
  const extension = path.extname(originalName).toLowerCase();
  
  console.log('🔍 文件过滤器检查:', {
    originalName: originalName,
    mimeType: mimeType,
    extension: extension
  });
  
  // 检查MIME类型是否在支持列表中
  if (FILE_TYPE_MAP[mimeType]) {
    cb(null, true);
    return;
  }
  
  // 如果MIME类型是octet-stream或不正确，根据扩展名判断
  if (mimeType === 'application/octet-stream' || !FILE_TYPE_MAP[mimeType]) {
  const supportedExtensions = {
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',  // 确保这里正确
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  
  if (supportedExtensions[extension]) {
    // 修正MIME类型
    file.mimetype = supportedExtensions[extension];
    console.log(`🔄 修正MIME类型: ${originalName} (${extension}) -> ${file.mimetype}`);
    cb(null, true);
    return;
  }
}
  
  // 如果扩展名是支持的，即使MIME类型不匹配也允许
  const supportedExtensions = ['.docx', '.doc', '.pdf', '.txt', '.md', '.html', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
  if (supportedExtensions.includes(extension)) {
    console.log(`⚠️  通过扩展名接受文件: ${originalName} (${extension}), MIME类型: ${mimeType}`);
    cb(null, true);
    return;
  }
  
  console.log(`❌ 不支持的文件: ${originalName}, MIME类型: ${mimeType}, 扩展名: ${extension}`);
  cb(new Error(`不支持的文件类型: ${originalName} (${mimeType})`), false);
};

// 创建 multer 实例
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10
  }
});

// =============== 文件上传接口 ===============
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '请选择要上传的文件' 
      });
    }

    const file = req.file;
    const originalName = req.decodedFileName || file.originalname || '未命名文件';
    const mimeType = file.mimetype || 'application/octet-stream';
    const fileType = FILE_TYPE_MAP[mimeType] || 'others';
    const fileUrl = `/uploads/${fileType}/${file.filename}`;
    const fullUrl = `http://localhost:${port}${fileUrl}`;

    console.log('📁 文件上传成功:', {
      名称: originalName,
      大小: formatFileSize(file.size),
      类型: mimeType,
      目录: fileType
    });

    const supportedByVision = !!SUPPORTED_VISION_TYPES[mimeType] || 
                             !!SUPPORTED_DOCUMENT_TYPES[mimeType];

    res.json({
      success: true,
      file: {
        id: file.filename,
        name: originalName,
        size: file.size,
        type: mimeType,
        category: fileType,
        url: fullUrl,
        path: fileUrl,
        deepSeekReady: supportedByVision,
        supportedByDeepSeek: supportedByVision,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ 文件上传错误:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || '文件上传失败' 
    });
  }
});

app.post('/api/upload/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '请选择要上传的文件' 
      });
    }

    const files = req.files.map((file) => {
      const originalName = decodeFileName(file.originalname);
      const mimeType = file.mimetype || 'application/octet-stream';
      const fileType = FILE_TYPE_MAP[mimeType] || 'others';
      const fileUrl = `/uploads/${fileType}/${file.filename}`;
      const fullUrl = `http://localhost:${port}${fileUrl}`;
      
      const supportedByVision = !!SUPPORTED_VISION_TYPES[mimeType] || 
                               !!SUPPORTED_DOCUMENT_TYPES[mimeType];
      
      return {
        id: file.filename,
        name: originalName,
        size: file.size,
        type: mimeType,
        category: fileType,
        url: fullUrl,
        path: fileUrl,
        deepSeekReady: supportedByVision,
        supportedByDeepSeek: supportedByVision,
        uploadedAt: new Date().toISOString()
      };
    });

    console.log(`📁 批量上传 ${files.length} 个文件成功`);

    res.json({
      success: true,
      files: files
    });

  } catch (error) {
    console.error('❌ 批量上传错误:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || '文件上传失败' 
    });
  }
});

// =============== 主要聊天接口 ===============
// =============== 主要聊天接口 ===============
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { 
      message, 
      model = 'Qwen/Qwen2.5-72B-Instruct',
      max_tokens = 4000, 
      files = [] 
    } = req.body;

    console.log('📨 收到消息:', message?.substring(0, 100));
    console.log('📁 附带文件数量:', files?.length || 0);
    console.log('🤖 使用模型:', model);
    
    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      }
    ];

    if (files && files.length > 0) {
      const userContent = [];
      let hasImages = false;
      let hasDocuments = false;
      
      for (const file of files) {
        // 处理图片
        if (file.supportedByDeepSeek && file.type && file.type.startsWith('image/')) {
          try {
            console.log('🖼️ 处理图片:', file.name);
            
            let filePath = '';
            if (file.path) {
              filePath = path.join(__dirname, file.path);
            } else if (file.url && file.url.includes('/uploads/')) {
              const urlParts = file.url.split('/uploads/');
              if (urlParts.length > 1) {
                const relativePath = '/uploads/' + urlParts[1];
                filePath = path.join(__dirname, relativePath);
              }
            }
            
            if (filePath && fs.existsSync(filePath)) {
              const imageBuffer = await fs.promises.readFile(filePath);
              const mimeType = file.type || 'image/png';
              const base64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
              
              userContent.push({
                type: 'image_url',
                image_url: {
                  url: base64
                }
              });
              
              hasImages = true;
              console.log('✅ 图片处理完成:', file.name);
            } else {
              console.warn('❌ 图片文件不存在:', filePath);
              userContent.push({
                type: 'text',
                text: `[图片: ${file.name} - 文件未找到]`
              });
            }
          } catch (error) {
            console.error('❌ 处理图片失败:', file.name, error);
            userContent.push({
              type: 'text',
              text: `[图片: ${file.name} - 处理失败: ${error.message}]`
            });
          }
        }
        // 处理文档（包括 PDF、Word、文本文件等）
        else if (file.type === 'application/pdf' || 
                 file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                 file.type === 'application/msword' ||
                 file.type === 'text/plain' ||
                 file.type === 'text/markdown' ||
                 file.type === 'text/html') {
          
          try {
            console.log('📄 处理文档:', file.name, '类型:', file.type);
            
            let filePath = '';
            if (file.path) {
              filePath = path.join(__dirname, file.path);
            } else if (file.url && file.url.includes('/uploads/')) {
              const urlParts = file.url.split('/uploads/');
              if (urlParts.length > 1) {
                const relativePath = '/uploads/' + urlParts[1];
                filePath = path.join(__dirname, relativePath);
              }
            }
            
            if (filePath && fs.existsSync(filePath)) {
              // 统一使用 processDocumentFile 处理所有文档类型
              const result = await processDocumentFile(filePath, file.type);
              
              if (result.success) {
                // 准备文档内容
                let fileContent = result.text;
                
                // 添加文档信息
                let docInfo = `【${file.name} 内容】\n`;
                
                if (file.type === 'application/pdf' && result.pages) {
                  docInfo += `📄 共 ${result.pages} 页\n\n`;
                } else if ((file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                           file.type === 'application/msword') && result.messages) {
                  docInfo += `📝 Word文档\n\n`;
                }
                
                userContent.push({
                  type: 'text',
                  text: docInfo + fileContent + '\n【文件结束】'
                });
                
                hasDocuments = true;
                console.log(`✅ ${file.type}提取成功，字符数: ${fileContent.length}`);
              } else {
                console.error('❌ 文档提取失败:', result.error);
                userContent.push({
                  type: 'text',
                  text: `[文档: ${file.name} - 解析失败: ${result.error}]`
                });
              }
            } else {
              console.warn('❌ 文档文件不存在:', filePath);
              userContent.push({
                type: 'text',
                text: `[文档: ${file.name} - 文件未找到]`
              });
            }
          } catch (error) {
            console.error('❌ 处理文档失败:', file.name, error);
            userContent.push({
              type: 'text',
              text: `[文档: ${file.name} - 处理失败: ${error.message}]`
            });
          }
        }
        else {
          userContent.push({
            type: 'text',
            text: `[文件: ${file.name} - 类型: ${file.type}]`
          });
        }
      }
      
      if (message) {
        userContent.push({
          type: 'text',
          text: message
        });
      }
      
      if (!hasImages && !hasDocuments && userContent.length === 0) {
        userContent.push({
          type: 'text',
          text: '请分析这些文件内容'
        });
      }
      
      messages.push({
        role: 'user',
        content: userContent
      });
      
      console.log(`📤 构建消息，包含: ${userContent.filter(item => item.type === 'image_url').length}张图片, 
        ${userContent.filter(item => item.type === 'text' && item.text.includes('【')).length}个文档`);
      
    } else {
      let userText = message || '';
      messages.push({
        role: 'user',
        content: [{ type: 'text', text: userText }]
      });
    }

    if (!message && (!files || files.length === 0)) {
      return res.status(400).json({
        error: '消息内容不能为空'
      });
    }

    console.log('🚀 发送请求到SiliconFlow API...');
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no');

    const requestData = {
      model: model,
      messages: messages,
      max_tokens: max_tokens,
      stream: true,
      temperature: 0.7
    };

    try {
      const response = await axios({
        method: 'post',
        url: `${SILICONFLOW_API_URL}/chat/completions`,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        data: requestData,
        responseType: 'stream',
        timeout: 120000
      });

      let buffer = '';
      
      response.data.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
              res.end();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.choices && parsed.choices[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                res.write(`data: ${JSON.stringify({ 
                  type: 'chunk', 
                  content: content
                })}\n\n`);
              }
            } catch (e) {
              console.warn('解析JSON失败:', e.message, '原始数据:', data);
            }
          }
        }
      });

      response.data.on('end', () => {
        console.log('🔚 流式响应结束');
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      });

      response.data.on('error', (error) => {
        console.error('❌ 流式传输错误:', error.message);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: '流式传输错误: ' + error.message
        })}\n\n`);
        res.end();
      });

    } catch (apiError) {
      console.error('❌ API请求失败:', apiError.message);
      
      let errorMessage = 'API请求失败';
      if (apiError.response) {
        console.error('响应状态:', apiError.response.status);
        console.error('响应数据:', apiError.response.data);
        errorMessage = `API错误: ${apiError.response.status} - ${JSON.stringify(apiError.response.data)}`;
      }
      
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: errorMessage
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('❌ 服务器错误:', error.message);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: '服务器错误: ' + error.message
    })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
});

// =============== 其他接口 ===============
app.get('/api/models', (req, res) => {
  res.json({
    models: [
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'Qwen2.5-72B',
        description: '纯文本语言模型',
        max_tokens: 32768,
        vision: false,
        supports: ['文本对话', '代码生成']
      },
      {
        id: 'Qwen/Qwen2.5-VL-72B-Instruct',
        name: 'Qwen2.5-VL-72B',
        description: '视觉语言模型（需要配置图片base64）',
        max_tokens: 8192,
        vision: true,
        supports: ['图像识别', '文本理解']
      }
    ]
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Qwen Chat API',
    uploadsEnabled: true,
    apiKeyConfigured: !!API_KEY,
    port: port
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'Qwen/Qwen2.5-72B-Instruct' } = req.body;

    console.log('📨 收到消息（非流式）:', message);

    const response = await axios.post(`${SILICONFLOW_API_URL}/chat/completions`, {
      model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: [{ type: 'text', text: message }]
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
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

app.get('/api/debug/test-api', async (req, res) => {
  try {
    const response = await axios.post(`${SILICONFLOW_API_URL}/chat/completions`, {
      model: 'Qwen/Qwen2.5-72B-Instruct',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello, say hi if you can see this message.' }]
        }
      ],
      max_tokens: 100,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      message: 'API连接正常',
      response: response.data.choices[0].message.content,
      model: response.data.model
    });
  } catch (error) {
    console.error('❌ API测试失败:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message,
      status: error.response?.status
    });
  }
});

app.get('/api/files', (req, res) => {
  const files = [];
  
  Object.keys(UPLOAD_DIRS).forEach(category => {
    const dir = UPLOAD_DIRS[category];
    if (fs.existsSync(dir)) {
      const dirFiles = fs.readdirSync(dir);
      dirFiles.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        files.push({
          name: file,
          category: category,
          size: stats.size,
          created: stats.birthtime,
          url: `http://localhost:${port}/uploads/${category}/${file}`
        });
      });
    }
  });
  
  res.json({
    success: true,
    count: files.length,
    files: files
  });
});

app.listen(port, () => {
  console.log(`🚀 后端服务器运行在 http://localhost:${port}`);
  console.log(`📡 可用端点:`);
  console.log(`   - 健康检查: GET http://localhost:${port}/api/health`);
  console.log(`   - 流式聊天: POST http://localhost:${port}/api/chat/stream`);
  console.log(`   - 普通聊天: POST http://localhost:${port}/api/chat`);
  console.log(`   - 文件上传: POST http://localhost:${port}/api/upload`);
  console.log(`   - 批量上传: POST http://localhost:${port}/api/upload/multiple`);
  console.log(`   - 模型列表: GET http://localhost:${port}/api/models`);
  console.log(`   - 文件列表: GET http://localhost:${port}/api/files`);
  console.log(`📁 上传目录: ${UPLOAD_BASE_DIR}`);
  console.log(`🔑 API密钥状态: ${API_KEY ? '已设置 ✓' : '未设置 ✗'}`);
});

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}