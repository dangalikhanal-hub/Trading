/**
 * MTrade - Production Security Middleware & Request Validation Engine
 * 
 * Features:
 * 1. HMAC-SHA256 API Signature Verification with Replay Attack Protection (recvWindow)
 * 2. High-Performance Token Bucket Rate Limiter with Endpoint Weighting
 * 3. Session Revocation & API Key Scopes Enforcement
 */

import * as crypto from 'crypto';

// ============================================================================
// 1. HMAC-SHA256 SIGNATURE VERIFIER
// ============================================================================

export interface SignedRequestHeaders {
  'x-mtrade-apikey': string;
  'x-mtrade-signature': string;
  'x-mtrade-timestamp': string; // Epoch milliseconds
  'x-mtrade-recvwindow'?: string; // Optional tolerance window (default 5000ms)
}

export interface ApiKeyRecord {
  apiKey: string;
  apiSecret: string;
  userId: string;
  permissions: ('READ' | 'TRADE' | 'WITHDRAW')[];
  ipWhitelist?: string[];
  rateLimitTier: 'RETAIL' | 'VIP' | 'MM_MAKER';
  isActive: boolean;
}

export class HmacSignatureValidator {
  private readonly DEFAULT_RECV_WINDOW_MS = 5000;
  private readonly MAX_RECV_WINDOW_MS = 60000;

  /**
   * Builds the canonical payload string to be hashed
   * Format: HTTP_METHOD + PATH + SORTED_QUERY_PARAMS + BODY + TIMESTAMP
   */
  public buildCanonicalPayload(
    method: string,
    path: string,
    queryParams: Record<string, string | number>,
    body: string,
    timestamp: number
  ): string {
    // Sort query parameters alphabetically to enforce canonical format
    const sortedKeys = Object.keys(queryParams).sort();
    const queryString = sortedKeys
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(queryParams[key]))}`)
      .join('&');

    return `${method.toUpperCase()}|${path}|${queryString}|${body}|${timestamp}`;
  }

  /**
   * Generates HMAC-SHA256 hex signature
   */
  public generateSignature(payload: string, apiSecret: string): string {
    return crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  }

  /**
   * Validates an incoming request's timestamp and cryptographic signature
   */
  public validateRequest(
    method: string,
    path: string,
    queryParams: Record<string, string | number>,
    body: string,
    headers: SignedRequestHeaders,
    keyRecord: ApiKeyRecord,
    clientIp: string
  ): { isValid: boolean; error?: string } {
    if (!keyRecord.isActive) {
      return { isValid: false, error: 'API_KEY_REVOKED_OR_DISABLED' };
    }

    // IP Whitelist verification (if configured)
    if (keyRecord.ipWhitelist && keyRecord.ipWhitelist.length > 0) {
      if (!keyRecord.ipWhitelist.includes(clientIp)) {
        return { isValid: false, error: 'IP_NOT_AUTHORIZED_ON_API_KEY' };
      }
    }

    const timestamp = parseInt(headers['x-mtrade-timestamp'], 10);
    if (isNaN(timestamp)) {
      return { isValid: false, error: 'INVALID_TIMESTAMP_HEADER' };
    }

    const recvWindow = Math.min(
      parseInt(headers['x-mtrade-recvwindow'] || String(this.DEFAULT_RECV_WINDOW_MS), 10),
      this.MAX_RECV_WINDOW_MS
    );

    const currentTime = Date.now();

    // Replay attack prevention: verify timestamp is within valid window
    // (timestamp must not be in future > 1000ms, and not older than recvWindow)
    if (timestamp > currentTime + 1000) {
      return { isValid: false, error: 'TIMESTAMP_AHEAD_OF_SERVER_TIME' };
    }
    if (currentTime - timestamp > recvWindow) {
      return { isValid: false, error: `REQUEST_EXPIRED: Timestamp is outside recvWindow (${recvWindow}ms)` };
    }

    // Compute expected signature
    const payload = this.buildCanonicalPayload(method, path, queryParams, body, timestamp);
    const expectedSignature = this.generateSignature(payload, keyRecord.apiSecret);

    // Constant-time string comparison to prevent timing attacks
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(headers['x-mtrade-signature'] || '', 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    );

    if (!isSignatureValid) {
      return { isValid: false, error: 'INVALID_HMAC_SIGNATURE' };
    }

    return { isValid: true };
  }
}

// ============================================================================
// 2. TOKEN BUCKET RATE LIMITER WITH ENDPOINT WEIGHTING
// ============================================================================

export interface RateLimitBucket {
  tokens: number;
  lastRefillTime: number;
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();

  // Tier capacities (tokens per minute)
  private tierLimits = {
    RETAIL: { capacity: 1200, refillRatePerSec: 20 },      // 1200 / min
    VIP: { capacity: 3600, refillRatePerSec: 60 },         // 3600 / min
    MM_MAKER: { capacity: 12000, refillRatePerSec: 200 },  // 12000 / min
  };

  /**
   * Consumes tokens for a given key (API Key or Client IP).
   * @param key Unique identifier (e.g., apiKey or clientIp)
   * @param tier Rate limit tier
   * @param weight Endpoint cost (e.g., POST /order = 5, GET /order = 1)
   */
  public consume(
    key: string,
    tier: 'RETAIL' | 'VIP' | 'MM_MAKER' = 'RETAIL',
    weight: number = 1
  ): { allowed: boolean; remainingTokens: number; retryAfterSeconds?: number } {
    const config = this.tierLimits[tier];
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: config.capacity, lastRefillTime: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
    bucket.tokens = Math.min(config.capacity, bucket.tokens + elapsedSeconds * config.refillRatePerSec);
    bucket.lastRefillTime = now;

    // Check availability
    if (bucket.tokens >= weight) {
      bucket.tokens -= weight;
      return { allowed: true, remainingTokens: Math.floor(bucket.tokens) };
    } else {
      const neededTokens = weight - bucket.tokens;
      const retryAfterSeconds = Math.ceil(neededTokens / config.refillRatePerSec);
      return {
        allowed: false,
        remainingTokens: 0,
        retryAfterSeconds
      };
    }
  }

  /**
   * Periodic garbage collection of dormant buckets
   */
  public cleanup(maxIdleMinutes: number = 30): void {
    const threshold = Date.now() - maxIdleMinutes * 60 * 1000;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastRefillTime < threshold) {
        this.buckets.delete(key);
      }
    }
  }
}
