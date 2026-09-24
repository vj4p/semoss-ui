/**
 * The message worth showing a person for something that was thrown.
 *
 * Anything can be thrown, and the SDK does throw both `Error`s and bare
 * strings, so a host that interpolates `error.message` blindly prints
 * "undefined" for exactly the failures it most needs to explain.
 */
export const describeError = (error: unknown): string =>
	error instanceof Error ? error.message || error.name : String(error);
