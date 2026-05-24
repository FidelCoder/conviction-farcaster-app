"use client";

import { useEffect } from "react";

export function MiniAppReady() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const isMiniAppLaunch =
      url.searchParams.get("miniApp") === "true" ||
      url.searchParams.get("miniapp") === "true" ||
      window.parent !== window;

    if (!isMiniAppLaunch) {
      return;
    }

    let isMounted = true;

    void import("@farcaster/miniapp-sdk")
      .then(({ sdk }) => {
        if (isMounted) {
          void sdk.actions.ready();
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
