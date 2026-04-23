import { aiIsConfigured, generateAiReply } from './ai-client.js'

function trimText(value, maxLength = 4000) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function pickTemplate(templates = {}, names = []) {
  for (const name of names) {
    const body = trimText(templates?.[name]?.body)
    if (body) {
      return body
    }
  }

  return ''
}

export function buildOfflineAssistantReply({ settingsService, prompt = '' }) {
  const settings = settingsService.getSettings()
  const faq = settingsService.findFaqAnswer(prompt)
  if (faq) {
    return {
      mode: 'faq',
      text: faq.answer,
      matchedFaq: faq,
    }
  }

  const fallbackMode = settings.ai?.fallbackMode || 'handoff'
  if (fallbackMode === 'silent') {
    return {
      mode: 'silent',
      text: '',
      matchedFaq: null,
    }
  }

  const templates = settingsService.listTemplates()
  const templateNames =
    fallbackMode === 'template'
      ? ['fallback', 'handoff', 'welcome']
      : ['handoff', 'fallback', 'welcome']

  const templateText = pickTemplate(templates, templateNames)
  const text =
    templateText ||
    trimText(
      fallbackMode === 'template'
        ? settings.fallbackMessage || settings.handoffMessage
        : settings.handoffMessage || settings.fallbackMessage,
    )

  return {
    mode: templateText ? 'template' : fallbackMode,
    text,
    matchedFaq: null,
  }
}

export async function resolveAssistantReply({
  config,
  settingsService,
  prompt,
  context = '',
}) {
  const offlineReply = buildOfflineAssistantReply({
    settingsService,
    prompt,
  })

  if (!aiIsConfigured(config)) {
    return offlineReply
  }

  try {
    const text = await generateAiReply({
      config,
      prompt,
      context,
    })

    return {
      mode: 'ai',
      text,
      matchedFaq: offlineReply.matchedFaq || null,
    }
  } catch (error) {
    if (offlineReply.text) {
      return {
        ...offlineReply,
        warning: error instanceof Error ? error.message : String(error),
      }
    }

    throw error
  }
}
