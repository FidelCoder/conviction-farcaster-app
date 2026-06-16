const config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/zip-ui/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        "electric-purple": "#7C3AED",
        "deep-orange": "#F97316",
        "market-green": "#10B981",
        "market-red": "#EF4444",
        "surface-card": "#161616",
        "background-base": "#0A0A0A",
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1c1b1b",
        "surface-container": "#201f1f",
        "surface-container-high": "#2a2a2a",
        "surface-container-highest": "#353534",
        "on-surface": "#e5e2e1",
        "on-surface-variant": "#ccc3d8",
        "outline-variant": "#4a4455",
        primary: "#d2bbff",
        "primary-container": "#7c3aed",
      },
      zIndex: {
        35: "35",
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "scale-up": "scale-up 180ms ease-out both",
        "fade-in": "fade-in 180ms ease-out both",
      },
      keyframes: {
        "scale-up": {
          from: { opacity: "0", transform: "scale(0.98) translateY(-4px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
