import axios from 'axios';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

export const sendAIChatMessage = async (
  messages: ChatMessage[],
  _context?: string
): Promise<string> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    logger.warn('OpenAI API key not configured, returning mock response');
    return 'Xin lỗi, dịch vụ AI đang tạm thời không khả dụng.';
  }

  try {
    const response = await axios.post<OpenAIChatCompletionResponse>(
      `${baseURL}/chat/completions`,
      {
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    return response.data.choices[0]?.message?.content || 'Xin lỗi, tôi không thể trả lời lúc này.';
  } catch (error: unknown) {
    logger.error({ error: errorMessage(error) }, 'Error calling OpenAI API');
    return 'Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu của bạn.';
  }
};

export const getAIPromptForContext = async (context?: string): Promise<string> => {
  if (context) {
    const template = await prisma.aIPromptTemplate.findFirst({
      where: { name: context, isActive: true },
    });
    if (template) return template.content;
  }

  const defaultTemplate = await prisma.aIPromptTemplate.findFirst({
    where: { name: 'default', isActive: true },
  });

  return defaultTemplate?.content || `Bạn là trợ lý AI của Mini Marketplace. Hãy hỗ trợ người dùng về:
- Tìm kiếm và mua sản phẩm
- Thông tin tài khoản và đơn hàng
- Hỗ trợ kỹ thuật
- Các câu hỏi thường gặp

Hãy trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp.`;
};

export const processAIChat = async (
  userId: number,
  message: string,
  sessionId?: string,
  context?: string
) => {
  let session;

  if (sessionId) {
    session = await prisma.aIChatSession.findFirst({
      where: { id: Number(sessionId), userId },
    });
  }

  if (!session) {
    session = await prisma.aIChatSession.create({
      data: {
        userId,
        title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        context: context || 'default',
      },
    });
  }

  const history = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  });

  const systemPrompt = await getAIPromptForContext(context);

  const sanitizedMessage = message
    .replace(/<system>/gi, '[system]')
    .replace(/<\|system\|>/gi, '[system]')
    .replace(/ignore previous instructions/gi, '[redacted]')
    .slice(0, 2000);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: sanitizedMessage },
  ];
  const roomId = `ai-${session.id}`;

  const userMessage = await prisma.message.create({
    data: {
      roomId,
      sessionId: session.id,
      senderId: userId,
      receiverId: null,
      content: message,
      role: 'user',
    },
  });

  const aiResponse = await sendAIChatMessage(messages, context);

  const aiMessage = await prisma.message.create({
    data: {
      roomId,
      sessionId: session.id,
      content: aiResponse,
      role: 'assistant',
      senderId: null,
      receiverId: userId,
    },
  });

  await prisma.aIChatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return {
    sessionId: session.id,
    userMessage,
    aiMessage,
  };
};
