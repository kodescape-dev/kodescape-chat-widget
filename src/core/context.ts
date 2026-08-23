import type { ContextPayload, DeviceType } from './types';

const URL_MAX = 2000;
const TITLE_MAX = 300;
const SHORT_MAX = 100;

export function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export interface ClientInfo {
  browser: string;
  os: string;
  deviceType: DeviceType;
}

export function detectClientInfo(userAgent: string): ClientInfo {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Other';

  const os = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iOS'
    : /Windows/.test(userAgent)
      ? 'Windows'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Android/.test(userAgent)
          ? 'Android'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Other';

  const isTablet =
    /iPad/.test(userAgent) ||
    (/Android/.test(userAgent) && !/Mobile/.test(userAgent));
  const isMobile = !isTablet && /Mobi|iPhone|Android/.test(userAgent);
  const deviceType: DeviceType = isTablet
    ? 'tablet'
    : isMobile
      ? 'mobile'
      : 'desktop';

  return { browser, os, deviceType };
}

export function buildContextPayload(input: {
  currentUrl: string;
  currentPageTitle: string;
  initialUrl: string;
  referrer: string;
  userAgent: string;
  timezone: string;
}): ContextPayload {
  const client = detectClientInfo(input.userAgent);
  return {
    currentUrl: truncate(input.currentUrl, URL_MAX),
    currentPageTitle: truncate(input.currentPageTitle, TITLE_MAX),
    initialUrl: truncate(input.initialUrl, URL_MAX),
    referrer: truncate(input.referrer, URL_MAX),
    browser: truncate(client.browser, SHORT_MAX),
    os: truncate(client.os, SHORT_MAX),
    deviceType: client.deviceType,
    timezone: truncate(input.timezone, SHORT_MAX),
  };
}

export function contextDedupeKey(payload: ContextPayload): string {
  return `${payload.currentUrl ?? ''} ${payload.currentPageTitle ?? ''}`;
}
