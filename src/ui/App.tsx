import { useState } from "react";
import {
  Badge,
  OverlayContainerProvider,
  Stack,
  TooltipProvider,
  Typography,
} from "@aviala-design/spiral";
import { useFigmaBridge } from "./bridge";
import { BuilderPanel } from "./components/builder/BuilderPanel";
import { ModeSwitch, type Mode } from "./components/ModeSwitch";
import { ValidatorPanel } from "./components/validator/ValidatorPanel";

export default function App() {
  const bridge = useFigmaBridge();
  const [mode, setMode] = useState<Mode>("builder");
  const [overlayContainer, setOverlayContainer] = useState<HTMLElement | null>(
    null
  );
  const { init, isMock } = bridge.state;

  return (
    <div ref={setOverlayContainer} className="flex h-full flex-col">
      <OverlayContainerProvider container={overlayContainer}>
        <TooltipProvider>
          <header className="shrink-0 border-b px-4 py-3">
            <Stack
              direction="row"
              gap="inside"
              className="items-center justify-between"
            >
              <Typography level="title" as="div">
                Aviala Name Helper
              </Typography>
              {isMock ? (
                <Badge style="warning" level="caption">
                  Browser mock
                </Badge>
              ) : null}
            </Stack>
            <Typography
              level="caption"
              className="text-[var(--muted-foreground)]"
            >
              {init
                ? `v${init.pluginVersion} · ${init.localVariableCount} local · ${init.localCollectionCount} collections`
                : "Connecting to Figma…"}
            </Typography>
          </header>

          <div className="shrink-0 px-4 pt-3">
            <ModeSwitch value={mode} onChange={setMode} />
          </div>

          <main className="min-h-0 flex-1 overflow-hidden">
            {mode === "builder" ? (
              <BuilderPanel bridge={bridge} />
            ) : (
              <ValidatorPanel bridge={bridge} />
            )}
          </main>
        </TooltipProvider>
      </OverlayContainerProvider>
    </div>
  );
}
