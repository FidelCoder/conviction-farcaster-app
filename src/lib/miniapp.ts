const DEFAULT_APP_NAME = "Conviction Markets";
const DEFAULT_APP_URL = "http://localhost:3001";
const SPLASH_BACKGROUND_COLOR = "#f7f7f2";

export type MiniAppEmbed = {
  version: "1";
  imageUrl: string;
  button: {
    title: string;
    action: {
      type: "launch_miniapp";
      url: string;
      name: string;
      splashImageUrl: string;
      splashBackgroundColor: string;
    };
  };
};

export function getAppName() {
  return process.env.NEXT_PUBLIC_APP_NAME ?? DEFAULT_APP_NAME;
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? DEFAULT_APP_URL).replace(
    /\/$/,
    "",
  );
}

export function getAbsoluteAppUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : "/" + path;

  return getAppUrl() + normalizedPath;
}

export function getMiniAppIconUrl() {
  return getAbsoluteAppUrl("/api/miniapp-icon");
}

export function getMiniAppSplashImageUrl() {
  return getAbsoluteAppUrl("/api/miniapp-icon?size=splash");
}

export function getMiniAppImagePath(
  type: "home" | "signal" | "position" | "leaderboard",
  id?: string,
) {
  const params = new URLSearchParams({ type });

  if (id) {
    params.set("id", id);
  }

  return "/api/miniapp-image?" + params.toString();
}

export function createMiniAppEmbed(options: {
  imagePath: string;
  targetPath: string;
  buttonTitle: string;
}) {
  return {
    version: "1",
    imageUrl: getAbsoluteAppUrl(options.imagePath),
    button: {
      title: truncateButtonTitle(options.buttonTitle),
      action: {
        type: "launch_miniapp",
        url: getAbsoluteAppUrl(options.targetPath),
        name: truncateAppName(getAppName()),
        splashImageUrl: getMiniAppSplashImageUrl(),
        splashBackgroundColor: SPLASH_BACKGROUND_COLOR,
      },
    },
  } satisfies MiniAppEmbed;
}

export function createMiniAppPageMetadata(options: {
  title: string;
  description: string;
  imagePath: string;
  targetPath: string;
  buttonTitle: string;
}) {
  const imageUrl = getAbsoluteAppUrl(options.imagePath);

  return {
    title: options.title,
    description: options.description,
    openGraph: {
      title: options.title,
      description: options.description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 800,
        },
      ],
    },
    other: {
      "fc:miniapp": JSON.stringify(
        createMiniAppEmbed({
          imagePath: options.imagePath,
          targetPath: options.targetPath,
          buttonTitle: options.buttonTitle,
        }),
      ),
    },
  };
}

export function getWarpcastShareUrl(options: { path: string; text: string }) {
  const url = new URL("https://warpcast.com/~/compose");

  url.searchParams.set("text", options.text);
  url.searchParams.append("embeds[]", getAbsoluteAppUrl(options.path));

  return url.toString();
}

export function getFarcasterAccountAssociation() {
  const rawAssociation = process.env.FARCASTER_ACCOUNT_ASSOCIATION_JSON;

  if (!rawAssociation) {
    return null;
  }

  try {
    return JSON.parse(rawAssociation) as unknown;
  } catch {
    return null;
  }
}

export function getMiniAppManifest() {
  const manifest: Record<string, unknown> = {
    miniapp: {
      version: "1",
      name: truncateAppName(getAppName()),
      iconUrl: getMiniAppIconUrl(),
      homeUrl: getAppUrl(),
      splashImageUrl: getMiniAppSplashImageUrl(),
      splashBackgroundColor: SPLASH_BACKGROUND_COLOR,
      subtitle: "Real market signals",
      description: "Share and copy real Conviction Markets signals from synced market data.",
      primaryCategory: "finance",
      tags: ["markets", "signals", "copytrade"],
      noindex: process.env.FARCASTER_MINIAPP_NOINDEX !== "false",
    },
  };
  const accountAssociation = getFarcasterAccountAssociation();

  if (accountAssociation) {
    manifest.accountAssociation = accountAssociation;
  }

  return manifest;
}

function truncateAppName(value: string) {
  return value.slice(0, 32);
}

function truncateButtonTitle(value: string) {
  return value.slice(0, 32);
}
