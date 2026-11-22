/** Translates Vietnamese texts to English. Same length and order as the input, or null when it could not. */
export type Translator = (texts: string[]) => Promise<string[] | null>;
