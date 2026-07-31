/// <reference types="vite/client" />
import { PeriodDays, UsageSummaryResponse } from '../types/analytics';

const BASE_URL = 'https://stripe-backend-cowwwkwqaq-el.a.run.app';
const DEFAULT_SECRET = '72537ce6094b43d88c6d6958b9a101a0f6de7a9bd848e07bfa71b503cf442fa8';

export interface ApiError {
  status?: number;
  message: string;
  type: 'auth' | 'server' | 'network' | 'unknown';
}

export async function fetchUsageSummary(days: PeriodDays = 30): Promise<UsageSummaryResponse> {
  const secret = import.meta.env.VITE_ADMIN_SECRET || DEFAULT_SECRET;
  const url = `${BASE_URL}/admin/usage-summary?days=${days}`;

  try {
    const controller = new AbortController();
    // Allow up to 60 seconds since analytics generation takes 15-20s on production backend
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Internal-Secret': secret,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[Analytics API HTTP Error]', {
        status: response.status,
        statusText: response.statusText,
        url,
      });

      if (response.status === 403) {
        throw {
          status: 403,
          message: 'Access Forbidden (403). The X-Internal-Secret header is invalid or missing.',
          type: 'auth',
        } as ApiError;
      }
      if (response.status >= 500) {
        throw {
          status: response.status,
          message: `Server Error (${response.status}). The analytics backend encountered an internal exception.`,
          type: 'server',
        } as ApiError;
      }
      throw {
        status: response.status,
        message: `HTTP Error ${response.status}: ${response.statusText}`,
        type: 'unknown',
      } as ApiError;
    }

    const data: UsageSummaryResponse = await response.json();
    return data;
  } catch (err: unknown) {
    console.error('[Analytics API Fetch Failure Details]', {
      url,
      errorName: err instanceof Error ? err.name : undefined,
      errorMessage: err instanceof Error ? err.message : String(err),
      rawError: err,
    });

    if (err && typeof err === 'object' && 'type' in err) {
      throw err;
    }

    const isAbort = err instanceof Error && err.name === 'AbortError';

    throw {
      message: isAbort
        ? 'Request timed out after 60s. The analytics report generation took longer than expected.'
        : err instanceof Error ? err.message : 'Failed to connect to the backend analytics server.',
      type: 'network',
    } as ApiError;
  }
}
