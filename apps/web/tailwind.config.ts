/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* --- DOM Brand (Indigo scale) --- */
        brand: {
          DEFAULT: "#4f46e5",
          hover: "#4338ca",
          light: "#6366f1",
          subtle: "hsl(var(--brand-subtle))",
          muted: "hsl(var(--brand-muted))",
          glow: "hsl(var(--brand-glow))",
        },
        /* --- Sidebar --- */
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
        /* --- Semantic Colors --- */
        success: {
          DEFAULT: "hsl(var(--green))",
          bg: "hsl(var(--green-bg))",
          fg: "hsl(var(--green-fg))",
        },
        warning: {
          DEFAULT: "hsl(var(--amber))",
          bg: "hsl(var(--amber-bg))",
          fg: "hsl(var(--amber-fg))",
        },
        danger: {
          DEFAULT: "hsl(var(--red))",
          bg: "hsl(var(--red-bg))",
          fg: "hsl(var(--red-fg))",
        },
        info: {
          DEFAULT: "hsl(var(--blue))",
          bg: "hsl(var(--blue-bg))",
          fg: "hsl(var(--blue-fg))",
        },
        violet: {
          DEFAULT: "hsl(var(--violet))",
          bg: "hsl(var(--violet-bg))",
          fg: "hsl(var(--violet-fg))",
        },
        /* --- Legacy compat (referenced in existing components) --- */
        "dom-blue": "#4f46e5",
        "dom-blue-dark": "#4338ca",
        "dom-blue-light": "#6366f1",
        "dom-black": "#0c0c0d",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "progress-indeterminate": "progress-indeterminate 1.5s infinite linear",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [
    tailwindcssAnimate,

    function ({ addBase }: { addBase: any }) {
      addBase({
        "html, :host": {
          "-webkit-text-size-adjust": "100%",
          "text-size-adjust": "100%",
        },
      });
    },
  ],
};

export default config;
