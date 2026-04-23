function parseAiText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  const messageText = payload?.choices?.[0]?.message?.content
  if (typeof messageText === 'string' && messageText.trim()) {
    return messageText.trim()
  }

  if (Array.isArray(messageText)) {
    const text = messageText
      .map((entry) => entry?.text || entry?.content || '')
      .join('\n')
      .trim()

    if (text) {
      return text
    }
  }

  const output = payload?.output?.[0]?.content
  if (Array.isArray(output)) {
    const text = output
      .map((entry) => entry?.text || '')
      .join('\n')
      .trim()

    if (text) {
      return text
    }
  }

  return ''
}

function isLocalAiEndpoint(value) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(String(value || ''))
}

export function aiIsConfigured(config) {
  if (config.aiEnabled === false) {
    return false
  }

  return Boolean(config.aiBaseUrl && config.aiModel && (config.aiApiKey || isLocalAiEndpoint(config.aiBaseUrl)))
}

export async function generateAiReply({ config, prompt, context }) {
  if (!prompt?.trim()) {
    throw new Error('Teks untuk AI tidak boleh kosong.')
  }

  if (!config.aiBaseUrl || !config.aiModel) {
    throw new Error('AI belum dikonfigurasi. Isi AI_BASE_URL dan AI_MODEL terlebih dahulu.')
  }

  if (!config.aiApiKey && !isLocalAiEndpoint(config.aiBaseUrl)) {
    throw new Error('AI belum aktif. Isi AI_API_KEY di konfigurasi bot atau pakai endpoint AI lokal.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const headers = {
      'content-type': 'application/json',
    }

    if (config.aiApiKey) {
      headers.authorization = `Bearer ${config.aiApiKey}`
    }

    if (String(config.aiBaseUrl).includes('openrouter.ai')) {
      headers['http-referer'] = config.websiteUrl
      headers['x-title'] = config.botName
    }

    const response = await fetch(config.aiBaseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.aiModel,
        temperature: 0.7,
        max_tokens: Number(config.aiMaxResponseLength || 400),
        messages: [
          {
            role: 'system',
            content: [
              config.aiSystemPrompt,
              config.aiTone ? `Tone: ${config.aiTone}.` : '',
              config.aiReplyStyle ? `Gaya balasan: ${config.aiReplyStyle}.` : '',
              config.aiEscalationRules ? `Aturan eskalasi: ${config.aiEscalationRules}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          ...(context
            ? [
                {
                  role: 'system',
                  content: `Konteks percakapan:\n${context}`,
                },
              ]
            : []),
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        `Request AI gagal dengan status ${response.status}.`
      throw new Error(message)
    }

    const text = parseAiText(payload)
    if (!text) {
      throw new Error('AI tidak mengembalikan teks balasan.')
    }

    return text
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request AI timeout. Coba lagi dalam beberapa detik.')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}
