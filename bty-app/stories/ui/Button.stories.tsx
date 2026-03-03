import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { fn } from "@storybook/test";
import { Button } from "../../src/components/ui/Button";
import { t } from "../../src/lib/i18n/t";

/** 클릭 시 캔버스에 보이는 반응용 래퍼 */
function ButtonWithFeedback({
  args,
  locale,
}: {
  args: React.ComponentProps<typeof Button>;
  locale: "ko" | "en";
}) {
  const [clickCount, setClickCount] = useState(0);
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    args.onClick?.(e);
    setClickCount((c) => c + 1);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <Button {...args} onClick={handleClick}>
        {t("arena.start_simulation", locale)}
      </Button>
      {clickCount > 0 && (
        <p style={{ margin: 0, fontSize: 14, color: "var(--arena-text-soft, #5C5868)" }}>
          {locale === "ko" ? `클릭됨 ${clickCount}회` : `Clicked ${clickCount} time(s)`}
        </p>
      )}
    </div>
  );
}

const meta: Meta<typeof Button> = {
  title: "ui/Button",
  component: Button,
  args: {
    size: "md",
    variant: "primary",
    onClick: fn(),
  },
  parameters: {
    layout: "centered",
  },
  render: (args, ctx) => {
    const locale = (ctx.globals?.locale ?? "ko") as "ko" | "en";
    return <ButtonWithFeedback args={args} locale={locale} />;
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const PrimaryArena: Story = { args: { tone: "arena", variant: "primary" } };
export const SecondaryFoundry: Story = { args: { tone: "foundry", variant: "secondary" } };
export const PrimaryCenter: Story = { args: { tone: "center", variant: "primary" } };
export const Loading: Story = { args: { tone: "arena", isLoading: true } };
export const Disabled: Story = { args: { tone: "arena", disabled: true } };
