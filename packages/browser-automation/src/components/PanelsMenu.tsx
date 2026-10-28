import { MoreHorizontal } from "lucide-react";
import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@semoss/ui/next";

/** Props for {@link PanelsMenu}. */
interface PanelsMenuProps {
	recordedCount: number;
	recordedOpen: boolean;
	onToggleRecorded: () => void;
	contextsCount: number;
	contextsOpen: boolean;
	onToggleContexts: () => void;
}

/**
 * Holds the Recorded and Contexts panel toggles on screens too narrow to show
 * them as buttons beside the primary actions. From `sm` up they are shown as
 * buttons instead and this menu is hidden.
 */
export function PanelsMenu({
	recordedCount,
	recordedOpen,
	onToggleRecorded,
	contextsCount,
	contextsOpen,
	onToggleContexts,
}: PanelsMenuProps) {
	if (recordedCount === 0 && contextsCount === 0) return null;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					size="icon-sm"
					variant="outline"
					className="sm:hidden"
					aria-label="More panels"
				>
					<MoreHorizontal aria-hidden="true" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{recordedCount > 0 && (
					<DropdownMenuCheckboxItem
						checked={recordedOpen}
						onCheckedChange={() => onToggleRecorded()}
					>
						Recorded steps ({recordedCount})
					</DropdownMenuCheckboxItem>
				)}
				{contextsCount > 0 && (
					<DropdownMenuCheckboxItem
						checked={contextsOpen}
						onCheckedChange={() => onToggleContexts()}
					>
						Contexts ({contextsCount})
					</DropdownMenuCheckboxItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
