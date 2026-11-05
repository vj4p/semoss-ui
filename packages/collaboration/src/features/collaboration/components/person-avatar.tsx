import { useState } from "react";
import { Avatar, AvatarFallback, cn } from "@semoss/ui/next";
import { personPhotoUrl } from "../api/person-photo";

/** Initials, covered by the person's Microsoft photo when the server has one for their address. */
export function PersonAvatar({
	name,
	initials,
	email,
	className,
	tone,
}: {
	name: string;
	initials?: string;
	/** The person's address; without one the avatar keeps its initials. */
	email?: string | null;
	className?: string;
	/** Replaces the color picked from the name. */
	tone?: string;
}) {
	const [failedPhoto, setFailedPhoto] = useState("");
	const photo = email ? personPhotoUrl(email) : "";
	// The hue is the tint behind the letters, not the letters: the lighter chart
	// colors read at 2.6 to 3.4 against their own tint, short of the 4.5 that
	// text needs.
	const tones = [
		"bg-chart-1/10",
		"bg-chart-2/10",
		"bg-chart-3/10",
		"bg-primary/10",
	];
	const nameTone =
		tones[
			[...name].reduce(
				(value, letter) => value + letter.charCodeAt(0),
				0,
			) % tones.length
		];
	return (
		<Avatar
			className={cn("size-10 shrink-0", className)}
			aria-hidden="true"
		>
			<AvatarFallback
				className={cn(
					"font-medium text-foreground text-xs",
					tone ?? nameTone,
				)}
			>
				{initials ||
					name
						.split(/\s+/)
						.slice(0, 2)
						.map((part) => part[0])
						.join("")
						.toUpperCase()}
			</AvatarFallback>
			{photo && failedPhoto !== photo && (
				// a plain img over the initials: AvatarImage preloads at once, this waits until it scrolls into view
				<img
					src={photo}
					alt=""
					loading="lazy"
					onError={() => setFailedPhoto(photo)}
					className="absolute inset-0 size-full object-cover"
				/>
			)}
		</Avatar>
	);
}
