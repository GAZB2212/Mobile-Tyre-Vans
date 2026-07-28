import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

type AdminSwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>;

export function AdminSwitch({ className, ...props }: AdminSwitchProps) {
  return (
    <Switch
      className={cn(
        "data-[state=unchecked]:bg-red-500 data-[state=checked]:bg-accent",
        className
      )}
      {...props}
    />
  );
}
