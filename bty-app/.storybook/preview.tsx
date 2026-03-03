import type { Preview } from "@storybook/react";
import React, { useEffect } from "react";
import "../src/app/globals.css";

const preview: Preview = {
  globalTypes: {
    mode: {
      description: "Color mode",
      defaultValue: "light",
      toolbar: {
        title: "Mode",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
    domain: {
      description: "BTY domain tone",
      defaultValue: "arena",
      toolbar: {
        title: "Domain",
        items: [
          { value: "arena", title: "Arena" },
          { value: "foundry", title: "Foundry" },
          { value: "center", title: "Center" },
          { value: "neutral", title: "Neutral" },
        ],
      },
    },
    locale: {
      description: "Locale",
      defaultValue: "ko",
      toolbar: {
        title: "Locale",
        items: [
          { value: "ko", title: "KO" },
          { value: "en", title: "EN" },
        ],
      },
    },
    reducedMotion: {
      description: "Prefers reduced motion",
      defaultValue: false,
      toolbar: {
        title: "Motion",
        items: [
          { value: false, title: "Normal" },
          { value: true, title: "Reduced" },
        ],
      },
    },
  },

  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: { expanded: true },
    layout: "centered",
  },

  decorators: [
    (Story, ctx) => {
      const { mode, domain, locale, reducedMotion } = ctx.globals as {
        mode: "light" | "dark";
        domain: "arena" | "foundry" | "center" | "neutral";
        locale: "ko" | "en";
        reducedMotion: boolean;
      };

      useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", mode === "dark");
        root.setAttribute("data-domain", domain);
        root.setAttribute("lang", locale);
        root.setAttribute("data-reduced-motion", String(reducedMotion));
      }, [mode, domain, locale, reducedMotion]);

      return (
        <div
          className={[
            "min-h-[240px] min-w-[320px] p-6",
            "bg-neutral-bgBase text-neutral-textBase",
          ].join(" ")}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
