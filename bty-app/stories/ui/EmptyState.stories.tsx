import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { t } from "../../src/lib/i18n/t";

const meta: Meta<typeof EmptyState> = {
  title: "ui/EmptyState",
  component: EmptyState,
  args: {
    tone: "arena",
  },
  render: (args, ctx) => {
    const locale = (ctx.globals?.locale ?? "ko") as "ko" | "en";
    return (
      <EmptyState
        {...args}
        title={t("empty.title", locale)}
        description={t("empty.desc", locale)}
        ctaLabel={t("common.refresh", locale)}
        onCtaClick={() => console.log("EmptyState CTA clicked")}
      />
    );
  },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {};
export const CenterTone: Story = { args: { tone: "center" } };
export const FoundryTone: Story = { args: { tone: "foundry" } };
