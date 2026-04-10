import crypto from 'crypto';
import { EventEmitter } from 'events';
import { getConfig } from '../config/alertConfig.js';

const webhookEmitter = new EventEmitter();
const MAX_HISTORY = 50;
const webhookHistory = [];

function normalizeEventList(eventTypes = []) {
  if (!Array.isArray(eventTypes)) return [];
  return eventTypes
    .map((type) => String(type || '').trim())
    .filter(Boolean);
}

function getMatchingWebhooks(eventType) {
  const config = getConfig();
  const items = config.webhooks?.items || [];

  return items.filter((webhook) => {
    if (!webhook?.enabled || !webhook?.url) return false;

    const eventTypes = normalizeEventList(webhook.eventTypes);
    if (eventTypes.length === 0) return false;

    return eventTypes.includes('*') || eventTypes.includes(eventType);
  });
}

function recordHistory(entry) {
  webhookHistory.unshift(entry);

  if (webhookHistory.length > MAX_HISTORY) {
    webhookHistory.length = MAX_HISTORY;
  }

  webhookEmitter.emit('delivery', entry);
}

function signPayload(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function buildPayload(eventType, data, meta = {}) {
  return {
    source: 'StreamSync',
    timestamp: new Date().toISOString(),
    eventType,
    user: data?.uniqueId || data?.user?.uniqueId || 'unknown',
    data,
    meta,
  };
}

async function deliverWebhook(webhook, payload, timeoutMs, meta = {}) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const method = String(webhook.method || 'POST').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'StreamSync/1.0',
    'X-StreamSync-Event': payload.eventType,
    ...(webhook.headers && typeof webhook.headers === 'object' ? webhook.headers : {}),
  };

  const body = JSON.stringify(payload);

  if (webhook.secret) {
    headers['X-StreamSync-Signature'] = signPayload(webhook.secret, body);
  }

  const requestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (!['GET', 'HEAD'].includes(method)) {
    requestInit.body = body;
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(webhook.url, requestInit);
    const responseText = await response.text();
    const durationMs = Date.now() - startedAt;

    const historyEntry = {
      id: `${webhook.id || 'webhook'}_${startedAt}`,
      createdAt: startedAt,
      webhookId: webhook.id,
      webhookName: webhook.name || webhook.url,
      url: webhook.url,
      eventType: payload.eventType,
      status: response.ok ? 'success' : 'error',
      ok: response.ok,
      httpStatus: response.status,
      durationMs,
      test: Boolean(meta.test),
      responseSnippet: responseText.slice(0, 280),
    };

    recordHistory(historyEntry);
    return historyEntry;
  } catch (error) {
    const historyEntry = {
      id: `${webhook.id || 'webhook'}_${startedAt}`,
      createdAt: startedAt,
      webhookId: webhook.id,
      webhookName: webhook.name || webhook.url,
      url: webhook.url,
      eventType: payload.eventType,
      status: 'error',
      ok: false,
      httpStatus: null,
      durationMs: Date.now() - startedAt,
      test: Boolean(meta.test),
      error: error?.name === 'AbortError' ? 'Timeout' : error?.message || 'Unknown error',
    };

    recordHistory(historyEntry);
    return historyEntry;
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchWebhooks(eventType, data, meta = {}) {
  const config = getConfig();
  const timeoutMs = config.webhooks?.timeoutMs || 8000;
  const webhooks = getMatchingWebhooks(eventType);

  if (webhooks.length === 0) {
    return [];
  }

  const payload = buildPayload(eventType, data, meta);
  return Promise.all(webhooks.map((webhook) => deliverWebhook(webhook, payload, timeoutMs, meta)));
}

export async function sendTestWebhook(webhookId) {
  const config = getConfig();
  const timeoutMs = config.webhooks?.timeoutMs || 8000;
  const webhook = (config.webhooks?.items || []).find((item) => item.id === webhookId);

  if (!webhook) {
    throw new Error('Webhook no encontrado');
  }

  if (!webhook.url) {
    throw new Error('El webhook no tiene URL configurada');
  }

  const sampleData = {
    uniqueId: 'streamsync_preview',
    giftName: 'Galaxy',
    repeatCount: 1,
    diamondCount: 1000,
    comment: 'Mensaje de prueba desde StreamSync',
  };

  const payload = buildPayload('test', sampleData, {
    test: true,
    webhookId,
  });

  return deliverWebhook(webhook, payload, timeoutMs, { test: true });
}

export function getWebhookHistory(limit = 25) {
  return webhookHistory.slice(0, limit);
}

export function getWebhookEmitter() {
  return webhookEmitter;
}
