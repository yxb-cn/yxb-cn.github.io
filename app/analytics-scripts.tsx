"use client";

import Script from "next/script";
import { useCallback, useRef } from "react";
import type { SiteContent } from "./site-content";

declare global {
  interface Window {
    LA?: {
      init: (configuration: {
        id: string;
        ck: string;
        hashMode: boolean;
      }) => void;
    };
  }
}

export function AnalyticsScripts({
  analytics,
}: {
  analytics: SiteContent["analytics"];
}) {
  const initialized51La = useRef("");
  const umami = analytics.providers.umami;
  const fiftyOneLa = analytics.providers.fiftyOneLa;
  const loadUmami =
    analytics.enabled &&
    umami.enabled &&
    Boolean(umami.scriptUrl.trim()) &&
    Boolean(umami.websiteId.trim());
  const load51La =
    analytics.enabled &&
    fiftyOneLa.enabled &&
    Boolean(fiftyOneLa.scriptUrl.trim()) &&
    Boolean(fiftyOneLa.siteId.trim()) &&
    Boolean(fiftyOneLa.ck.trim());

  const initialize51La = useCallback(() => {
    if (!window.LA?.init) {
      return;
    }

    const configurationKey = [
      fiftyOneLa.siteId,
      fiftyOneLa.ck,
      String(fiftyOneLa.hashMode),
    ].join(":");
    if (initialized51La.current === configurationKey) {
      return;
    }

    window.LA.init({
      id: fiftyOneLa.siteId,
      ck: fiftyOneLa.ck,
      hashMode: fiftyOneLa.hashMode,
    });
    initialized51La.current = configurationKey;
  }, [fiftyOneLa.ck, fiftyOneLa.hashMode, fiftyOneLa.siteId]);

  return (
    <>
      {loadUmami && (
        <Script
          id="umami-analytics"
          strategy="afterInteractive"
          src={umami.scriptUrl}
          data-website-id={umami.websiteId}
        />
      )}
      {load51La && (
        <Script
          id="LA_COLLECT"
          charSet="UTF-8"
          strategy="afterInteractive"
          src={fiftyOneLa.scriptUrl}
          onReady={initialize51La}
        />
      )}
    </>
  );
}
