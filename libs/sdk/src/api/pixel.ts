import { runPixel as baseRunPixel } from "./base";

/**
 * Wrapper around base runPixel that accepts options object for better testability.
 * For tests, this accepts a loose object shape.
 * In production, it delegates to baseRunPixel.
 * @param pixel - The pixel expression to execute
 * @param options - Options including insightId
 * @returns The pixel execution result (either mock or real PixelResult)
 */
export async function runPixel(
	pixel: string,
	options?: { insightId?: string },
): Promise<Record<string, unknown>> {
	return baseRunPixel(pixel, options?.insightId);
}
