// Thin fetch wrappers for ExpertBot Pro API

import type { Account, Trade, BotConfig } from "./bot-types"

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(e.error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function apiLogin(
  email: string,
  platformToken: string,
  accountType: "demo" | "real"
): Promise<{ account: Account; token: string }> {
  return j(
    await fetch("/api/account/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, platformToken, accountType }),
    })
  )
}

export async function apiExecuteTrade(body: {
  accountId: string
  pair: string
  direction: "CALL" | "PUT"
  amount: number
  expirySec: number
  source: "manual" | "bot"
  strategy?: string | null
  entryPrice: number
}): Promise<{ trade: Trade }> {
  return j(
    await fetch("/api/trade/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

export async function apiSettleTrade(
  tradeId: string,
  exitPrice: number
): Promise<{ trade: Trade; won: boolean }> {
  return j(
    await fetch("/api/trade/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradeId, exitPrice }),
    })
  )
}

export async function apiOpenTrades(accountId: string): Promise<{ trades: Trade[] }> {
  return j(await fetch(`/api/trade/open/${accountId}`))
}

export async function apiHistory(
  accountId: string,
  limit = 50
): Promise<{ trades: Trade[] }> {
  return j(await fetch(`/api/trade/history/${accountId}?limit=${limit}`))
}

export async function apiSaveBotConfig(
  body: Partial<BotConfig> & { accountId: string }
): Promise<{ config: BotConfig }> {
  return j(
    await fetch("/api/bot/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

export async function apiGetBotConfig(
  accountId: string
): Promise<{ config: BotConfig | null }> {
  return j(await fetch(`/api/bot/config/${accountId}`))
}
