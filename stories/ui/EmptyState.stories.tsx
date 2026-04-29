import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { EmptyState } from "../../src/components/bty-arena/EmptyState";
import { t } from "../../src/lib/i18n/t";

const meta: Meta<typeof EmptyState> = {
  title: "ui/EmptyState",
  component: EmptyState,
  args: {
    message: "",
    icon: "🏆",
  },
  render: (args, ctx) => {
    const locale = (ctx.globals?.locale ?? "ko") as "ko" | "en";
    return (
      <EmptyState
        {...args}
        message={args.message || t("empty.title", locale)}
        icon={args.icon}
        cta={
          args.cta !== undefined ? args.cta : (
            <button type="button" onClick={() => console.log("EmptyState CTA clicked")}>
              {t("common.refresh", locale)}
            </button>
          )
        }
      />
    );
  },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = { args: { message: "표시할 내용이 없습니다.", icon: "🏆" } };
export const WithHint: Story = {
  args: {
    message: "아직 기록이 없어요.",
    hint: "첫 시나리오를 시작해 보세요.",
    icon: "📋",
  },
};
