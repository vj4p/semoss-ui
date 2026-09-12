import { makeAutoObservable, runInAction } from "mobx";
import { download, type Insight, runPixel } from "@semoss/sdk/react";
import type { ThemeMap } from "@semoss/shared";
import type {
	AbstractPixelMessage,
	AgentHook,
	App,
	Engine,
	MCPConfig,
	PixelMessageTextPart,
	PixelMessageToolCallPart,
	Workspace,
} from "@/types";
import {
	blocksProjectAgentsMd,
	normalizeTimestamp,
	projectAgentsMd,
	starterBlocksState,
} from "@/utility";
import { RoomStore } from "../room";

/**
 * Project types the harness can create and put a room on.
 *
 * `CODE` serves files out of `portals/`. `BLOCKS` is a single
 * `portals/blocks.json` the client renders — 42 widgets, grids and charts bound to
 * a live frame. The type is immutable after creation, so this is a decision the
 * user makes once, up front.
 */
export type ProjectKind = "CODE" | "BLOCKS";

const DEFAUlT_MODEL_ID = import.meta.env.VITE_DEFAUlT_MODEL_ID || "";
const DEFAUlT_MODEL_NAME = import.meta.env.VITE_DEFAUlT_MODEL_NAME || "";

const SESSION_MODEL_KEY = "smss-playground-session-model";

/**
 * Shape of a room row as rendered in the nav list. Matches the columns
 * returned by GetPlaygroundRooms so optimistic rooms can be merged into the
 * fetched list seamlessly.
 */
export interface OptimisticRoom {
	ROOM_ID: string;
	ROOM_NAME: string;
	DATE_CREATED: string;
	WORKSPACE_ID?: string;
	PINNED?: boolean;
}

interface ChatStoreInterface {
	/**
	 *  Track if the chat is initialized
	 */
	isInitialized: boolean;

	/**
	 * List of the models available
	 */
	models: {
		/** The current model */
		selected: Engine;

		/** The current context window */
		contextWindow?: number;

		/** All available models fetched from the backend */
		available: Engine[];
	};

	/**
	 * Engine ID of the model set as default in the user's profile (Settings > My Profile).
	 * Empty string if no profile default is set.
	 */
	profileDefaultModelId: string;

	/**
	 * Cached rooms
	 */
	rooms: Record<string, RoomStore>;

	/**
	 * Rooms shown in the nav before their first message has persisted.
	 * GetPlaygroundRooms only returns rooms that already have a message with
	 * data, so a freshly created room is invisible to the refetch until its
	 * first response lands. These bridge that gap and are removed once the
	 * real room shows up in the fetched list. Keyed by room id.
	 */
	optimisticRooms: Record<string, OptimisticRoom>;

	/**
	 * Options related to the navbar
	 */
	keys: {
		/**
		 * Counter to force re-render of the nav when the rooms change
		 */
		roomCounter: number;
	};

	/**
	 * Preloaded embedded paths
	 * path -> url
	 */
	embeddedPageMap: Record<
		string,
		| ThemeMap["playground"]["sidebar"]["headerItems"][number]
		| ThemeMap["playground"]["sidebar"]["footerItems"][number]
	>;

	/**
	 * Current user info
	 */
	user: {
		id: string;
		name: string;
		lastLogin?: string;
	};
}

/**
 * Manage the chat
 */
export class ChatStore {
	private _theme: ThemeMap["playground"];
	private _actions: Insight["actions"];
	private _store: ChatStoreInterface = {
		isInitialized: false,
		models: {
			selected: null as unknown as Engine,
			contextWindow: undefined,
			available: [],
		},
		rooms: {},
		optimisticRooms: {},
		keys: {
			roomCounter: 0,
		},
		user: {
			id: "",
			name: "",
		},
		embeddedPageMap: {},
		profileDefaultModelId: "",
	};

	constructor(theme: ThemeMap["playground"], actions: Insight["actions"]) {
		this._theme = theme;
		this._actions = actions;
		this._store.embeddedPageMap = [
			...theme.sidebar.headerItems,
			...theme.sidebar.footerItems,
		]
			.filter((item) => item.embed && item.url)
			.reduce(
				(acc, item) => {
					acc[item.path] = item;
					return acc;
				},
				{} as Record<
					string,
					| ThemeMap["playground"]["sidebar"]["headerItems"][number]
					| ThemeMap["playground"]["sidebar"]["footerItems"][number]
				>,
			);

		// make it observable
		makeAutoObservable(this);
	}

	/**
	 * Getters
	 */
	/**
	 * Track if the store is loaded
	 */
	get isInitialized() {
		return this._store.isInitialized;
	}

	/**
	 * Get the models from the store
	 */
	get models() {
		return this._store.models;
	}

	/**
	 * Get keys to refresh different objects
	 */
	get keys() {
		return this._store.keys;
	}

	/**
	 * Get the current user
	 */
	get user() {
		return this._store.user;
	}

	/**
	 * Get the map of preloaded embed paths
	 */
	get embeddedPageMap() {
		return this._store.embeddedPageMap;
	}

	/**
	 * Get the engine ID of the user's profile default model
	 */
	get profileDefaultModelId() {
		return this._store.profileDefaultModelId;
	}

	/**
	 * Get the rooms optimistically shown in the nav
	 */
	get optimisticRooms() {
		return this._store.optimisticRooms;
	}

	/**
	 * Initialize the store
	 */
	initialize = async (): Promise<void> => {
		try {
			// getUser must complete first so profileDefaultModelId is set
			// before getDefaultModel runs its model selection logic
			await this.getUser();
			await this.getDefaultModel();
		} catch (e) {
			console.error(e);
		} finally {
			runInAction(() => {
				this._store.isInitialized = true;
			});
		}
	};

	getUser = async (): Promise<void> => {
		try {
			// Send both pixels in a single request.
			// GetUserMetadata bypasses the cache that GetUserInfo has, so it
			// always returns the latest saved text-generation-model value.
			const result = await this._actions.run<
				[
					Record<
						string,
						{ id: string; name: string; lastLogin?: string }
					>,
					{ "text-generation-model"?: string | string[] },
				]
			>(`META | GetUserInfo(); META | GetUserMetadata();`);

			// Extract user id, name, lastLogin from GetUserInfo
			const providerData = Object.values(result.pixelReturn[0].output)[0];
			if (providerData) {
				runInAction(() => {
					this._store.user = {
						id: providerData.id,
						name: providerData.name,
						lastLogin: providerData.lastLogin,
					};
				});
			}

			// Extract profile default model from GetUserMetadata (bypasses cache)
			const meta = result.pixelReturn[1].output;
			const metaValue = meta?.["text-generation-model"];
			const profileDefaultModelId = Array.isArray(metaValue)
				? (metaValue[0] as string) || ""
				: typeof metaValue === "string"
					? metaValue
					: "";

			runInAction(() => {
				this._store.profileDefaultModelId = profileDefaultModelId;
			});
		} catch (e) {
			console.error(e);
		}
	};

	/**
	 * Register a pre-created RoomStore in the local cache so it is
	 * discoverable by loadRoom after navigation.  Used by consumers that
	 * need a real insight before the first message is sent (e.g. the
	 * file-explorer on the new-room page).
	 */
	registerRoom = (room: RoomStore): void => {
		runInAction(() => {
			this._store.rooms[room.roomId] = room;
		});
	};

	/**
	 * Optimistically surface a room in the nav before its first message has
	 * persisted. Shown until the real room is returned by GetPlaygroundRooms
	 * (see {@link removeOptimisticRoom}).
	 */
	addOptimisticRoom = (room: OptimisticRoom): void => {
		runInAction(() => {
			this._store.optimisticRooms[room.ROOM_ID] = room;
		});
	};

	/**
	 * Drop an optimistic room, once the real room has been fetched or its
	 * first message failed to send.
	 */
	removeOptimisticRoom = (roomId: string): void => {
		runInAction(() => {
			delete this._store.optimisticRooms[roomId];
		});
	};

	/**
	 * Create a new room
	 */
	createRoom = async (
		mode: "agent" | "chat",
		prompt: string,
		files: File[],
		options: RoomStore["options"],
		workspaceId?: string,
		askOptions?: { visible?: boolean },
	): Promise<RoomStore> => {
		// create the room in a new insight
		const { errors, pixelReturn, insightId } = await runPixel<
			[
				{
					roomId: string;
				},
			]
		>(
			`CreatePlaygroundRoom(${workspaceId ? `workspaceId=${JSON.stringify(workspaceId)}` : ""})`,
			"new",
		);

		// throw errors
		if (errors.length > 0) {
			throw new Error(errors.join(""));
		}

		// get the output
		const { output } = pixelReturn[0];

		// get the new roomId
		const roomId = output.roomId;

		// create the room store
		const room = new RoomStore(this._theme, roomId, insightId);

		// set the model
		room.setModel(this.models.selected);

		// set the mode
		room.setMode(mode);

		// set default name
		room.setMetadata({ name: prompt.substring(0, 15) });

		// initialize the room
		await room.initialize();

		// set the options
		await room.updateRoomOptions(options);

		runInAction(() => {
			// save it to the cache
			this._store.rooms[roomId] = room;

			// optimistically surface the room in the nav — GetPlaygroundRooms
			// won't return it until its first message has data
			this._store.optimisticRooms[roomId] = {
				ROOM_ID: roomId,
				ROOM_NAME: prompt.substring(0, 100),
				DATE_CREATED: new Date().toISOString(),
				WORKSPACE_ID: workspaceId,
			};

			// increment the roomCounter to force re-render of the nav
			this._store.keys.roomCounter++;
		});

		// ask the room — fire-and-forget so we return (and navigate) without
		// waiting on the response
		(async () => {
			try {
				await room.askMessage(prompt, files, askOptions);
				runInAction(() => {
					// increment the roomCounter to force re-render of the nav
					this._store.keys.roomCounter++;
				});
			} catch (e) {
				// UploadError: the message was never sent but the room still
				// exists — leave the optimistic entry so the user can retry.
				// Any other error means the room has no data; drop it.
				if ((e as Error)?.name !== "UploadError") {
					this.removeOptimisticRoom(roomId);
				}
			}
		})();

		// return the room
		return room;
	};

	/**
	 * Remove an room from the remove and all of the related messages
	 * @param roomId - Room to remove
	 */
	closeRoom = async (roomId: string): Promise<void> => {
		const room = this._store.rooms[roomId];
		const insightId = room?.insightId;

		// wait for the pixel to run
		await this._actions.run<[boolean]>(
			`RemoveUserRoom(roomId=["${roomId}"]);`,
		);

		// only drop if the room was opened and has a real insightId
		if (insightId && insightId !== "new") {
			try {
				await runPixel<[Record<string, unknown>]>(
					"DropInsight()",
					insightId,
				);
			} catch (e) {
				console.warn(e);
			}
		}

		runInAction(() => {
			// delete it from the cache
			delete this._store.rooms[roomId];

			// increment the roomCounter to force re-render of the nav
			this._store.keys.roomCounter++;
		});
	};

	/**
	 * Rename a room. Runs the RenameRoom pixel, updates the cached
	 * room's metadata, and bumps the roomCounter so any room lists
	 * elsewhere in the app (sidebar, chats page, per-agent timeline)
	 * refetch and stay in sync.
	 */
	renameRoom = async (roomId: string, name: string): Promise<void> => {
		const trimmed = name.trim();
		if (!trimmed) {
			throw new Error("Room name cannot be empty");
		}
		await this._actions.run<[boolean]>(
			`META | RenameRoom(roomId=["${roomId}"], name=["<encode>${trimmed}</encode>"]);`,
		);
		runInAction(() => {
			const cached = this._store.rooms[roomId];
			if (cached) {
				cached.setMetadata({ name: trimmed });
			}
			this._store.keys.roomCounter++;
		});
	};

	/**
	 * Pin or unpin a room. Runs the PinRoom pixel and bumps the
	 * roomCounter so any room lists elsewhere in the app (sidebar,
	 * chats page, per-agent timeline) refetch and stay in sync.
	 */
	pinRoom = async (roomId: string, pinned: boolean): Promise<void> => {
		await this._actions.run<[boolean]>(
			`PinRoom(roomId=["${roomId}"], pinned=[${pinned}]);`,
		);
		runInAction(() => {
			this._store.keys.roomCounter++;
		});
	};

	downloadConversation = async (
		roomId: string,
		format: "word" | "pdf",
	): Promise<void> => {
		const messagesResponse = await runPixel<AbstractPixelMessage[]>(
			`GetPlaygroundMessages(roomId=["${roomId}"]);`,
			"new",
		);

		if (!messagesResponse?.pixelReturn?.[0]?.output) {
			throw new Error("Failed to fetch conversation messages");
		}

		const messageOutput: AbstractPixelMessage[] =
			messagesResponse.pixelReturn[0].output;

		const formattedMessages = messageOutput
			.map((message: AbstractPixelMessage) => {
				const timestamp = message.dateCreated
					? normalizeTimestamp(message.dateCreated).format(
							"MMM D, YYYY h:mm A",
						)
					: null;
				const ts = timestamp ? `\n*${timestamp}*` : "";

				if (message.io === "INPUT") {
					const text = message.parts
						?.filter(
							(p): p is PixelMessageTextPart =>
								p?.type === "TEXT",
						)
						.map((p) => p.text)
						.join("");
					return text ? `**You:**${ts}\n\n${text}` : null;
				}
				if (message.io === "OUTPUT") {
					const text = message.parts
						?.filter(
							(p): p is PixelMessageTextPart =>
								p?.type === "TEXT",
						)
						.map((p) => p.text)
						.join("");
					const tools: string[] =
						message.parts
							?.filter(
								(p): p is PixelMessageToolCallPart =>
									p?.type === "TOOL_CALL",
							)
							.map((p) => p.toolCall.title || p.toolCall.name)
							.filter(Boolean) ?? [];
					const toolLine =
						tools.length > 0
							? `\n\n*Tools used: ${tools.join(", ")}*`
							: "";
					return text || tools.length > 0
						? `**Assistant:**${ts}\n\n${text}${toolLine}`
						: null;
				}
				return null;
			})
			.filter(Boolean)
			.join("\n\n---\n\n");

		if (!formattedMessages) {
			throw new Error("No conversation content to download");
		}

		const appName = this._theme.name || "Chat";
		const pixelCommand =
			format === "word"
				? `ToDocx(markdown=["<encode>${formattedMessages}</encode>"], fileName="${appName} Room Export");`
				: `ToPdf(markdown=["<encode>${formattedMessages}</encode>"], fileName="${appName} Room Export");`;

		const downloadResponse = await runPixel<string>(
			pixelCommand,
			messagesResponse.insightId,
		);

		if (!downloadResponse?.pixelReturn?.[0]) {
			throw new Error("No response received from server");
		}

		const { operationType, output } = downloadResponse.pixelReturn[0];

		if (!operationType?.includes("FILE_DOWNLOAD")) {
			throw new Error(
				`Failed to generate ${format.toUpperCase()} file. Operation type: ${operationType}`,
			);
		}

		download(downloadResponse.insightId, output);
	};

	/**
	 * Load a room from the store or create a new one
	 * @param roomId - Room to remove
	 */
	loadRoom = async (roomId: string): Promise<RoomStore> => {
		// if it exists in the store utilize it.
		if (this._store.rooms[roomId]) {
			return this._store.rooms[roomId];
		}

		// create the room store
		const room = new RoomStore(this._theme, roomId);

		// initialize the room
		await room.initialize();

		// If the room has no messages or just the placeholder, it means it is a valid room but it is empty, so we can consider it as not found and throw an error
		// This happens if CreateRoom succeeds but the first AskPlayground call fails
		if (!room.tail || room.tail.id === "ROOT_PLACEHOLDER_ID") {
			throw new Error("Room not found");
		}

		runInAction(() => {
			// save it to the cache
			this._store.rooms[roomId] = room;
			// No roomCounter increment here — loading an existing room doesn't
			// change the list, so there's no reason to trigger a re-fetch.
		});

		// return the room
		return room;
	};

	/**
	 * Re-fetch the user's profile default text-generation model from the backend
	 * and update the selected model if it has changed. Called when the new-room
	 * page mounts so any change made in the token-usage page (embed) is picked
	 * up without requiring a logout/login cycle.
	 */
	refreshProfileDefaultModel = async (): Promise<void> => {
		try {
			// Use GetUserMetadata to bypass the GetUserInfo cache
			const result = await this._actions.run<
				[{ "text-generation-model"?: string | string[] }]
			>(`META | GetUserMetadata();`);

			const meta = result.pixelReturn[0].output;
			const metaValue = meta?.["text-generation-model"];
			const newModelId = Array.isArray(metaValue)
				? (metaValue[0] as string) || ""
				: typeof metaValue === "string"
					? metaValue
					: "";

			// Only update if the default has actually changed
			if (
				!newModelId ||
				newModelId === this._store.profileDefaultModelId
			) {
				return;
			}

			runInAction(() => {
				this._store.profileDefaultModelId = newModelId;
			});

			const match = this._store.models.available.find(
				(m) => m.engine_id === newModelId,
			);

			if (match) {
				this.setSelectedModel(match);
			}
		} catch (e) {
			console.error("[ChatStore] refreshProfileDefaultModel failed:", e);
		}
	};

	/**
	 * Set the selected model
	 */
	setSelectedModel = (model: Engine): void => {
		runInAction(() => {
			this._store.models.selected = model;
		});

		sessionStorage.setItem(
			SESSION_MODEL_KEY,
			JSON.stringify({ model, lastLogin: this._store.user.lastLogin }),
		);

		this.loadEngineContextWindow(model.engine_id);
	};

	/**
	 * Select a model named by something other than the picker - an agent's
	 * default model, say - resolving the id against the models the user can
	 * actually see so a stale or unshared id cannot leave the room pointed at a
	 * model that will not run.
	 *
	 * @returns whether the selection changed
	 */
	selectModelById = async (engineId: string): Promise<boolean> => {
		const id = engineId?.trim();
		if (!id || this._store.models.selected?.engine_id === id) {
			return false;
		}

		try {
			const { pixelReturn } = await this._actions.run<[Engine[]]>(
				`META | MyEngines(metaKeys=[], metaFilters=[{"tag":"text-generation"}], engineTypes=["MODEL"], engine=[${JSON.stringify(id)}]);`,
			);

			const model = pixelReturn[0].output?.find(
				(m) => m.engine_id === id,
			);
			if (!model) {
				return false;
			}

			this.setSelectedModel(model);
			return true;
		} catch (e) {
			console.error(e);
			return false;
		}
	};

	private loadEngineContextWindow = async (engineId: string) => {
		runInAction(() => {
			this._store.models.contextWindow = undefined;
		});

		const { pixelReturn } = await this._actions.run<[number | undefined]>(
			`META | GetContextWindow(${JSON.stringify(engineId)});`,
		);

		if (this.models.selected?.engine_id === engineId) {
			runInAction(() => {
				this._store.models.contextWindow = pixelReturn[0].output;
			});
		}
	};

	/**
	 * Add a new workspace
	 */
	addWorkspace = async (
		data: Pick<
			Workspace,
			| "name"
			| "system_prompt"
			| "description"
			| "mcp"
			| "skills"
			| "prompts"
		>,
	): Promise<string> => {
		try {
			const mcp = data.mcp.map(
				({ name, id, type }): MCPConfig => ({ name, id, type }),
			);
			const skills = data.skills.map((s) => s.id);

			const pixel = `AddWorkspace(name=${JSON.stringify(data.name)}, description="<encode>${data.description}</encode>", systemPrompt="<encode>${data.system_prompt}</encode>", mcp=${JSON.stringify(mcp)}, skills=${JSON.stringify(skills)}, prompts=${JSON.stringify(data.prompts)})`;
			const { pixelReturn } = await this._actions.run<[string]>(pixel);

			return pixelReturn[0].output;
		} catch (e) {
			throw e instanceof Error ? e : new Error(String(e));
		}
	};

	/**
	 * Edit a workspace
	 */
	editWorkspace = async (
		workspaceId: string,
		data: Pick<
			Workspace,
			| "name"
			| "system_prompt"
			| "description"
			| "mcp"
			| "skills"
			| "prompts"
		> & {
			/**
			 * Lifecycle hooks. Omit to leave the workspace's existing hooks
			 * alone — EditWorkspace preserves CONFIG_JSON fields it isn't given,
			 * so sending nothing is different from sending [].
			 */
			hooks?: AgentHook[];
		},
	): Promise<string> => {
		try {
			const mcp = data.mcp.map(
				({ name, id, type }): MCPConfig => ({ name, id, type }),
			);
			const skills = data.skills.map((s) => s.id);

			// Only send hooks when the caller supplied them; the reactor treats
			// an absent key as "leave as-is" and an empty array as "clear".
			const hooksParam = data.hooks
				? `, hooks=${JSON.stringify(data.hooks)}`
				: "";

			const pixel = `EditWorkspace(workspaceId=${JSON.stringify(workspaceId)}, name=${JSON.stringify(data.name)}, description="<encode>${data.description}</encode>", systemPrompt="<encode>${data.system_prompt}</encode>", mcp=${JSON.stringify(mcp)}, skills=${JSON.stringify(skills)}, prompts=${JSON.stringify(data.prompts)}${hooksParam})`;
			const { pixelReturn } = await this._actions.run<[string]>(pixel);

			// throw errors
			if (!pixelReturn[0].output) {
				throw new Error();
			}

			return workspaceId;
		} catch (e) {
			throw e instanceof Error ? e : new Error(String(e));
		}
	};

	/**
	 * Projects (apps) the user can open in a room.
	 *
	 * CODE and BLOCKS are the two types an agent can meaningfully build: CODE is
	 * files served out of `portals/`, BLOCKS is a single `portals/blocks.json` the
	 * client renders. Both appear in the app catalog. INSIGHTS, WORKSPACE, SKILL
	 * and NOTEBOOK projects are deliberately excluded — a room pointed at one of
	 * those would have the agent editing something with a different contract.
	 */
	listCodeProjects = async (filter?: string): Promise<App[]> => {
		const clauses = [
			`projectType=${JSON.stringify(["CODE", "BLOCKS"])}`,
			`onlyFavorites=[false]`,
		];
		if (filter?.trim()) {
			clauses.push(`filterWord=${JSON.stringify([filter.trim()])}`);
		}
		const { pixelReturn } = await this._actions.run<[App[]]>(
			`MyProjects(${clauses.join(", ")});`,
		);
		const { output, operationType } = pixelReturn[0];
		if (operationType.indexOf("ERROR") > -1) {
			throw new Error("Failed to list projects");
		}
		return output ?? [];
	};

	/**
	 * Create a CODE project and return it, publishing it so it is live.
	 *
	 * `projectType=["CODE"]` is not optional. CreateProjectReactor silently
	 * defaults to INSIGHTS when it is missing, and an INSIGHTS project never
	 * shows up in the app catalog — the failure is invisible until someone goes
	 * looking for the app.
	 *
	 * CreateProject's own return value does not reliably carry the new id, so
	 * the id is recovered by re-querying MyProjects and taking the newest match.
	 */
	createCodeProject = async (
		name: string,
		description?: string,
		projectType: ProjectKind = "CODE",
	): Promise<App> => {
		const trimmed = name.trim();
		if (!trimmed) {
			throw new Error("A project name is required");
		}

		if (projectType === "BLOCKS") {
			// A blocks app must be *born* as BLOCKS. PROJECT_ENUM_TYPE is written
			// into the .smss once at creation and no reactor mutates it, so a CODE
			// project can never be converted — the viewer would keep choosing
			// CodeRenderer and iframe portals/ no matter what blocks.json said.
			// CreateAppFromBlocks sets the type and writes the first state in one
			// step; CreateProject cannot set BLOCKS and seed content together.
			await this._actions.run(
				`CreateAppFromBlocks(project=${JSON.stringify([
					trimmed,
				])}, json=["<encode>${starterBlocksState(
					trimmed,
				)}</encode>"], global=[false]);`,
			);
		} else {
			await this._actions.run(
				`CreateProject(project=${JSON.stringify([trimmed])}, projectType=${JSON.stringify(
					["CODE"],
				)}, global=[false]);`,
			);
		}

		const matches = await this.listCodeProjects(trimmed);
		// Match on either field: project_name is not reliably the name that was
		// asked for (the seeded platform apps all use project_name "platform"
		// and keep the real one in project_display_name).
		const created = [...matches]
			.filter(
				(p) =>
					p.project_display_name === trimmed ||
					p.project_name === trimmed,
			)
			.sort((a, b) =>
				String(b.project_date_created ?? "").localeCompare(
					String(a.project_date_created ?? ""),
				),
			)[0];

		if (!created?.project_id) {
			throw new Error(
				`Created "${trimmed}" but could not resolve its project id`,
			);
		}

		if (description?.trim()) {
			try {
				await this._actions.run(
					`SetProjectMetadata(project=${JSON.stringify([created.project_id])}, meta=[${JSON.stringify(
						{ description: description.trim() },
					)}]);`,
				);
			} catch (e) {
				// Cosmetic — the project exists and is usable without it.
				console.error("Failed to set project description", e);
			}
		}

		await this.scaffoldProjectForAgents(
			created.project_id,
			trimmed,
			projectType,
		);

		// Publishing is what makes the project's portal reachable. Non-fatal:
		// the project is still created and editable if this fails.
		try {
			await this._actions.run(
				`PublishProject(project=${JSON.stringify([created.project_id])}, release=[true]);`,
			);
		} catch (e) {
			console.error("Created the project but failed to publish it", e);
		}

		return created;
	};

	/**
	 * Give a project the things an agent cannot discover for itself.
	 *
	 * For a CODE project that is an `AGENTS.md` saying `portals/` is the only
	 * served directory and what URL the finished app has, plus the `portals/`
	 * folder itself. For a BLOCKS project it is the `blocks.json` contract — the
	 * flat block map, the exact widget names, and the three renames that would
	 * otherwise each produce a silently blank app.
	 *
	 * `AgentsMdLoader` reads `AGENTS.md` out of the agent's working directory
	 * into the system prompt, and for a project-scoped room that working
	 * directory is this assets folder — so this is the one hook that can teach an
	 * agent a project's own conventions without touching its instructions or the
	 * harness prompt. Without it an agent writes `index.html` to the assets root,
	 * reports the app finished, and leaves something no URL can open.
	 *
	 * Runs on selection as well as creation, because most projects already exist
	 * and would otherwise never get it. **Never overwrites**: a project that
	 * already has an `AGENTS.md` has its own conventions, possibly hand-written,
	 * and they win.
	 *
	 * Entirely best-effort. A project the user can read but not edit will reject
	 * the writes, which is fine — scoping a room to it still works.
	 */
	scaffoldProjectForAgents = async (
		projectId: string,
		projectName: string,
		projectType: ProjectKind = "CODE",
	): Promise<void> => {
		try {
			const { pixelReturn } = await this._actions.run<
				[{ fileName?: string; name?: string }[]]
			>(`BrowseAppAssets(project=${JSON.stringify([projectId])});`);
			const entries = pixelReturn[0]?.output;
			if (!Array.isArray(entries)) {
				return;
			}
			const names = new Set(
				entries
					.map((e) => (e?.fileName ?? e?.name ?? "").trim())
					.filter(Boolean),
			);

			// CLAUDE.md counts: AgentsMdLoader reads either name, so a project
			// carrying one is already configured.
			if (!names.has("AGENTS.md") && !names.has("CLAUDE.md")) {
				const guide =
					projectType === "BLOCKS"
						? blocksProjectAgentsMd(projectId, projectName)
						: projectAgentsMd(projectId, projectName);
				await this._actions.run(
					`SaveAppAssets(project=${JSON.stringify([projectId])}, filePath=${JSON.stringify(
						["AGENTS.md"],
					)}, content=["<encode>${guide}</encode>"], comment=["Scaffold project conventions for agents"]);`,
				);
			}

			// A blocks app already has portals/blocks.json, written by
			// CreateAppFromBlocks — there is nothing to keep the folder alive for.
			if (projectType !== "BLOCKS" && !names.has("portals")) {
				await this._actions.run(
					`SaveAppAssets(project=${JSON.stringify([projectId])}, filePath=${JSON.stringify(
						["portals/.gitkeep"],
					)}, content=["<encode></encode>"], comment=["Create the served portals folder"]);`,
				);
			}
		} catch (e) {
			console.error("Could not scaffold the project for agents", e);
		}
	};

	deleteWorkspace = async (workspaceId: string) => {
		try {
			await this._actions.run(
				`DeleteWorkspace(workspaceId=['${workspaceId}'])`,
			);

			return;
		} catch (e) {
			console.error(e);
		}
	};

	/**
	 * Helpers
	 */
	/**
	 * Get available models from the backend
	 */
	private getDefaultModel = async (): Promise<void> => {
		const defaultModelId =
			this._theme.defaultRoomSettings?.model?.engine_id ||
			DEFAUlT_MODEL_ID;
		const defaultModelName =
			this._theme.defaultRoomSettings?.model?.engine_display_name ||
			this._theme.defaultRoomSettings?.model?.engine_name ||
			DEFAUlT_MODEL_NAME;
		// model selection is not enabled, set it to the default
		if (!this._theme.featureFlags?.enableModelSelect) {
			this.setSelectedModel({
				engine_id: defaultModelId,
				engine_name: defaultModelName,
				engine_type: "MODEL",
			});
			return;
		}

		const { pixelReturn } = await this._actions.run<[Engine[]]>(
			`META | MyEngines(metaKeys=[], metaFilters=[{"tag":"text-generation"}], engineTypes=["MODEL"]);`,
		);

		runInAction(() => {
			const { output } = pixelReturn[0];

			// Cache the full list so setProfileDefaultModel() can resolve an id to an Engine later
			this._store.models.available = output;

			// profileDefaultModelId is already set by getUser(), which runs before this
			const profileDefaultModelId = this._store.profileDefaultModelId;
			let isSelected = false;

			// 1. user's profile default — explicitly set by the user, highest personal priority
			if (profileDefaultModelId) {
				for (const m of output) {
					if (m.engine_id === profileDefaultModelId) {
						this.setSelectedModel(m);
						isSelected = true;
						break;
					}
				}
			}

			// 2. last model selected in this login session (survives refresh, resets on new login)
			if (!isSelected) {
				try {
					const sessionItem =
						sessionStorage.getItem(SESSION_MODEL_KEY);
					if (sessionItem) {
						const { model: sessionModel, lastLogin: storedLogin } =
							JSON.parse(sessionItem) as {
								model: Engine;
								lastLogin?: string;
							};
						const currentLogin = this._store.user.lastLogin;
						if (
							storedLogin &&
							currentLogin &&
							storedLogin === currentLogin
						) {
							for (const m of output) {
								if (m.engine_id === sessionModel.engine_id) {
									this.setSelectedModel(m);
									isSelected = true;
									break;
								}
							}
						}
					}
				} catch {}
			}

			// 3. theme/admin-suggested default — used as a fallback when the user has no preference
			if (!isSelected && defaultModelId) {
				for (const m of output) {
					if (m.engine_id === defaultModelId) {
						this.setSelectedModel(m);
						isSelected = true;
						break;
					}
				}
			}

			// 4. first available model
			if (!isSelected && output.length > 0) {
				this.setSelectedModel(output[0]);
			}
		});
	};
}
