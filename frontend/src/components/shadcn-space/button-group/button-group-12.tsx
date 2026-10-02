"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDownIcon,
  PlayIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  HistoryIcon,
} from "lucide-react";
import { motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

const menuVariants = {
  hidden: { opacity: 0, scale: 0.97, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 24,
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
} satisfies Variants;

const itemVariants = {
  hidden: { opacity: 0, y: -5 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 22,
    },
  },
} satisfies Variants;

/* ---------------------------------------------------------------------------
 * Local adaptation (the only vendored block that needed one):
 *
 * Upstream hard-codes "Execute" plus the three git actions. The structure, the
 * animation, the separator and the staggered menu are kept exactly as
 * published; only the labels and handlers became props, so the same control can
 * drive the coding toolbar's Run / Save actions. The defaults still render the
 * upstream demo, so nothing about the block's behaviour changed.
 * ------------------------------------------------------------------------- */

export interface ActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface ActionExecuteButtonGroupProps {
  /** Primary button label. */
  label?: string;
  /** Primary button icon. */
  icon?: React.ReactNode;
  /** Primary action. */
  onPrimary?: () => void;
  /** Menu entries. */
  items?: ActionItem[];
  onAction?: (id: string) => void;
  disabled?: boolean;
  className?: string;
  /** Accessible name for the menu trigger — what is behind the chevron. */
  menuLabel?: string;
}

const DEFAULT_ITEMS: ActionItem[] = [
  { id: "commit-push", label: "Commit & Push", icon: <GitCommitIcon aria-hidden="true" /> },
  { id: "commit-sync", label: "Commit & Sync", icon: <GitPullRequestIcon aria-hidden="true" /> },
  { id: "amend", label: "Amend Last Commit", icon: <HistoryIcon aria-hidden="true" /> },
];

const ActionExecuteButtonGroup = ({
  label = "Execute",
  icon = <PlayIcon aria-hidden="true" className="fill-current size-4" />,
  onPrimary,
  items = DEFAULT_ITEMS,
  onAction,
  disabled = false,
  className,
  menuLabel = "More actions",
}: ActionExecuteButtonGroupProps = {}) => {
  const [open, setOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTriggerHovered, setIsTriggerHovered] = useState(false);
  void isTriggerHovered;

  return (
    <ButtonGroup className={cn("**:data-[slot=button]:border-r-0", className)}>
      <Button
        className="group relative overflow-hidden cursor-pointer"
        onClick={onPrimary}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.span
          animate={isHovered ? { x: 2, scale: 1.05 } : { x: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 450, damping: 16 }}
          className="flex items-center justify-center mr-1"
        >
          {icon}
        </motion.span>
        <span>{label}</span>
      </Button>
      <ButtonGroupSeparator className="bg-primary/72" />
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon"
              title={menuLabel}
              aria-label={menuLabel}
              className="border-primary-foreground/20 rounded-l-none border-l cursor-pointer"
              onMouseEnter={() => setIsTriggerHovered(true)}
              onMouseLeave={() => setIsTriggerHovered(false)}
            />
          }
        >
          <motion.div
            animate={{
              rotate: open ? 180 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 250,
              damping: 18,
            }}
            className="flex items-center justify-center"
          >
            <ChevronDownIcon aria-hidden="true" className="size-4" />
          </motion.div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={menuVariants}
            className="flex flex-col gap-0.5"
          >
            {items.map((item) => (
              <motion.div key={item.id} variants={itemVariants}>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={item.disabled}
                  onClick={() => onAction?.(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </DropdownMenuItem>
              </motion.div>
            ))}
          </motion.div>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

export default ActionExecuteButtonGroup;
