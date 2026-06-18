const DEFAULT_APP_NAME = "Conviction Markets";
const DEFAULT_APP_URL = "https://convictionmarkets.xyz";
const SPLASH_BACKGROUND_COLOR = "#f7f7f2";
const MANIFEST_TAGS = ["markets", "signals", "copytrade"] as const;

type FarcasterAccountAssociation = {
  header: string;
  payload: string;
  signature: string;
};

export type FarcasterAccountAssociationState =
  | { status: "missing"; association: null; error: null }
  | { status: "valid"; association: FarcasterAccountAssociation; error: null }
  | { status: "invalid"; association: null; error: string };

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
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? DEFAULT_APP_URL)
    .trim()
    .replace(/\/$/, "");
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

export function createLegacyFrameEmbed(options: {
  imagePath: string;
  targetPath: string;
  buttonTitle: string;
}) {
  const embed = createMiniAppEmbed(options);

  return {
    ...embed,
    button: {
      ...embed.button,
      action: {
        ...embed.button.action,
        type: "launch_frame",
      },
    },
  };
}

export function createMiniAppPageMetadata(options: {
  title: string;
  description: string;
  imagePath: string;
  targetPath: string;
  buttonTitle: string;
}) {
  const imageUrl = getAbsoluteAppUrl(options.imagePath);
  const miniAppEmbed = createMiniAppEmbed({
    imagePath: options.imagePath,
    targetPath: options.targetPath,
    buttonTitle: options.buttonTitle,
  });
  const legacyFrameEmbed = createLegacyFrameEmbed({
    imagePath: options.imagePath,
    targetPath: options.targetPath,
    buttonTitle: options.buttonTitle,
  });

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
      "fc:miniapp": JSON.stringify(miniAppEmbed),
      "fc:frame": JSON.stringify(legacyFrameEmbed),
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
  const state = getFarcasterAccountAssociationState();

  return state.status === "valid" ? state.association : null;
}

export function getFarcasterAccountAssociationState(): FarcasterAccountAssociationState {
  const rawAssociation = process.env.FARCASTER_ACCOUNT_ASSOCIATION_JSON?.trim();

  if (!rawAssociation) {
    return { status: "missing", association: null, error: null };
  }

  try {
    const parsed = JSON.parse(rawAssociation) as unknown;
    const association = parseAccountAssociation(parsed);

    if (!association) {
      return {
        status: "invalid",
        association: null,
        error:
          "FARCASTER_ACCOUNT_ASSOCIATION_JSON must include string header, payload, and signature fields.",
      };
    }

    return { status: "valid", association, error: null };
  } catch {
    return {
      status: "invalid",
      association: null,
      error: "FARCASTER_ACCOUNT_ASSOCIATION_JSON must be valid JSON generated for this app domain.",
    };
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
      tags: MANIFEST_TAGS,
      noindex: isMiniAppNoindexEnabled(),
    },
  };
  const accountAssociation = getFarcasterAccountAssociation();

  if (accountAssociation) {
    manifest.accountAssociation = accountAssociation;
  }

  return manifest;
}

export function isMiniAppNoindexEnabled() {
  return process.env.FARCASTER_MINIAPP_NOINDEX !== "false";
}

function parseAccountAssociation(value: unknown): FarcasterAccountAssociation | null {
  if (!isRecord(value)) {
    return null;
  }

  const { header, payload, signature } = value;

  if (
    typeof header !== "string" ||
    !header.trim() ||
    typeof payload !== "string" ||
    !payload.trim() ||
    typeof signature !== "string" ||
    !signature.trim()
  ) {
    return null;
  }

  return {
    header: header.trim(),
    payload: payload.trim(),
    signature: signature.trim(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncateAppName(value: string) {
  return value.slice(0, 32);
}

function truncateButtonTitle(value: string) {
  return value.slice(0, 32);
}
